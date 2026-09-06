// 复制本文件为 src/config.js 并填入共享 Supabase 项目的公开配置。
// 这两项是设计上允许进入浏览器 bundle 的公开值（数据库规范 §7.1）；
// service_role、数据库密码等私密值绝不能写进本目录任何文件。
// src/config.js 已被 .gitignore 排除，不会进入 Git。
window.__FID_SUPABASE__ = {
  url: 'https://<project-ref>.supabase.co',
  publishableKey: '<publishable / anon key>'
};
