/* ============================================================================
 * family-insurance-dashboard · repository/outbox.js
 * 记录级写入队列（规范 §9.2）：
 *  - 按记录串行执行，同一时间只有一个在途写入；
 *  - 失败项保留在队首并显式提示（横幅 + 重试按钮），绝不静默丢弃；
 *  - 指数退避自动重试，断网恢复（online 事件）后立即重试；
 *  - 23505 唯一冲突按「重放成功」处理（幂等键 unique(owner_user_id, client_id)）；
 *  - 条件更新返回 0 行 = 冲突，交由 store 展示并刷新最新记录，禁止静默覆盖。
 * 队列持久化在 localStorage（键 familyOutbox），刷新页面不丢。
 * ==========================================================================*/
window.FID = window.FID || {};
FID.outbox = (function () {
  'use strict';

  var KEY = 'familyOutbox';
  var queue = load();
  var running = false;
  var retryTimer = null;
  var subs = [];

  function load() {
    try { var q = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(q) ? q : []; }
    catch (e) { return []; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch (e) {}
  }
  function onChange(fn) { subs.push(fn); }
  function snapshot() {
    var head = queue[0];
    return {
      pending: queue.length,
      failed: head && head.lastError ? { label: head.label || head.kind, error: head.lastError, tries: head.tries || 0 } : null
    };
  }
  function emit() {
    var s = snapshot();
    subs.forEach(function (fn) { try { fn(s); } catch (e) {} });
  }

  function enqueue(op) {
    op.opId = op.opId || FID.uuid();
    op.createdAt = op.createdAt || Date.now();
    queue.push(op);
    persist();
    emit();
    run();
  }

  function run() {
    if (running) return;
    if (!FID.cloudReady) return;
    running = true;
    var finished = function () { running = false; emit(); };
    var step = function () {
      if (!queue.length) { finished(); return; }
      var op = queue[0];
      FID.repos.execute(op).then(function (res) {
        queue.shift();
        persist();
        try { if (op.onDone) op.onDone(res); } catch (e) { console.error('[FID] onDone 回调失败', e); }
        emit();
        step();
      }).catch(function (err) {
        op.tries = (op.tries || 0) + 1;
        op.lastError = (err && err.message) || String(err);
        persist();
        scheduleRetry();
        emit();
        finished(); // 停在失败项，保留队列，等待重试
      });
    };
    step();
  }

  function scheduleRetry() {
    if (retryTimer) return;
    var tries = (queue[0] && queue[0].tries) || 1;
    var delay = Math.min(60000, 2000 * Math.pow(2, Math.min(tries, 5)));
    retryTimer = setTimeout(function () { retryTimer = null; run(); }, delay);
  }

  function retryNow() {
    if (queue[0]) { queue[0].lastError = null; persist(); }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    run();
  }

  window.addEventListener('online', retryNow);

  return { enqueue: enqueue, retryNow: retryNow, onChange: onChange, snapshot: snapshot };
})();
