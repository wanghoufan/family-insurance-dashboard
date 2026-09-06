# 交接与历史协作协议（HANDOFF）

## 最新交接（2026-09-07 · 全量收尾代码完成未提交 + 真机项 BLOCKED）

> 本节为当前有效交接；下方 09-06 中午节为历史快照，与本文冲突处以本节为准。

### 1. 本轮做了什么（全部本地验证，未 commit，等用户明确指令）

1. **B1 R-2 加密备份**（`src/family-insurance-dashboard.html`）：「加密备份/恢复」按钮 +
   PBKDF2-210k/AES-GCM-256 本机加解密，覆盖 8 个 localStorage 键 + IndexedDB 全部合同
   （50MB 上限保护）。合成数据 roundtrip 通过、错密码正确拒绝；只用合成数据测，
   未触碰真实身份证/合同。
2. **B2**：删 store.js TEMP 注释，信标升为 `vA已加载`，脚本 `?v=20260907a` 同步。
3. **B3**：「删除当前险种」+ `store.deleteRateType`（先清 entry 再删 type 行）；
   `setRateCell` 接云端 + 险种行未建好时排队补写（修“需编辑两次”）；
   `resetRateType` 同步清云端 entry（否则刷新后云端旧值覆盖回来）。
   另修 replayed 路径 `refreshOne` 传参 bug（此前传字符串导致回读查全表）。
4. **B4/B6 草案**：`scratch/README草案-20260907.md`、`scratch/R3-Redirect申请草案-20260907.md`
   （均不进 Git，README 未动，共享项目未动）。
5. **B5**：`docker compose config` 通过；`docker build` + 临时容器 `:3201` 实测 HTTP 200，
   镜像/容器已清理。部署副本未建（`deploy.sh` 会起生产容器 + 占 3200，需用户一键授权）。
6. **无头冒烟对照**：基线 HEAD 与本轮在无头 Chrome 下表现一致
   （空表、无信标——为无头环境异步启动未完成所致，非回归；昨日 QA 真机信标正常）。
   `node --check` 5/5 通过，`git diff --check` 通过，30 个事件 handler 全有定义。

### 2. 还剩什么（需用户/真机）

1. **commit / push**：等明确指令。改动：HTML、store.js、PLAN、QA_CHECKLIST、PRODUCT_BACKLOG、本文件。
2. **B7 L1–L5 BLOCKED**：Tailscale CLI 在本机起不来（需 Mac 端 App）、无第二设备、
   真人 Google 登录需用户操作。待 R-3 批复 + Tailscale 就绪后按 L1→L5 实测。
3. **实机回归待补**：真实合同加解密、大文件上限、双设备险种删除一致性。
4. 其余沿用 09-06 中午节（R-2 已交付，BACKLOG 两项已清）。

---

## 最新交接（2026-09-06 中午 · 云端同步全链路验收通过 + 本机数据上云完成）

> 本节为当前有效交接；下方「历史快照」各节与本文冲突处以本节为准。

### 1. 当前的工作进展

1. **Supabase 接入目标全部达成，QA 三轮后总体 PASS**：登录态判定、云端徽章、待办/保单云端 CRUD + 刷新持久化、失败重试队列，全部真机验证通过。
2. **云端已有真实数据**：6 份保单 + 待办（用户授权后由智能体代操作上云，v=20260906l）。同步队列清空，「上传本机数据」按钮消失。身份证号 / policyNo / payCard / waitingPeriod / period / 合同 PDF 仍只在本机（数据库层无这些列，sidecar 未动）。
3. **今日攻坚修复清单**（全部实测，详见 git diff 与下方历史快照）：
   - `FID.store.init()` 从未被调用（登录态判定/loadAll/自动登录全是死代码）→ 启动引导接线 `await init(); await loadAll();`
   - auth 监听跳过 INITIAL_SESSION（消除 reload 循环隐患）
   - 首登保护：云端为空且本机有保单时不覆盖 localStorage（保留为待上传草稿）
   - INSERT 补 `owner_user_id`（RLS with check 拒绝）与 `client_id`（policy 载荷从不携带）
   - 历史非 uuid id（'t1'）一次性规范化 + insertTodo 源头规范化
   - 全部脚本带 `?v=20260906l` cache-busting（python http.server 无缓存头，Chrome 会吃旧 JS——这是曾浪费两轮 QA 的坑）
   - `?login=1` 自动登录、`?upload=1` 自动上传、loadAll 后自动重试挂起队列
   - 稳定版本信标：窗口标题「家庭保单数据看板 · vL已加载」，init 末尾写入后不再变；**升版本时同步改 store.js 这一行和 HTML 的 v= 参数**
