/* ============================================================================
 * family-insurance-dashboard · repository/store.js
 * 数据源切换与写入 API（业务代码只调用 FID.store.*，不直接触 Supabase）：
 *  - mode='cloud'：登录 + 云端可达。云端为唯一主数据源；localStorage 仅为
 *    可重建缓存 + 本机私有字段 sidecar（身份证 / 保单号 / 缴费卡号 / 保险期间）。
 *  - mode='local'：未登录 / 云端不可用 / 未配置。行为与旧版完全一致，
 *    界面明确标注「本机草稿」，绝不自动回灌云端（规范 §3.2）。
 *  - 本期不用 Realtime：刷新即重读云端（登录态变化时整页重载）。
 * ==========================================================================*/
window.FID = window.FID || {};
FID.store = (function () {
  'use strict';

  var PRIV_KEY = 'familyPrivate';
  var mode = 'local';           // 'local' | 'cloud'
  var user = null;
  var offline = false;          // 云端已配置但本次读取失败（显示缓存 + 横幅）
  var typeMeta = {};            // 险种名 → {serverId, revision, clientId}
  var entryMeta = {};           // 险种 serverId → {person: {year: {serverId, revision, clientId}}}

  /* ---------- 本机私有字段 sidecar ---------- */
  function privAll() {
    try { return JSON.parse(localStorage.getItem(PRIV_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePriv(p) { try { localStorage.setItem(PRIV_KEY, JSON.stringify(p)); } catch (e) {} }
  function putPrivate(clientId, rec) {
    if (!clientId) return;
    var p = privAll();
    p[clientId] = {
      policyNo: rec.policyNo || '',
      insuredId: rec.insuredId || '',
      payCard: rec.payCard || '',
      waitingPeriod: rec.waitingPeriod == null ? '' : rec.waitingPeriod,
      period: rec.period || ''
    };
    savePriv(p);
  }
  function dropPrivate(clientId) {
    var p = privAll(); delete p[clientId]; savePriv(p);
  }
  function applyPrivate(rec) {
    var pv = privAll()[rec.client_id];
    if (pv) {
      rec.policyNo = pv.policyNo || rec.policyNo || '';
      rec.insuredId = pv.insuredId || '';
      rec.payCard = pv.payCard || '';
      rec.waitingPeriod = pv.waitingPeriod || '';
      rec.period = pv.period || '';
    }
    return rec;
  }

  /* ---------- 模式与初始化 ---------- */
  function isCloud() { return mode === 'cloud'; }

  async function init() {
    renderUi();
    if (!FID.cloudReady) return;
    var dbg = window.__FID_DEBUG = window.__FID_DEBUG || { events: [], errors: [] };
    // 先注册监听、再读会话：OAuth 回程 #access_token 由 detectSessionInUrl 异步处理，
    // SIGNED_IN 事件不能漏；会话未就绪时短轮询等它落地（最长约 6 秒）。
    FID.supabase.auth.onAuthStateChange(function (ev, session) {
      dbg.events.push(ev + (session && session.user ? '(user)' : ''));
      // INITIAL_SESSION 只是存储现状回放，登录态由下方 getSession 统一判定；
      // 若不跳过，先注册监听后置 mode 的时序会造成「已登录却被判为变化」的 reload 循环。
      if (ev === 'INITIAL_SESSION') return;
      var nu = session && session.user ? session.user : null;
      var wasCloud = mode === 'cloud';
      if ((!!nu) !== wasCloud || (nu && user && nu.id !== user.id)) {
        // 登录态变化：整页重读，避免云端 / 本机混合状态
        location.reload();
      }
    });
    try {
      var res = await FID.supabase.auth.getSession();
      if (res && res.error) dbg.errors.push('getSession: ' + (res.error.message || res.error));
      var s = res && res.data && res.data.session;
      var hadTokenInHash = /access_token|error/.test(location.hash || '');
      dbg.hadTokenInHash = hadTokenInHash;
      var deadline = Date.now() + 6000;
      while (!s && hadTokenInHash && Date.now() < deadline) {
        await new Promise(function (r) { setTimeout(r, 400); });
        res = await FID.supabase.auth.getSession();
        if (res && res.error) dbg.errors.push('getSession(轮询): ' + (res.error.message || res.error));
        s = res && res.data && res.data.session;
      }
      if (location.hash.indexOf('error=') >= 0) {
        dbg.errors.push('hash错误参数: ' + (location.hash.split('error_description=')[1] || location.hash.slice(1, 120)));
      }
      if (s && s.user) { mode = 'cloud'; user = s.user; }
      else if (hadTokenInHash) { renderDebugPanel(dbg); }
    } catch (e) {
      dbg.errors.push('init异常: ' + (e && e.message));
      console.warn('[FID] 读取登录态失败，先按本机模式展示：', e && e.message);
    }
    renderUi();
    /* 版本信标：稳定后缀，QA/用户据此确认加载的是新版（此行随版本号更新） */
    document.title = '家庭保单数据看板 · vC已加载';
    // 诊断/自动化入口：?login=1 且未登录时自动发起 OAuth（回程 redirectTo 不带 query，不会循环）
    try {
      if (!isCloud() && new URLSearchParams(location.search).get('login') === '1') {
        setTimeout(function () { login(); }, 800);
      }
    } catch (e) {}
  }

  /* OAuth 回程有 token 却没建立会话时，把诊断事实浮在页面上（不出现在正常路径） */
  function renderDebugPanel(dbg) {
    if (document.getElementById('fidDebug')) return;
    var sbKeys = [];
    try { sbKeys = Object.keys(localStorage).filter(function (k) { return k.indexOf('sb-') === 0; }); } catch (e) {}
    var div = document.createElement('div');
    div.id = 'fidDebug';
    div.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;max-width:520px;background:#2b1414;color:#ffd9d9;border:1px solid #8a3a3a;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.6;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    div.innerHTML =
      '<b>⚠ OAuth 回程未建立会话（诊断信息）</b><br>' +
      'hash现在: ' + escapeHtml((location.hash || '(空)').slice(0, 60)) + '<br>' +
      'storage会话键: ' + (sbKeys.length ? escapeHtml(sbKeys.join(', ')) : '无') + '<br>' +
      'auth事件: ' + (dbg.events.length ? escapeHtml(dbg.events.join(' → ')) : '(无)') + '<br>' +
      '错误: ' + (dbg.errors.length ? escapeHtml(dbg.errors.join('；')) : '(无显式错误)') + '<br>' +
      '<button class="mini" style="margin-top:6px" onclick="this.parentNode.remove()">关闭</button>';
    document.body.appendChild(div);
  }

  async function login() {
    if (!FID.cloudReady) { alert('本机未配置云端（缺 src/config.js），当前仅本机模式。'); return; }
    try {
      var redirectTo = location.origin === 'null' ? undefined : (location.origin + location.pathname);
      var opt = { provider: 'google' };
      if (redirectTo) opt.options = { redirectTo: redirectTo };
      var res = await FID.supabase.auth.signInWithOAuth(opt);
      if (res && res.error) alert('登录失败：' + res.error.message + '\n\n若提示 redirect 地址未配置，需要按规范 §6.3 先把当前地址加入共享项目的 Redirect URL 白名单（受影响工具清单须先经审核）。');
    } catch (e) {
      alert('登录失败：' + (e && e.message || e));
    }
  }
  async function logout() {
    if (!FID.cloudReady) return;
    try { await FID.supabase.auth.signOut(); } catch (e) {}
    location.reload();
  }

  /* ---------- 加载 ---------- */
  async function loadAll() {
    if (!isCloud()) {
      if (typeof loadPolicies === 'function') loadPolicies();
      if (typeof loadTodos === 'function') loadTodos();
      if (typeof loadAnalytics === 'function') loadAnalytics();
      offline = false;
      renderUi();
      return;
    }
    try {
      var pr = FID.table('policies').select('*').order('created_at', { ascending: true });
      var tr = FID.table('todos').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      var rt = FID.table('rate_types').select('*').order('created_at', { ascending: true });
      var re = FID.table('rate_entries').select('*').order('year', { ascending: true });
      var outs = await Promise.all([pr, tr, rt, re].map(function (q) { return q; }));
      var pol = outs[0], todo = outs[1], rtype = outs[2], rent = outs[3];
      [pol, todo, rtype, rent].forEach(function (r) { if (r.error) throw r.error; });

      offline = false;

      /* 保单：云端行 + 本机私有 sidecar */
      policies = (pol.data || []).map(function (r) {
        return applyPrivate(FID.repos.policyFromRow(r));
      });
      if (typeof loadRowOrder === 'function') loadRowOrder();

      /* 待办 */
      todos = (todo.data || []).map(FID.repos.todoFromRow);

      /* 费率分析：本地结构缓存为底，云端 type/entry 覆盖 */
      if (typeof loadAnalytics === 'function') loadAnalytics();
      typeMeta = {}; entryMeta = {};
      (rtype.data || []).forEach(function (r) {
        typeMeta[r.name] = { serverId: r.id, revision: r.revision, clientId: r.client_id };
        if (!analytics.types[r.name]) analytics.types[r.name] = { years: [], rows: {} };
      });
      (rent.data || []).forEach(function (e) {
        var tn = Object.keys(typeMeta).find(function (n) { return typeMeta[n].serverId === e.type_id; });
        if (!tn) return;
        var t = analytics.types[tn]; if (!t) return;
        if (!t.rows[e.person]) t.rows[e.person] = {};
        t.rows[e.person][e.year] = e.amount == null ? null : Number(e.amount);
        if (t.years.indexOf(e.year) < 0) { t.years.push(e.year); t.years.sort(); }
        var m = entryMeta[e.type_id] = entryMeta[e.type_id] || {};
        m[e.person] = m[e.person] || {};
        m[e.person][e.year] = { serverId: e.id, revision: e.revision, clientId: e.client_id };
      });
      if (typeof savePolicies === 'function' && typeof saveTodos === 'function' && typeof saveAnalytics === 'function') {
        /* 首登保护：云端为空且本机 localStorage 有保单时，不把空云端写回本机，
           保留本机数据为待上传草稿（徽章处会出现「上传本机数据」按钮，由用户显式上云） */
        var cloudEmpty = !(pol.data || []).length && !(todo.data || []).length;
        var localHasData = (function () {
          try { return (JSON.parse(localStorage.getItem('familyPolicies') || '[]')).length > 0; } catch (e) { return false; }
        })();
        if (cloudEmpty && localHasData) {
          if (typeof loadPolicies === 'function') loadPolicies();
          if (typeof loadTodos === 'function') loadTodos();
        } else {
          savePolicies();
          saveTodos();
          saveAnalytics();
        }
      }
    } catch (e) {
      // 云端读取失败：回退本机缓存，明确标注，不静默
      offline = true;
      console.warn('[FID] 云端读取失败，展示本机缓存：', e && e.message);
      if (typeof loadPolicies === 'function') loadPolicies();
      if (typeof loadTodos === 'function') loadTodos();
      if (typeof loadAnalytics === 'function') loadAnalytics();
    }
    renderUi();
    /* ?upload=1 自动上传本机草稿：仅在云端模式、云端可达且有草稿时触发一次。
       幂等性由 client_id + 23505 重放成功机制保证，重复触发不会产生重复记录。 */
    try {
      if (isCloud() && !offline
          && new URLSearchParams(location.search).get('upload') === '1'
          && localDraftCount() > 0 && !window.__fidAutoUploading) {
        window.__fidAutoUploading = true;
        setTimeout(function () { uploadLocalDrafts(true); }, 1200);
      }
      // 页面加载后自动重试上次未完成的队列（如 RLS 修复前的失败项）
      if (isCloud() && !offline && FID.outbox && FID.outbox.snapshot().pending > 0) {
        setTimeout(function () { FID.outbox.retryNow(); }, 1500);
      }
    } catch (e) {}
  }

  /* ---------- 写入：保单 ---------- */
  function ensureClientId(rec) {
    if (!rec.client_id) rec.client_id = FID.isUuid(rec.id) ? rec.id : FID.uuid();
    rec.id = rec.client_id;
    return rec;
  }

  function insertPolicy(rec) {
    ensureClientId(rec);
    if (typeof savePolicies === 'function') savePolicies();
    if (!isCloud()) return;
    putPrivate(rec.client_id, rec);
    FID.outbox.enqueue({
      kind: 'policy', op: 'insert', clientId: rec.client_id,
      ownerUserId: user && user.id,
      label: '新增保单「' + (rec.product || rec.insured || '未命名') + '」',
      payload: FID.repos.policyPayload(rec),
      onDone: function (res) { afterWrite('policy', rec, res); }
    });
  }

  function commitPolicy(rec) {
    if (!isCloud()) return;
    ensureClientId(rec);
    putPrivate(rec.client_id, rec);
    if (!rec._serverId) {
      // 本机草稿记录首次上云
      FID.outbox.enqueue({
        kind: 'policy', op: 'insert', clientId: rec.client_id,
      ownerUserId: user && user.id,
        label: '上传保单「' + (rec.product || rec.insured || '未命名') + '」',
        payload: FID.repos.policyPayload(rec),
        onDone: function (res) { afterWrite('policy', rec, res); }
      });
      return;
    }
    FID.outbox.enqueue({
      kind: 'policy', op: 'update', serverId: rec._serverId, expectedRevision: rec._revision, clientId: rec.client_id,
      label: '更新保单「' + (rec.product || rec.insured || '未命名') + '」',
      payload: FID.repos.policyPayload(rec),
      onDone: function (res) { afterWrite('policy', rec, res); }
    });
  }

  function deletePolicy(id) {
    var idx = (typeof policies !== 'undefined' ? policies : []).findIndex(function (p) { return p.id === id; });
    var rec = idx >= 0 ? policies[idx] : null;
    if (isCloud() && rec && rec._serverId) {
      var serverId = rec._serverId, clientId = rec.client_id;
      FID.outbox.enqueue({
        kind: 'policy', op: 'delete', serverId: serverId,
        label: '删除保单「' + (rec.product || rec.insured || '未命名') + '」',
        onDone: function () { dropPrivate(clientId); }
      });
    } else if (rec && rec.client_id) {
      dropPrivate(rec.client_id);
    }
  }

  /* ---------- 写入：待办 ---------- */
  function insertTodo(t) {
    // 历史本机待办 id 可能非 uuid（如 't1'），云端 client_id 为 uuid 列：上云前规范化
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(t.id))) {
      t.id = FID.uuid();
      if (typeof saveTodos === 'function') saveTodos();
    }
    if (typeof saveTodos === 'function') saveTodos();
    if (!isCloud()) return;
    FID.outbox.enqueue({
      kind: 'todo', op: 'insert', clientId: t.id,
      ownerUserId: user && user.id,
      label: '新增待办「' + (t.text || '').slice(0, 20) + '」',
      payload: { client_id: t.id, content: String(t.text || '').slice(0, 200), done: !!t.done, sort_order: (typeof todos !== 'undefined' ? todos.length : 0) },
      onDone: function (res) { afterWrite('todo', t, res); }
    });
  }
  function commitTodo(t) {
    if (!isCloud()) return;
    if (!t._serverId) { insertTodo(t); return; }
    FID.outbox.enqueue({
      kind: 'todo', op: 'update', serverId: t._serverId, expectedRevision: t._revision, clientId: t.id,
      label: '更新待办「' + (t.text || '').slice(0, 20) + '」',
      payload: { content: String(t.text || '').slice(0, 200), done: !!t.done },
      onDone: function (res) { afterWrite('todo', t, res); }
    });
  }
  function deleteTodo(t) {
    if (isCloud() && t && t._serverId) {
      FID.outbox.enqueue({
        kind: 'todo', op: 'delete', serverId: t._serverId,
        label: '删除待办「' + (t.text || '').slice(0, 20) + '」',
        onDone: function () {}
      });
    }
  }

  /* ---------- 写入：费率 / 缴费趋势 ---------- */
  /* 险种行尚未建好时的单元格写入暂存：险种 insert 回来后自动补写，首编即入云 */
  var pendingCells = {};
  /* CR-0907-03：在途 insert 去重——同名 insert 已在队列/在途时不再 enqueue，避免云端重名行 */
  var inFlightTypes = {};
  function flushPendingCells(typeName) {
    var pend = pendingCells[typeName] || [];
    pendingCells[typeName] = [];
    pend.forEach(function (c) { setRateCell(typeName, c.person, c.year, c.val); });
  }
  function insertRateType(name) {
    if (!isCloud()) return;
    if (typeMeta[name]) return;
    // 在途 5 分钟内视为有效（onDone/refreshOne 会清掉）；超期则允许重发，防止永久卡死
    if (inFlightTypes[name] && Date.now() - inFlightTypes[name] < 5 * 60 * 1000) return;
    inFlightTypes[name] = Date.now();
    var cid = FID.uuid();
    FID.outbox.enqueue({
      kind: 'rateType', op: 'insert', clientId: cid,
      ownerUserId: user && user.id,
      label: '新增费率险种「' + name + '」',
      payload: { client_id: cid, name: String(name).slice(0, 32) },
      onDone: function (res) {
        if (res && res.row) {
          typeMeta[name] = { serverId: res.row.id, revision: res.row.revision, clientId: res.row.client_id };
          delete inFlightTypes[name];
          flushPendingCells(name);
        }
        else if (res && res.replayed) refreshOne('rateType', { client_id: cid }, null, name);
      }
    });
  }
  function setRateCell(typeName, person, year, val) {
    if (!isCloud()) return;
    var tm = typeMeta[typeName];
    if (!tm) {
      // 险种行还在建队等云端返回：先排队，insert 成功后 flushPendingCells 自动补写（不丢本次编辑）
      insertRateType(typeName);
      var q = pendingCells[typeName] = pendingCells[typeName] || [];
      var i;
      for (i = 0; i < q.length; i++) {
        if (q[i].person === person && q[i].year === year) { q[i].val = val; return; }
      }
      q.push({ person: person, year: year, val: val });
      return;
    }
    var m = entryMeta[tm.serverId] = entryMeta[tm.serverId] || {};
    var pm = m[person] = m[person] || {};
    var em = pm[year];
    var amount = (val === '' || val == null || isNaN(Number(val))) ? null : Number(val);
    if (em) {
      if (amount == null) {
        pm[year] = undefined;
        FID.outbox.enqueue({ kind: 'rateEntry', op: 'delete', serverId: em.serverId, label: '删除费率 ' + typeName + '·' + person + '·' + year, onDone: function () {} });
      } else {
        FID.outbox.enqueue({
          kind: 'rateEntry', op: 'update', serverId: em.serverId, expectedRevision: em.revision, clientId: em.clientId,
          label: '更新费率 ' + typeName + '·' + person + '·' + year,
          payload: { amount: amount },
          onDone: function (res) { afterEntryWrite(tm, person, year, em, res); }
        });
      }
    } else if (amount != null) {
      var cid = FID.uuid();
      FID.outbox.enqueue({
        kind: 'rateEntry', op: 'insert', clientId: cid,
        ownerUserId: user && user.id,
        label: '新增费率 ' + typeName + '·' + person + '·' + year,
        payload: { client_id: cid, type_id: tm.serverId, person: String(person).slice(0, 64), year: year, amount: amount },
        onDone: function (res) {
          if (res && res.row) pm[year] = { serverId: res.row.id, revision: res.row.revision, clientId: res.row.client_id };
        }
      });
    }
  }
  function afterEntryWrite(tm, person, year, em, res) {
    var pm = (entryMeta[tm.serverId] = entryMeta[tm.serverId] || {});
    pm[person] = pm[person] || {};
    if (res && res.row) pm[person][year] = { serverId: res.row.id, revision: res.row.revision, clientId: res.row.client_id };
    else if (res && res.conflict) { pm[person][year] = undefined; conflictNotice('费率记录（' + person + ' · ' + year + '）'); }
    else if (res && res.replayed) { pm[person][year] = undefined; }
  }
  function clearRateEntries(typeName) {
    if (!isCloud()) return;
    var tm = typeMeta[typeName]; if (!tm) return;
    var m = entryMeta[tm.serverId] || {};
    Object.keys(m).forEach(function (person) {
      Object.keys(m[person]).forEach(function (year) {
        var em = m[person][year];
        if (em && em.serverId) {
          FID.outbox.enqueue({ kind: 'rateEntry', op: 'delete', serverId: em.serverId, label: '清空费率 ' + typeName + '·' + person + '·' + year, onDone: function () {} });
        }
      });
    });
    entryMeta[tm.serverId] = {};
  }
  /* 删除险种：先清该险种全部云端 entry，再删 type 行（本机 analytics 由调用方同步删除） */
  function deleteRateType(typeName) {
    if (!isCloud()) return;
    clearRateEntries(typeName);
    var tm = typeMeta[typeName];
    if (tm && tm.serverId) {
      FID.outbox.enqueue({ kind: 'rateType', op: 'delete', serverId: tm.serverId, label: '删除费率险种「' + typeName + '」', onDone: function () {} });
      if (entryMeta[tm.serverId]) delete entryMeta[tm.serverId];
    }
    delete typeMeta[typeName];
    delete pendingCells[typeName];
    delete inFlightTypes[typeName];
  }

  /* ---------- 写入结果处理（含冲突裁决） ---------- */
  function afterWrite(kind, rec, res) {
    if (!res) return;
    if (res.row) {
      rec._serverId = res.row.id;
      rec._revision = res.row.revision;
      if (kind === 'policy' && typeof savePolicies === 'function') savePolicies();
      if (kind === 'todo' && typeof saveTodos === 'function') saveTodos();
      return;
    }
    if (res.replayed) {
      // 23505：幂等重放成功。回读该行，补齐 serverId / revision
      refreshOne(kind, rec, res, null);
      return;
    }
    if (res.conflict) {
      // 0 行更新 = 冲突：展示冲突并刷新为云端最新，禁止静默覆盖
      if (res.latest && rec) {
        if (kind === 'policy') {
          var merged = applyPrivate(FID.repos.policyFromRow(res.latest));
          var idx = policies.findIndex(function (p) { return p.id === rec.id; });
          if (idx >= 0) policies[idx] = merged;
          if (typeof savePolicies === 'function') savePolicies();
        } else if (kind === 'todo') {
          var t = (typeof todos !== 'undefined' ? todos : []).find(function (x) { return x.id === rec.id; });
          if (t) { t.text = res.latest.content; t.done = !!res.latest.done; t._revision = res.latest.revision; }
          if (typeof saveTodos === 'function') saveTodos();
        }
      }
      conflictNotice((res.latest && (res.latest.product || res.latest.insured || res.latest.content)) || '该记录');
      rerender();
    }
  }
  function refreshOne(kind, rec, res, typeName) {
    var clientId = (rec && rec.client_id) || (res && res.clientId);
    FID.repos.fetchOne(kind, { clientId: clientId }).then(function (row) {
      if (!row) return;
      if (kind === 'policy' && rec) {
        var merged = applyPrivate(FID.repos.policyFromRow(row));
        var idx = policies.findIndex(function (p) { return p.id === clientId; });
        if (idx >= 0) policies[idx] = merged;
        if (typeof savePolicies === 'function') savePolicies();
      } else if (kind === 'todo' && rec) {
        rec._serverId = row.id; rec._revision = row.revision;
        if (typeof saveTodos === 'function') saveTodos();
      } else if (kind === 'rateType' && typeName) {
        typeMeta[typeName] = { serverId: row.id, revision: row.revision, clientId: row.client_id };
        delete inFlightTypes[typeName];
        flushPendingCells(typeName);
      }
    }).catch(function (e) { console.warn('[FID] 重放回读失败：', e && e.message); });
  }
  function conflictNotice(name) {
    try {
      alert('冲突提示：「' + name + '」已在其他设备被修改。\n已刷新为云端最新版本，你本次的修改没有保存。\n请基于最新内容重新修改。');
    } catch (e) {}
  }
  function rerender() {
    if (typeof enrich === 'function' && typeof refreshAll === 'function') { enrich(); refreshAll(); }
  }

  /* ---------- 本机草稿上云（用户显式确认，禁止自动回灌） ---------- */
  function localDraftCount() {
    if (!isCloud()) return 0;
    var n = 0;
    (typeof policies !== 'undefined' ? policies : []).forEach(function (p) { if (!p._serverId) n++; });
    (typeof todos !== 'undefined' ? todos : []).forEach(function (t) { if (!t._serverId) n++; });
    return n;
  }
  function uploadLocalDrafts(skipConfirm) {
    var n = localDraftCount();
    if (!n) { alert('没有需要上传的本机记录。'); return; }
    if (!skipConfirm && !confirm('将 ' + n + ' 条本机记录上传到云端（作为新增记录，不会覆盖云端已有数据）？\n身份证号与合同 PDF 不会上传。')) return;
    (typeof policies !== 'undefined' ? policies : []).forEach(function (p) { if (!p._serverId) commitPolicy(p); });
    (typeof todos !== 'undefined' ? todos : []).forEach(function (t) { if (!t._serverId) insertTodo(t); });
  }

  /* ---------- 界面状态 ---------- */
  function renderUi() {
    var lock = document.getElementById('privacyLock');
    var sub = document.getElementById('subLine');
    var actions = document.getElementById('cloudActions');
    var banner = document.getElementById('syncBanner');
    var ob = FID.outbox ? FID.outbox.snapshot() : { pending: 0, failed: null };

    if (lock) lock.textContent = isCloud() ? '☁ 云端已同步 · 身份证/合同仅存本机' : '🔒 本机草稿 · 未上云';
    if (sub) sub.textContent = isCloud()
      ? '云端 Schema family_insurance_dashboard 为主数据源 · 本机 localStorage 为缓存 · 身份证号与合同 PDF 只存本机 · 刷新即重读云端'
      : '本地 HTML · 数据仅存本机（localStorage + IndexedDB）· 登录后可多设备同步';
    if (actions) {
      var html = '';
      if (isCloud()) {
        html += '<button onclick="FID.store.logout()" title="退出登录，回到本机草稿模式">退出（' + escapeHtml((user && user.email) || '已登录') + '）</button>';
        html += '<button onclick="location.reload()" title="重新从云端读取全部数据">↻ 刷新同步</button>';
        var n = localDraftCount();
        if (n > 0) html += '<button class="primary" onclick="FID.store.uploadLocalDrafts()">上传本机数据（' + n + '）</button>';
      } else if (FID.cloudReady) {
        html += '<button class="primary" onclick="FID.store.login()">登录云端同步</button>';
      }
      actions.innerHTML = html;
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'syncBanner';
      banner.style.cssText = 'display:none;margin:10px auto 0;max-width:1200px;padding:10px 14px;border-radius:10px;font-size:13px;';
      var header = document.querySelector('header');
      if (header && header.parentNode) header.parentNode.insertBefore(banner, header.nextSibling);
    }
    if (ob.failed) {
      banner.style.display = 'block';
      banner.style.background = '#3a1414'; banner.style.color = '#ffb4b4'; banner.style.border = '1px solid #7a2e2e';
      banner.innerHTML = '⚠ 有 ' + ob.pending + ' 条变更未同步到云端，失败原因：' + escapeHtml(ob.failed.error) +
        '（已重试 ' + ob.failed.tries + ' 次，数据仍安全保存在本机） <button class="mini up" onclick="FID.outbox.retryNow()">立即重试</button>';
    } else if (offline) {
      banner.style.display = 'block';
      banner.style.background = '#3a2a0e'; banner.style.color = '#ffd27a'; banner.style.border = '1px solid #7a5a1e';
      banner.innerHTML = '⚠ 云端暂时不可用，当前显示本机缓存（改动会保留在本机，恢复后点「↻ 刷新同步」重读云端）。';
    } else if (ob.pending > 0) {
      banner.style.display = 'block';
      banner.style.background = '#16283d'; banner.style.color = '#8fc4ff'; banner.style.border = '1px solid #2a4a6e';
      banner.innerHTML = '⏳ ' + ob.pending + ' 条变更正在同步到云端…';
    } else {
      banner.style.display = 'none'; banner.innerHTML = '';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderUi();
    if (FID.outbox) FID.outbox.onChange(function () { renderUi(); });
  });

  return {
    init: init, loadAll: loadAll, login: login, logout: logout,
    insertPolicy: insertPolicy, commitPolicy: commitPolicy, deletePolicy: deletePolicy,
    insertTodo: insertTodo, commitTodo: commitTodo, deleteTodo: deleteTodo,
    insertRateType: insertRateType, setRateCell: setRateCell, clearRateEntries: clearRateEntries,
    deleteRateType: deleteRateType,
    uploadLocalDrafts: uploadLocalDrafts, localDraftCount: localDraftCount,
    isCloud: isCloud, renderUi: renderUi, currentUser: function () { return user; }
  };
})();
