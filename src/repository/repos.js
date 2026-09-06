/* ============================================================================
 * family-insurance-dashboard · repository/repos.js
 * 四张表的记录级 CRUD 与字段映射。写入协议硬性要求：
 *  1. INSERT 省略 revision（数据库 default 给 1）；每条记录稳定 client_id，重试复用；
 *  2. UPDATE 必带 .eq('id').eq('revision', 读取时值)；0 行 = 冲突，返回 {conflict, latest}；
 *  3. 23505 唯一冲突（幂等键重放）= 成功，返回 {replayed:true}；
 *  4. 永不整库写回；身份证号 / 合同 PDF 没有对应列，天然不可能上云。
 * ==========================================================================*/
window.FID = window.FID || {};
FID.repos = (function () {
  'use strict';

  var TABLE = { policy: 'policies', todo: 'todos', rateType: 'rate_types', rateEntry: 'rate_entries' };
  var KINDS = Object.keys(TABLE);

  function cut(v, n) {
    if (v == null) return null;
    v = String(v);
    return v === '' ? null : (v.length > n ? v.slice(0, n) : v);
  }
  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  /* 身份证第 7–14 位 → 'YYYY-MM-DD'（派生 birth_date；身份证本身永不上云） */
  function birthFromId(id) {
    if (!id || !/^\d{17}[\dXx]$/.test(String(id))) return null;
    var s = id.substr(6, 4) + '-' + id.substr(10, 2) + '-' + id.substr(12, 2);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  }
  /* 保险期间文本 → 到期日（与页面 parseEnd 同一套规则，返回 'YYYY-MM-DD' 或 null） */
  function expiryFrom(period, insuredId) {
    if (!period) return null;
    var m = String(period).match(/-\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    m = String(period).match(/保至\s*(\d+)\s*周岁\((\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m && insuredId && String(insuredId).length >= 14) {
      var endYear = +String(insuredId).substr(6, 4) + (+m[1]);
      return endYear + '-' + pad2(m[3]) + '-' + pad2(m[4]);
    }
    return null;
  }
  function pad2(x) { return ('0' + (+x)).slice(-2); }
  /* '300万' → 3000000（amount_value） */
  function amountValue(text) {
    if (text == null || text === '') return null;
    var m = String(text).replace(/,/g, '').match(/([\d.]+)\s*(万|亿)?/);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    if (m[2] === '万') v *= 1e4;
    if (m[2] === '亿') v *= 1e8;
    return v;
  }

  /* ---------- 保单：应用记录 → 云端载荷（不含本机私有字段，不含 revision） ---------- */
  function policyPayload(rec) {
    return {
      insured: cut(rec.insured, 64),
      applicant: cut(rec.applicant, 64),
      category: cut(rec.category, 32),
      product: cut(rec.product, 128),
      insurer: cut(rec.insurer, 64),
      insurer_phone: cut(rec.insurerPhone, 32),
      broker_phone: cut(rec.broker, 32),
      beneficiary: cut(rec.beneficiary, 64),
      app_account: cut(rec.app, 64),
      pay_date: cut(rec.payDate, 32),
      pay_method: cut(rec.payMethod, 16),
      annual_premium: num(rec.annualPremium),
      amount_text: cut(rec.amount, 64),
      amount_value: amountValue(rec.amount),
      remark: cut(rec.remark, 500),
      birth_date: birthFromId(rec.insuredId),
      expiry_date: expiryFrom(rec.period, rec.insuredId)
    };
  }

  /* ---------- 云端行 → 应用记录（不含本机私有字段，由 store 合并 sidecar） ---------- */
  function policyFromRow(r) {
    return {
      id: r.client_id, client_id: r.client_id, _serverId: r.id, _revision: r.revision,
      insured: r.insured || '', applicant: r.applicant || '',
      category: r.category || '', product: r.product || '',
      insurer: r.insurer || '', insurerPhone: r.insurer_phone || '',
      broker: r.broker_phone || '', beneficiary: r.beneficiary || '',
      app: r.app_account || '', payDate: r.pay_date || '',
      payMethod: r.pay_method || '', annualPremium: r.annual_premium,
      amount: r.amount_text || '', remark: r.remark || '',
      policyNo: '', insuredId: '', payCard: '', waitingPeriod: '', period: '',
      _expiryDate: r.expiry_date || null, _birthDate: r.birth_date || null
    };
  }
  function todoFromRow(r) {
    return { id: r.client_id, _serverId: r.id, _revision: r.revision, text: r.content || '', done: !!r.done };
  }

  function isUniqueViolation(err) {
    if (!err) return false;
    return err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || '');
  }

  function fetchOne(kind, by) {
    var q = FID.table(TABLE[kind]).select('*');
    if (by.serverId) q = q.eq('id', by.serverId);
    else if (by.clientId) q = q.eq('client_id', by.clientId);
    return q.maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  /* ---------- 队列执行入口 ---------- */
  function execute(op) {
    if (KINDS.indexOf(op.kind) < 0) return Promise.reject(new Error('未知写入类型：' + op.kind));
    var t = FID.table(TABLE[op.kind]);

    if (op.op === 'insert') {
      // RLS with check(auth.uid() = owner_user_id)：INSERT 必须显式带 owner；
      // 队列项缺 ownerUserId（旧队列遗留）时用当前登录会话兜底。
      var ownerId = op.ownerUserId
        || (FID.store && FID.store.currentUser ? (FID.store.currentUser() || {}).id : null);
      var body = Object.assign({}, op.payload);
      if (ownerId) body.owner_user_id = ownerId;
      // 幂等键 client_id：payload 未带时从队列项补（policy 载荷此前从不携带，被 RLS 错误掩盖）
      var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (body.client_id && !UUID_RE.test(String(body.client_id))) {
        // 历史本机记录 id 非 uuid（如 't1'）：一次性换新 uuid 并回写队列项，重试保持稳定
        body.client_id = op.clientId = FID.uuid();
      }
      if (op.clientId && !body.client_id) body.client_id = op.clientId;
      return t.insert(body).select().single().then(function (res) {
        if (res.error) {
          if (isUniqueViolation(res.error)) return { replayed: true };
          throw res.error;
        }
        return { row: res.data };
      });
    }

    if (op.op === 'update') {
      return t.update(op.payload)
        .eq('id', op.serverId)
        .eq('revision', op.expectedRevision)
        .select()
        .then(function (res) {
          if (res.error) {
            if (isUniqueViolation(res.error)) return { replayed: true };
            throw res.error;
          }
          var rows = res.data || [];
          if (!rows.length) {
            // 0 行 = 冲突：取云端最新行，交 store 展示并刷新，绝不静默覆盖
            return fetchOne(op.kind, { serverId: op.serverId }).then(function (latest) {
              return { conflict: true, latest: latest };
            });
          }
          return { row: rows[0] };
        });
    }

    if (op.op === 'delete') {
      return t.delete().eq('id', op.serverId).select().then(function (res) {
        if (res.error) throw res.error;
        return { deleted: (res.data || []).length };
      });
    }

    return Promise.reject(new Error('未知操作：' + op.op));
  }

  return {
    execute: execute,
    fetchOne: fetchOne,
    policyPayload: policyPayload,
    policyFromRow: policyFromRow,
    todoFromRow: todoFromRow,
    amountValue: amountValue,
    birthFromId: birthFromId,
    expiryFrom: expiryFrom,
    TABLE: TABLE
  };
})();