4. **改动未 commit**（等用户明确指令）：`src/family-insurance-dashboard.html`、`src/repository/` 四件套、`src/config.js`（本机生成不进 Git）、`src/config.example.js`、`.gitignore`、`Dockerfile`、`compose.yaml`、`docker/env.template`、`.dockerignore`、本文件。

### 2. 下一步的任务

1. **commit / push**：等用户明确指令（改动清单见上）。push 后可考虑删 porgy 旧分支。
2. **L1–L5 验收**（登录读、单设备写后刷新、Mac Mini + Tailscale 笔记本双设备 CRUD、并发冲突/断线重连、隔离恢复演练），全部留记录后交审核人收口。双设备依赖 Tailscale 就绪。
3. **R-2 本机私有数据加密导出包**（优先级最高的欠账）：身份证/合同 PDF 目前无任何备份机制，IndexedDB 不在现有导出 JSON 里。
4. **Tailscale 地址的 Redirect URL 追加（R-3）**：外网方案定型后按规范 §6.3 另提申请（先申请后改）。
5. **Docker 部署副本** `~/Developer/coding/docker/family-insurance-dashboard/`（需用户授权后创建；Dockerfile/compose/env.template/.dockerignore 已就绪，端口 3200）。
6. **文档小项**：README「常见问题」「数据存储与隐私」仍写「数据不联网」，需改前先出草案给用户确认。
7. **产品 backlog**：「删除险种」入口（QA- 险种残留无 UI 删除途径）；种子费率险种首次上云需编辑两次的已知限制。
8. 已知非阻塞事项：历史待办 't1' 本地 id 与云端 client_id 不一致（纯外观，_serverId 已对齐）。

### 3. 注意事项及相关规矩

- **全部继承「2026-09-05 晚」节规矩**（Git 需明确授权、规范 V1.1/V1.4 分工、数据库红线、隐私红线、端口表、审查材料存放、文档路由），以下为本轮新增/强调：
- **共享 Auth 是全局能力（§6.3）**：Redirect URL / Site URL 变更先出申请存档 `alw丨数据库管理专家/项目审查丨family-insurance-dashboard/`，纯追加；prompt-manager（192.168.31.60:3100）是共享项目 Site URL，勿当本工具回程。
- **`config.js` 不进 Git**（`.gitignore` 已覆盖 `src/config.js`）；模板在 `src/config.example.js`；禁止 service_role 或任何 secret 进浏览器包。
- **预览服务**：`cd src && python -m http.server 8000`；登录回程依赖 http origin，禁止 file:// 打开。Chrome 缓存旧 JS 的坑靠 `?v=` 参数治理——**改了 JS 必须同步升版本号**。
- **数据库层没有身份证/合同列**：任何「顺手同步全部字段」的实现都是错的；私有字段永远走 sidecar，派生字段 birth_date/expiry_date 由 repos.js 计算。
- **INSERT 契约**（RLS + 约束决定，repos.execute 已统一处理，勿破坏）：必须带 `owner_user_id`（会话注入）+ 合法 uuid `client_id`（幂等键，重试复用）；省略 revision。
- **真机验证经验**：orca 合成点击在本机 Chrome 不可靠（点了不落页面），真机验证优先 `open` 命令 + 无头 playwright 双通道；误判缓存状态看标题信标。

---

## 历史快照（2026-09-06 凌晨→中午 · Supabase 接入攻坚全程）

> 以下为当日攻坚过程记录（init 未接线根因、RLS/client_id/uuid 三层修复、QA 三轮迭代），细节结论已吸收进上方最新交接。

## （历史）2026-09-06 凌晨 · Supabase 业务代码接入完成 + OAuth 回路打通

> 本节为当前有效交接；下方「2026-09-05 晚」与「2026-08-17」两节均为历史快照，与本文冲突处以本节为准。

### 1. 当前的工作进展

