/* ============================================================================
 * family-insurance-dashboard · repository/client.js
 * 云端访问唯一入口。所有 Supabase 查询必须经 FID.table()（内部即 Accept-Profile
 * 头指向独立 Schema family_insurance_dashboard），禁止在业务代码里散落 from()。
 * 加载顺序：supabase-js(UMD) → config.js → 本文件。
 * ==========================================================================*/
window.FID = window.FID || {};
(function () {
  'use strict';

  FID.SCHEMA = 'family_insurance_dashboard';
  FID.cloudReady = false;

  try {
    var cfg = window.__FID_SUPABASE__;
    if (cfg && cfg.url && cfg.publishableKey && window.supabase && window.supabase.createClient) {
      FID.supabase = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
      });
      FID.cloudReady = true;
    }
  } catch (e) {
    console.warn('[FID] Supabase 客户端初始化失败，进入本机模式：', e && e.message);
  }

  FID.table = function (name) {
    if (!FID.cloudReady || !FID.supabase) throw new Error('云端未配置（本机模式）');
    return FID.supabase.schema(FID.SCHEMA).from(name);
  };

  FID.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  FID.isUuid = function (s) {
    return typeof s === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  };
})();