1. **业务代码接入完成（规范 §4 第 6 步，S1 已发布的前提下全部落地）**：`src/repository/` 四件套（`client.js` / `outbox.js` / `repos.js` / `store.js`，共 765 行）接通主页面 `src/family-insurance-dashboard.html`。脚本引入顺序固定：supabase-js CDN → `config.js` → client → outbox → repos → store（`config.js` 本机生成、不进 Git；模板在 `src/config.example.js`）。
2. **硬性要求逐条落实**：
   - 全部写路径改为**记录级**调用：新增保单 INSERT、更新 `commitPolicy`（带 `.eq('revision')` 条件、0 行即冲突展示）、删除单条 DELETE；行内双击编辑、同名联动更新（SYNC_FIELDS）逐条入队；待办 addTodo/toggleTodo/delTodo 与费率 addRateType/setRateCell/resetRateType 同模式。**没有任何整库 JSON 读改写回**。
   - INSERT 省略 revision（数据库 default 1）；`client_id` 用 `crypto.randomUUID` 生成、终身不变、重试复用。
   - 离线/重试走 `outbox.js` 队列：按记录串行、失败保留并显式横幅提示（含「立即重试」按钮）、23505 按「重放成功」处理。
   - 本期无 Realtime，刷新即重读云端。
3. **隐私边界落地**：`insuredId / policyNo / payCard / waitingPeriod / period` 存本机私有 sidecar（localStorage `PRIV_KEY`），`policyPayload` 不含任何私有字段、只含台账 + 派生 `birth_date` / `expiry_date`；合同 PDF 留 IndexedDB；未登录 = 「本机草稿」模式（行为与旧版一致），无整份快照回灌。
4. **实测结果（全部通过）**：4 个 repository 文件 + 内联脚本 `node --check` 全过；无头 Chrome 冒烟（10 保单行渲染、待办增删、localStorage 落库正常，唯一 404 为 favicon）；S2 Exposure 实测——匿名带 Profile 头 401「permission denied」（RLS 正确拒绝）、不带头 404（默认 API 面隔离生效）；OAuth 发起实测跳 Google 正常。
5. **OAuth 回路已打通、最后一个竞态已修复**：用户实测发现 Redirect 白名单缺失（token 落到 prompt-manager 的 Site URL）→ 已按 §6.3 出申请（`alw丨数据库管理专家/项目审查丨family-insurance-dashboard/接入申请丨Redirect_URL白名单追加丨2026-09-06.md`）→ 用户追加 `http://localhost:8000/family-insurance-dashboard.html` 后回程正确。剩余问题：hash token 由 supabase-js 异步消费，与 store.js init 的「先 getSession 后挂监听」存在竞态 → **已修**（监听前置注册 + 无会话时 400ms×6 轮询 + hash 带 error 时 toast 具体原因）。
   - **09-06 上午真机复核**：用户 Chrome 实机刷新看板页仍显示「🔒 本机草稿」→ 确认昨晚 token 确实未留存（会话从未建立，竞态真实发生过）；「登录云端同步」按钮可点、OAuth 正常发起。**完整登录（Google 认证 → 回程 → 徽章变云 → 数据上云）至今无人验证成功**。QA 现场遗留：Chrome 同一窗口的看板标签停在 OAuth 已发起状态，QA 从该状态继续即可。
6. 顺手修复存量 bug：`exportData` 中 `blob` 未定义的死代码（原导出必抛 ReferenceError，实际导出走 `downloadBlob` 不受影响）。
7. **本轮改动全部未 commit**（等用户明确指令）：`src/family-insurance-dashboard.html`、`src/repository/`（新）、`src/config.example.js`（新）、`.gitignore`、本文件。

### 1b. 2026-09-06 下午追加：登录「永远本机草稿」根因已修复（v=20260906g）

QA 两轮 FAIL 后定位到真正的根因：**`FID.store.init()` 在整个项目里从未被调用**——启动引导 IIFE 只做本地加载，登录态判定、auth 监听、云端数据加载（`loadAll`）、`?login=1` 自动登录全部是死代码。就算 OAuth 成功、会话存进 localStorage，下次加载也没人读它，徽章永远「本机草稿」。此前对 init 内部时序的多次「修复」都在修一段从未运行的代码。

本轮三项修复（均已实测）：

1. **接线**：启动引导改为 `await FID.store.init(); await FID.store.loadAll();`（repository 未加载时保留纯本机兜底）。
2. **INITIAL_SESSION 守卫**：auth 监听跳过 INITIAL_SESSION（只是存储回放，登录态由 init 的 getSession 统一判定），消除先注册监听后置 mode 的 reload 循环风险。
3. **首登保护**：`loadAll` 云端分支在「云端为空且本机 localStorage 有保单」时**不把空云端写回本机**，保留本机数据为待上传草稿（走「上传本机数据」按钮显式上云）。

实测结果：无头双路径通过（无会话→本机草稿 10 行数据；假会话→徽章正确变「☁ 云端已同步」且无 reload 循环）；**用户真实 Chrome 已实测进入云端模式**（徽章「☁ 云端已同步 · 身份证/合同仅存本机」，显示 退出（wanghoufan13@gmail.com）/ ↻ 刷新同步）。

**QA 第三轮（v=20260906h）结果：总体 PASS**——信标全程稳定、云端待办增删持久化全过、「上传本机数据（7）」按钮已出现（本机 7 条保单以草稿态待上云）。

**2026-09-06 中午追加：7 条本机数据已成功上云（v=20260906l，用户授权后代操作）**。过程中修了三个被掩盖的写入层 bug：① INSERT payload 缺 `owner_user_id`（RLS with check 拒绝）→ execute 统一从会话注入；② policy 载荷从不携带 `client_id`（非空约束拒绝，此前被 RLS 错误掩盖）→ execute 从队列项补；③ 历史本机待办 id 非 uuid（如 't1'，uuid 列拒绝）→ execute 一次性规范化 + insertTodo 源头规范化。另加 `?upload=1` 自动上传入口与 loadAll 后自动重试挂起队列。最终状态：云端 6 份保单 + 待办，队列清空，本机草稿按钮消失。

**遗留事项**：
- store.js 内有 TEMP 诊断代码（pointerdown 点击计数、init 阶段标记写 window.title「· rD已加载」）——QA 下轮确认通过后删除，标题后缀同时是 QA 判断「加载的是否为新版」的信标。
- 用户 Chrome 的 localStorage 保单缓存曾被「空云端覆盖」清成 0（修复 3 已堵住后续）；数据备份在 `~/Downloads/家庭保单备份.json`（2026-09-06 09:28，7 条真实记录）与 `~/Downloads/2026-09-05家庭保单备份 (1).json`。恢复路径（**需用户确认后执行**）：云端模式下「导入」该 JSON → 点「上传本机数据」批量上云。
- QA- 险种残留只在本机 localStorage（当时未登录成功），云端无脏数据；「删除险种」功能列入产品 backlog。

### 2. 下一步的任务

1. **【真机 QA 智能体，最先】完整登录旅程验收**：QA 提示词已由上一轮智能体交付用户（Real Device QA / Visual QA 规格，含 P0–P3 判定、BLOCKED≠FAIL、QA测试前缀数据、隐私打码红线）。核心验收链：点「登录云端同步」→ Google 认证 → 回程 `localhost:8000` → 徽章变「☁ 云端已同步」→ 新增带「QA测试」前缀的待办上云 → 刷新后仍在 → UI 删除该待办并确认云端同步删除。若失败：F12 抓 `[FID]` 前缀日志回传开发侧修复。
2. **验收 L1–L5**（登录读、单设备写后刷新、Mac Mini + Tailscale 笔记本双设备 CRUD、并发冲突/断线重连、隔离恢复演练），全部留记录后交审核人收口。
3. **R-2 本机私有数据加密导出包**（仍欠）：身份证/合同 PDF 目前无任何备份机制，IndexedDB 不在现有导出 JSON 里。
4. **Tailscale 地址的 Redirect URL 追加（R-3）**：等外网访问方案定型后按 §6.3 另提申请。
5. **commit / push**：等用户明确指令；push 后可考虑删 porgy 旧分支。
6. **Docker 部署副本** `~/Developer/coding/docker/family-insurance-dashboard/`（需用户授权后创建；四件套已就绪，端口 3200）。
7. **文档小项**：README「常见问题」与「数据存储与隐私」仍写「数据不联网」，云端验收通过后需更新。
8. 已知限制（记录在案，非阻塞）：种子费率险种（示例数据）首次上云时单元格值需编辑两次才入云端（首编先建险种行）；登出期间创建的本机草稿待办 id 非 uuid，登录后不自动上传（与保单草稿同策略）。

### 3. 注意事项及相关规矩

- **全部继承「2026-09-05 晚」节的规矩**（Git 需明确授权、两份规范分工、数据库红线、隐私红线、端口表、审查材料存放、文档路由），以下为本轮新增：
- **共享 Auth 是全局能力（§6.3）**：Redirect URL / Site URL 任何变更先出申请存档到审查目录，纯追加、不动其他工具条目；prompt-manager（192.168.31.60:3100）是本共享项目 Site URL，**勿把它当成本工具回程**。
- **`config.js` 含 publishable key**：可进浏览器 bundle 但不进 Git（`.gitignore` 已覆盖 `src/config.js`）；禁止把 service_role 或任何 secret 写进浏览器包。
- **8000 端口预览服务**：`python -m http.server 8000`（src/ 目录后台运行），重启方法 `cd src && python -m http.server 8000`；登录回程依赖 `location.origin + pathname`，不要换成直接双击打开 HTML（file:// 会丢 redirectTo）。
- **数据库层没有身份证/合同列**：任何「顺手同步全部字段」的实现都是错的；派生字段 `birth_date`/`expiry_date` 由 `repos.js` 从私有字段计算，私有字段永远走 sidecar。

---

## 上一阶段快照（2026-09-05 晚 · Docker 规范整改 + Supabase 接入材料 + porgy 合流）

> 本节为历史快照（当前有效交接见顶部 2026-09-06 节）；其中「Migration 送审」等事项已完成（S1 已发布），A5 相关说明以 09-05 节为准。

### 1. 当前的工作进展（全部已提交，工作树干净）

**本轮两个提交**：
- `ff9e58b` src/ 分层重构 + 合流 porgy 分支（5b812aa）
- `cb93595` Docker 规范 V1.1 四件套

已完成事项：
1. **Docker 四件套（已提交、L0 验证通过）**：`Dockerfile`（nginx:1.27-alpine 静态单文件 + `/healthz`）、`compose.yaml`（端口 3200，IMAGE_TAG 回滚标识，日志轮转）、`.dockerignore`（仅 src/ 进上下文）、`docker/env.template`（仅占位符，Supabase 公开变量以注释预留）。验证：`docker build` + 临时容器冒烟 HTTP 200，验证镜像/容器已清理。
2. **源码重构与合流（已提交）**：单文件迁入 `src/`；剥离全部 `data-page-node-id` 编辑残留；双向合流 = 采纳 porgy 的 15 列 Excel **真实数据导出**（EXCEL_COLS，修正其示例行错位 bug）、IndexedDB 全链路容错、保存后清筛选强制可见、`downloadBlob`、normLabel 列名归一化；保留本线特有的清除示例数据、导出排除种子行、导入状态文本保留（statusOverride/importedStatusMap）、筛选下拉保持、旧模板 ss:Index 解析；UI 修复（险种列 nowrap、响应式布局）。验证：`node --check` 通过、Excel 导出模拟测试 15 列对齐/示例行可跳过/列名映射正确。
3. **Supabase 接入材料（完成，待送审）**：位于 `~/Developer/coding/1.Active/alw丨数据库管理专家/项目审查丨family-insurance-dashboard/`——`01_接入申请`（25 项）、`02_自查清单`、`0001_init_草案.sql`（Schema `family_insurance_dashboard`，4 表：policies/todos/rate_types/rate_entries）、`setup_stub.sql`+`verify.sql`+`run_verify.sh`+`verify_result.txt`（隔离验证 **22/22 PASS**、Migration 幂等重跑零错误）、`转送文件清单`。§22 行号与提交事实已刷新。
4. **数据边界（用户已定案，落进数据库结构层）**：
   - 上云：保单台账字段 + 电话号码 + **派生字段** `birth_date` / `expiry_date`（外网设备据此算「保至 N 周岁」到期日）
   - **永不上云**：被保人身份证号、合同 PDF（留本机 IndexedDB）；设备私密偏好（列顺序/排序/通知开关）留 localStorage
   - 外网访问走 Tailscale；共享 Auth 的 Site/Redirect URL 追加 Tailscale 地址需审核人评估（申请 R-3）
5. **已核清的仓库关系**：本目录（`1.Active/ing丨0807家庭保单数据看板 编程/`）是唯一开发主仓（main）；`~/Developer/Playground/ing丨0807家庭保单数据看板 编程/porgy` 是同一仓库的第二个 worktree（分支 `wanghoufan/porgy`，GitHub 镜像分支）。porgy 分支内容已被 `ff9e58b` 取代，分支保留未删、未推送。
6. 本轮智能体的当日工作日志在 `.workbuddy/memory/2026-09-05.md` 与 `MEMORY.md`（含全部关键决定）。

### 2. 下一步的任务（按规范顺序，关键路径在用户）

1. **送审**（用户动作）：把 `转送文件清单丨family-insurance-dashboard.md` 交给数据库审核人智能体；结论只有三种：`APPROVED_FOR_EXECUTION` / `CHANGES_REQUIRED` / `BLOCKED`（规范 §16）。
2. `CHANGES_REQUIRED` → 项目智能体按问题清单修复后**增量**重审；`APPROVED` → 由【平台丨共享 Supabase 数据库】仓库唯一发布人发布 Migration（业务仓库无权发布）。
3. **业务代码接入**（Migration 发布之后才可开始，规范 §4 第 6 步）：新增 `src/repository/` 集中访问 `supabase.schema('family_insurance_dashboard')`；记录级写入队列 + revision 条件更新（`.eq('revision', expected)`，0 行即冲突提示）；稳定 `client_id` 幂等 upsert（onConflict `owner_user_id,client_id`）；不使用 Realtime（靠刷新重读）；同时实现 **R-2 本机私有数据加密导出包**（身份证/合同 PDF 目前无任何备份机制）。
4. **验收 L1–L5**：登录读、单设备持久化（写后刷新仍在）、双设备 CRUD（Mac Mini + Tailscale 笔记本）、并发冲突/断线重连、隔离恢复演练；全部有记录后交审核人收口。
5. **Docker 部署（均需用户明确授权后创建）**：部署副本 `~/Developer/coding/docker/family-insurance-dashboard/`（业务仓库 git 克隆 + 私有 `.env.local`，经 `~/Developer/coding/docker/deploy.sh`，多项目用 `DEPLOY_CONFIG_FILE=/Users/zzymima0000/Developer/coding/docker/.deploy.family-insurance-dashboard.env`）；`~/DockerData/family-insurance-dashboard/`、`~/DockerBackups/family-insurance-dashboard/`（容器无状态，两目录当前无实际用途，按规范预留）；备份第 19 项（⏳ 待做）在送审前需排期。
6. push 到 GitHub（用户授权后）；届时可考虑删除 porgy 旧分支。
7. 文档小项：README「常见问题」的"多人共享"回答与「数据存储与隐私」表需在云端接入后更新（当前仍写"数据不联网"）。

### 3. 注意事项及相关规矩

- **Git 规矩（用户明确要求）**：仅在用户明确说"提交 / 推送"时才 `git commit` / `git push`；不得自行 push。
- **两份规范的分工**：《Mac Mini 本地项目自托管 Docker 规范 V1.1》（`~/Developer/coding/docker/`）管 Runtime/目录/Compose/备份；《共享 Supabase 项目与独立 Schema 数据库规范 **V1.4**》（`~/Developer/coding/1.Active/alw丨数据库管理专家/`，**V1.2 已过期勿用**）管 Schema/RLS/Migration/审核。接入包（00–04）在 `alw丨数据库管理专家/接入包丨给项目智能体/`。
- **数据库红线**：未获 `APPROVED_FOR_EXECUTION` 禁止任何生产数据库操作（建表/改权限/Dashboard 配置/supabase db push）；Migration 正式版只能由平台仓库按时间戳命名发布，业务仓库只留草案；禁止业务表放 `public`、整库 JSON 覆盖、service_role 进浏览器/Git；"页面显示 ≠ 已保存"（L2 起才算持久化）。
- **隐私红线**：身份证号与合同附件不得被读取、导出、上传或写入任何回执/文档示例；治理与测试只能用仓库内脱敏种子数据；`.env*`、真实数据、备份不进 Git。
- **目录与端口**：开发只在 `1.Active/ing丨0807家庭保单数据看板 编程/`；端口占用：3100 prompt-manager、8081 personal-checkin、3001 分镜生成器、8000 开发预览、**3200 本项目**。
- **审查材料存放**：一律放 `alw丨数据库管理专家/项目审查丨family-insurance-dashboard/`，业务仓库不放第二套；需跨智能体转送的文件登记进 `转送文件清单`。
- **开发期 Docker 验证可以**：build/临时容器冒烟属开发验证；**创建部署副本、DockerData、DockerBackups、生产容器、公开端口需用户授权**。
- **文档路由**：任务事实 → `docs/pm/PLAN.md`；Bug → `docs/qa/BUGS.md`；审查发现 → `docs/review/CODE_REVIEW.md`；交接 → 本文件顶部。勿另建平行文档。

---

## 上一阶段快照：新会话接手指南（Neat-Freak 2026-08-17 整理）

> 新 Agent / 新会话直接按此顺序接手，无需阅读下方历史协议即可开展工作。

### 1. 当前项目状态
- **项目**：家庭保单数据看板（单文件原生 HTML，零依赖、可离线、可本地保存）
- **源码位置**：`src/family-insurance-dashboard.html`（唯一交付物，勿迁移/重组）
- **MVP 已完成**：A1–A6 验收项全部验证通过（详见 `docs/pm/PLAN.md` 与 `docs/qa/QA_CHECKLIST.md`）
  - A1 模板内联（5417 字节，SHA256 `B60855A2…53146` 见 `docs/pm/PLAN.md`）
  - A2 导入 accept 仅含 `.json,.csv,.xls`
  - A3 localStorage（保单字段）+ IndexedDB（合同附件）均存在
  - A4 响应式（max-width + minmax，无写死 1280 宽度）
  - A5 导出 Excel 模板 `家庭保单明细表模板.xls`（内联空白模板，非数据导出）
  - A6 导出备份 `家庭保单备份.json`
- **无未决 Bug**：`docs/review/CODE_REVIEW.md` 中 MVP 5 项审查发现均已解决；`docs/qa/BUGS.md` 为空占位
- **无失效待办**：`docs/review/PRODUCT_BACKLOG.md` 为空

### 2. 接手必读顺序
1. 根目录 `AGENTS.md` —— 项目画像、7 角色系统、文档路由表、公开规则（**多 Agent 模板唯一权威入口**）
2. `docs/pm/PLAN.md` —— 当前验收标准与验证矩阵（任务事实来源）
3. `docs/qa/QA_CHECKLIST.md` —— 长期回归清单（A1–A4 已验证，IndexedDB 待实机 QA，后续回归见"待补充"）
4. `docs/roles/` + `prompts/` —— 各角色规范与提示词（00 汇总 + 01–07 角色）

### 3. 常见任务落点
- 改功能/修 Bug → 读 `src/family-insurance-dashboard.html`，改完回写 `QA_CHECKLIST.md` / `BUGS.md` / `CODE_REVIEW.md`
- 调整计划 → 改 `docs/pm/PLAN.md`，勿另建任务文档
- 新会话交接 → 本文件顶部"新会话接手指南"已就绪

### 4. 历史文档说明（仅供回溯）
- 本文件下方自 `## 历史协议：双 Agent 协作协议（Orca 编排版）` 起为 **Orca 双 Agent 旧版协议**，已归档
- 根目录 `CLAUDE.md` 为 **历史文档（Orca 版）**，顶部已加状态说明横幅，以 `AGENTS.md` 为权威入口
- 二者均不指导当前工作流，仅用于长会话回溯与协议演进参考

### 5. 重要约束（继承自历史协议，仍然有效）
- 用户已有变化必须保留；**提交、发布、依赖安装或外部系统操作需用户明确授权**
- 同一时刻一个文件只允许一个 Agent 修改；只读审查不得修改任何文件
- 找不到目标或发生意外修改时停止并报告，不创建替代目录或静默修复边界外内容

---

> 本项目当前采用「AI编程项目模板-v2.2 多 Agent 协作」，总入口见根目录 `AGENTS.md`，
> 角色规范见 `docs/roles/`，当前任务见 `docs/pm/PLAN.md`。
> 以下为**历史协作协议（Orca 双 Agent 版）**，保留供长会话交接与回溯。

---

## 历史协议：双 Agent 协作协议（Orca 编排版）

### 1. 目标与事实来源

本协议让 Codex 主导、Claude Code 有界协作，并通过 Orca 保存任务和完成事件。用户不需要
手工分工、复制提示词或通知 Agent 完成。

指令优先级：

1. 用户最新要求；
2. 当前 Orca 派工和根目录 `TASK.md`（现 `docs/pm/PLAN.md`）；
3. 本共享协议；
4. `AGENTS.md` 或 `CLAUDE.md` 中对应角色的补充规则。

`TASK.md` 是当前任务唯一事实来源。Orca 保存运行事件，不另建平行任务单。

### 2. 角色与协作选择

- Codex：需求拆分、实现或集成、文件边界、发现处置、最终验证和交付。
- Claude Code：限定范围的实施者或独立审查者。
- Orca：Run、Task、Dispatch、消息和完成事件的唯一编排通道。

| 级别 | 适用情况 | 默认方式 |
|---|---|---|
| L0 | 错别字、简单文案、明确的一行低风险修改 | Codex 独立完成 |
| L1 | 功能、修复或文档改造不可安全并行 | Codex 实施，Claude Code 定向只读审查 |
| L2 | 存在互不冲突的文件或阶段 | Claude Code 实施有界子任务，Codex 集成终验 |

### 3. 标准流程

```
用户提出任务
→ Codex 更新 TASK.md、验收标准和文件边界
→ Codex 保存 Git 状态或非 Git 基线
→ Codex 完成本阶段实现或划分独立子任务
→ Orca 创建 Run、Task 和 Dispatch
→ Codex 验证 Task/Dispatch、当前 === TASK === 及任务后的 worker 活动
→ Claude Code 实施或定向审查
→ Orca 返回 worker_done、question 或 escalation
→ Codex 接回并处置发现
→ Codex 检查边界并执行最终验证
→ Codex 更新 TASK.md 并交付
```

Claude Code 的完成事件不等于最终验收。最终结论始终由 Codex 给出。

### 4. 派工最小信息

每次派工只包含完成子任务必需的信息：目标和审查或实施类型；验收标准或需要重点检查的
风险；必须读取的文件；允许修改和禁止修改的文件；只需运行一次的检查；完成条件和返回格式。

### 5. 文件所有权与操作边界

- 同一时刻一个文件只允许一个 Agent 修改。
- Claude Code 只可修改派工明确授权的文件；只读审查不得修改任何文件。
- 现有工作区变化均视为用户所有，不清理、覆盖、重置或顺带重构。
- 未经用户授权，不提交、推送、发布、安装依赖或操作外部服务。
- 找不到目标或发生意外修改时停止并报告，不创建替代目录或静默修复边界外内容。

### 6. 验证与证据

每项验收标准必须标记一种证据：自动化验证 / 实机验证 / 代码审查 / 未验证。
建议在 `TASK.md`（现 `docs/pm/PLAN.md`）使用验证矩阵，避免一个 `[x]` 混淆“代码支持”和“实机通过”。

### 7. 审查发现处置

Codex 必须逐项将 Claude Code 的发现记录为：采纳 / 部分采纳 / 不采纳 / 待验证。
低严重度风险即使本轮不修，也必须记录理由。

### 8. Git 与非 Git 项目

Git 项目在交接前保存 `git status`、相关 Diff 或提交基线。非 Git 项目记录现有文件清单与
受保护文件哈希。

### 9. Orca 执行与首次启动

每次使用前读取当前 Orca CLI 版本匹配指南并确认 Runtime 可用；只用该指南支持的命令。
Run、Task、Dispatch 和等待均由 Codex 协调器执行。Claude Code 不运行协调器生命周期命令。

### 10. 完成条件

只有以下条件全部满足才可交付：Orca 返回 capability 有效的执行结果；Codex 检查实际变化、
越界修改和用户已有内容；验收标准均标明证据类型；审查发现均有处置结论；`TASK.md` 更新为
最终状态；已验证 / 未验证 / 遗留风险均如实报告。

---

## 历史项目入口（Codex / Orca 版，已归档）

> 以下为旧版根目录 `AGENTS.md`（Codex 项目入口），归档于此供回溯；当前已被
> 新版 `AGENTS.md`（多 Agent 协作总入口）取代。

```
# Codex 项目入口（Orca 编排版）

完整且唯一的双 Agent 协议见 docs/handoff/HANDOFF.md（原 docs/AGENT_COLLABORATION.md）；
当前任务事实只记录在根目录 TASK.md（现 docs/pm/PLAN.md）。本文件不重复共享流程，只定义
Codex 的进入方式。用户最新要求始终优先。

## Codex 入口职责
1. 非琐碎任务开始前读取 TASK.md 和共享协议。
2. 将需求转成验收标准、文件边界和证据要求，并原位更新 TASK.md。
3. 按共享协议选择 L0、L1 或 L2，不安排无实际价值或重复实现的协作。
4. 需要 Claude Code 时，只使用 Orca orchestration Skill 和当前 CLI 的版本匹配指南。
5. 派工后先验证 Task、Dispatch、worker 终端中当前 === TASK === 以及任务后的实际读取/
   思考活动，通过交付门后才等待完成。
6. 首次派工未交付、capability 被拒绝或 worker 明确失败时，由 Codex 按共享协议停止精确
   目标并自动重试。
7. 接回后逐项处置发现，检查实际变化和边界，并完成最终验证。
8. 按共享协议的完成条件更新 TASK.md，再向用户交付。

## 硬边界
- 不绕过 Orca 调用 Claude Code，不创建平行任务文档。
- 不让 Claude Code 运行协调器生命周期命令，也不把人工接力作为派工恢复方案。
- 用户已有变化必须保留；提交、发布、依赖安装或外部系统操作仍需用户明确授权。
- 目标缺失、文件冲突或 Orca 不可用时，报告原始阻塞，不创建替代品或切换通道。
```
