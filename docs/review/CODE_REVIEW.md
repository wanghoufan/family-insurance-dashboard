# CODE_REVIEW.md

> 代码审查发现由【审查】写入，按 P0–P3 / Future 分级。

## 本轮审查（重新审查 · 范围：工作树 P1 修复 CR-0907-01/02/03 + 信标 vA→vB）

- 说明：相对上一遍，工作树新增业务改动（`src/family-insurance-dashboard.html` 58 行、
  `src/repository/store.js` 10 行，未提交），即 P1 三项的修复。本遍只读审查该增量；
  历史结论（CR-0907-01～11 的原始描述）维持不变，仅更新状态。
- 验证：`node --check`（`store.js` + 内联唯一 `<script>` 块全过）与 `git diff --check` 通过；
  信标一致（标题 `vB已加载` ↔ 5 处 `?v=20260907b`，无 skew）；`collectBackupPayload`
  唯一调用方为 `exportPrivateBackup`（异常走 `alert`，loud 路径闭合）。
- 未触碰真实身份证/合同，仅读代码。业务代码未修改，仅更新本文件。

| 修复项 | 结论 | 依据 |
|---|---|---|
| CR-0907-01 两阶段恢复（先全量解码 `staged` 再动数据；`clear` 失败 throw；`put` 失败收集 `failed[]` 上报+中止语；确认文案已更正“普通导出 JSON 不含合同”） | VERIFY（待独立 QA 回归，不得直接 CLOSED） | `html:840-860`：解码失败在写 localStorage 前 throw；`put` 不再静默 `continue`；失败路径均有用户可见提示 |
| CR-0907-02 备份 loud 化（`openDB` 后 `!db` 即 throw；`getAllKeys`/`fileToDataUrl` 失败均 reject/throw；外层 `exportPrivateBackup` catch 弹框） | VERIFY（待独立 QA 回归）+ 残留小项见下 | `html:794-808`：原 `catch` 吞异常与 `db` 为 null 静默返回 0 附件两条路径已消除；残留：`getFile` 返回 null（`rq.onerror→null`）仍 `continue` 跳过——`getAllKeys` 成功后正常不应出现，仅极端损坏时少报 1 个附件，建议后续改为 throw（P3） |
| CR-0907-03 在途去重（`inFlightTypes` + 5 分钟 TTL；成功/`refreshOne` 回读/`deleteRateType` 清标记） | VERIFY（待独立 QA 回归）+ 残留小项见下 | `store.js:331-359,488`：连续编辑不再重复 `enqueue`；单元格排队逻辑未动，无丢编辑；残留窄窗口：insert 失败滞留队首超 5 分钟后再次编辑会重发一个 insert（旧失败项重试成功后云端多出重复行）——需“失败持续 + 同险种编辑”双条件，P3，建议后续 TTL 到期前检查 `outbox.snapshot().pending` 或失败不清 TTL 的替代方案 |
| CR-0907-04（删除与在途新增竞态） | 仍待修复，本轮未动 | 修复未触碰 `onDone` 无条件重建 `typeMeta[name]`（`store.js:350-355`）：编辑→insert 在途→`deleteRateType`→insert 回来仍会复活 `typeMeta` 指向将被删的 serverId。`delete inFlightTypes` 不堵该路径 |

### P0/P1 状态（本轮后）

1. ~~CR-0907-01/02/03~~ → 均已 VERIFY，转独立 QA 回归（合成数据 roundtrip + 失败注入：IDB 不可用、大于上限、损坏附件）。
2. 新增 **CR-0907-12（P2）** 见下表，转【修复】。
3. CR-0907-04（P2）仍待修复，未被本轮覆盖。

## 历史审查（2026-09-07 · 范围：`e2c2e61` R-2 加密备份 + 险种删除 + 费率首编入云 + Docker 补 COPY）

- 说明：用户提示词中“当前任务”为空；按 `docs/pm/PLAN.md` 2026-09-07 全量收尾（B1–B7）与
  `docs/handoff/HANDOFF.md` 顶部交接定位到本轮改动。`git status` 显示工作树仅
  `docs/handoff/HANDOFF.md` 未提交（B5 部署纪要），业务改动均在已提交的 `e2c2e61` 中，
  故本轮审查对象为该提交的 `src/family-insurance-dashboard.html`、`src/repository/store.js`、
  `Dockerfile`、`docker/env.template`。业务代码未修改，仅更新本文件。
- 验证方式：只读审查 + `node --check`（4 个 repository 文件与内联脚本均通过）+
  `git diff --check` 通过；未触碰真实身份证/合同，仅读代码。
- 复核（独立第二遍）：在当前 HEAD `0a13351` 上重验全部 10 项逐行属实，严重程度维持；
  重跑 `node --check`（`client.js/outbox.js/repos.js/store.js` + 内联唯一 `<script>` 块 57072 字符全过）与
  `git diff --check` 通过；工作树自上次审查后无新增业务改动（仅本文件）。另补 1 项 P3
  （CR-0907-11，费率表 handler 引号转义，pre-existing，非本轮引入）。

| ID | 严重程度 | 文件 | 描述 | 状态 |
|---|---|---|---|---|
| CR-0907-01 | P1 | `src/family-insurance-dashboard.html:841-848` | 加密恢复先 `clear()` 全部合同再逐个 `put`，单个 `dataUrlToFile` 失败或 `put` 出错时静默跳过（`continue` / `onerror→res()`），已清空的数据无法回滚，合同附件不可逆丢失。且确认框建议“先做一次导出 JSON 留底”，但 JSON 导出不含 IndexedDB 合同，误导用户。 | VERIFY（已修复待独立QA：两阶段恢复+失败点名+文案已改，vB） |
| CR-0907-02 | P1 | `src/family-insurance-dashboard.html:791-807` | `collectBackupPayload` 的 `catch` 只重抛 50MB 错误，其余 IndexedDB 异常全部吞掉并返回部分 `files`；`db` 为 null（IndexedDB 不可用）时同样静默备份 0 附件。备份成功 toast（“含 N 个合同附件”）构成完整性误报，安全网自身不可信。 | VERIFY（已修复待独立QA：异常全部throw+db null明示中止，vB） |
| CR-0907-03 | P1 | `src/repository/store.js:336-366` | 同一新险种连续编辑时 `insertRateType` 仅以 `typeMeta[name]` 去重，在途 insert 未返回前第二次 `setRateCell` 会再次 `enqueue` 同名 insert（不同 `client_id`），云端产生重名 `rate_types` 行，前者成孤儿，`typeMeta` 被后者覆盖。 | VERIFY（已修复待独立QA：inFlightTypes去重+5分钟防卡死+refreshOne清标记，vB） |
| CR-0907-04 | P2 | `src/repository/store.js:345-350,419-429` | 删除与在途新增竞态：编辑→insert 在途→`deleteRateType` 清掉本地 `typeMeta/pendingCells`→insert `onDone` 又重建 `typeMeta[name]`，指向即将被队列中 delete 删掉的 serverId，后续写入拿 stale id。 | 待修复 |
| CR-0907-05 | P2 | `src/family-insurance-dashboard.html:780,840` + `store.js:491-505` | 备份把 `familyPolicies` 含 `_serverId/_revision` 原样恢复，且不含 `familyOutbox` 队列：换设备/云端已变后恢复，下次 `commit` 走 stale serverId 触发冲突弹框；残留 outbox 会把恢复前的旧操作重放到云端（复活已删记录）。 | 待修复 |
| CR-0907-06 | P2 | `src/family-insurance-dashboard.html:781-782,819-821` | 大备份性能/内存：`bufToB64/b64ToBuf` 逐字符拼接、`dataUrl` 内层 base64 + 整包密文外层 base64 双重膨胀（约 1.7x），50MB 上限下全量 `JSON.stringify+encrypt` 阻塞 UI，无进度提示，大附件可致长时间冻结甚至 OOM。 | 待修复 |
| CR-0907-07 | P3 | `Dockerfile:1-2,21-27` | 首行注释称“不含任何密钥”，但 publishable key 经 `COPY src/config.js` 实际进镜像（按 Supabase 模型可公开，但注释误导）；缺文件时构建错误为原生 `COPY failed`，不友好。构建上下文本身正确（`.dockerignore` 未排除 `src/config.js`，`.gitignore` 正确忽略不进 Git）。 | 待修复 |
| CR-0907-08 | P3 | `src/family-insurance-dashboard.html:812-813` | 弱密码旁路：少于 6 位仅 `confirm` 即可继续；PBKDF2-210k 对短密码的离线暴力破解仍可行；密码经 `prompt` 明文驻留内存。本地威胁模型下可接受，但应明示“忘密码 = 备份作废”与最低强度。 | 待修复 |
| CR-0907-09 | P3 | `src/repository/store.js:97-98` + HTML 5 处 `?v=` | 版本信标人工耦合（标题 `vB` ↔ 查询串 `20260907b` 大小写约定，本轮已同步无 skew），无自动化校验，易忘同步（HANDOFF 已立规矩，仍是人工约束）。 | 待修复 |
| CR-0907-10 | P3 | `src/family-insurance-dashboard.html:1070-1071` | `delRateType` 的旧版容错分支（`deleteRateType` 缺失时降级 `clearRateEntries`）会造成云地分歧：本地险种已删、云端 type 行残留，且无版本 skew 提示。`?v` 已同步故概率低。 | 待修复 |
| CR-0907-11 | P3 | `src/family-insurance-dashboard.html:1102` | 费率表 `onchange="setRateCell('${escapeHtml(p)}',…)"` 用 HTML 转义拼 JS 单引号字符串：`escapeHtml` 把 `'` 转为 `&#39;`，但 HTML 解析属性值时会将其解码回 `'`，被保人姓名含单引号（如 `O'Brien`，经 `addRatePerson`/保单 `insured` 用户可控输入）会导致该行 handler 语法错误、费率格无法编辑；构造 `');…;//` 则形成存储型 XSS（change 事件触发）。**非本轮引入**（该行本轮 diff 未动），本地单机威胁模型下影响有限；修复方向：改 `data-*` 属性 + `addEventListener`，或用 `JSON.stringify` 做 JS 字符串转义代替 `escapeHtml`。 | 待修复 |
| CR-0907-12 | P2 | `src/family-insurance-dashboard.html:847-848` | 恢复侧残留的静默跳过：`await openDB(); if(db){…}`——IndexedDB 不可用时直接跳过合同恢复，随后仍弹“加密恢复完成”。此时 localStorage 已是备份数据而合同仍是旧库（旧附件未丢失），但与确认框承诺的“N 个合同附件”不符，属 CR-0907-02 同类完整性误报的恢复侧残留（备份侧 `!db` 已修为 throw，恢复侧漏网）。修复方向：`if(!db)` 时 throw/弹框明示“合同附件未恢复”，或纳入 `failed[]` 同口径上报。 | VERIFY（已修复待独立QA：写库前先openDB，有附件无库则throw中止、数据未动，vC） |

### 待办（本轮后）

- P1 三项（CR-0907-01/02/03）已 VERIFY，转独立 QA 回归（合成数据 roundtrip + 失败注入：
  IDB 不可用 / 超 50MB 上限 / 损坏附件 / 错密码），回归通过前不得标 CLOSED。
- P2 转【修复】：CR-0907-04（删除与在途新增竞态，本轮未覆盖）、CR-0907-12（恢复侧 IDB 不可用静默跳过，本轮新增）。
- P3 与残留小项（CR-03 失败+TTL 窄窗口、CR-02 `getFile`-null 跳过、CR-07/08/09/10/11）按规则默认不自动修，由【修复】 triage。

### 已验证通过（不列为发现）

- `refreshOne('rateType', {client_id: cid}, null, name)` 修复正确：旧调用传字符串导致
  `fetchOne` 无过滤条件（查全表），新调用与 `repos.fetchOne(kind, {clientId})` 签名一致
  （`repos.js:105-113`、`store.js:464-481`）；双 `flushPendingCells` 幂等（先清空后重放）。
- 加密参数正确：PBKDF2-SHA256 210k + 每次随机 16B salt / 12B iv + AES-GCM-256 不可导出；
  错密码走 `decrypt throw → 密码不对或文件损坏`，无填充预言机；`restoreFile` 的 `kind` 校验可挡错文件。
- `setRateCell` 空值语义两端一致（HTML 传 `null`，store 转 `amount==null → delete`，无 entry 时不清零插入）。
  `deleteRateType` 先清 entry 再删 type 行，与串行 outbox（`outbox.js:50-74` 单在途 + FIFO）顺序一致，
  外键约束下顺序正确。
- `Dockerfile` 补 COPY 正确：`src/config.js → /config.js`、`src/repository/ → /repository/`，
  与 HTML 相对路径 `config.js?v=` / `repository/*.js?v=` 一致；5 处 `?v=20260907b` 与信标 `vB` 同步（本轮已重验）。
- 回归基线未破坏：Excel `importFile` 的 `accept=".json,.csv,.xls"` 未动（`.xlsx` 仍排除），
  模板导出链路未触碰；新增按钮位于可换行 `.actions`（`flex-wrap:wrap`，600px 下 `flex:1 1 auto`），
  无 A4 页面级横滑回归；`toast` 用 `textContent`，险种名无 XSS；`localStorage` 无键名改动，迁移兼容。
- `node --check`：`client.js/outbox.js/repos.js/store.js` + 内联脚本全过；`git diff --check` 通过。

## 历史（MVP 验收期间的审查发现，均已处置，无遗留）
MVP 期间（`docs/pm/PLAN.md` A1–A6）由独立审查提出 5 项发现，全部在交付前处置完毕，无未关闭项：

| 发现 | 处置 | 结果 |
|---|---|---|
| 模板自带“参考示例 / 1 / 2”三行会被当真实保单导入 | 采纳 | 导入时识别并跳过原样示例 / 占位行 |
| `initFilters` 每次刷新重复追加筛选项 | 采纳 | 重建选项并保留仍有效的当前筛选值 |
| 文件选择器允许 `.xlsx`，但实现只解析 SpreadsheetML `.xls` | 采纳 | 移除 `.xlsx`，与模板格式一致 |
| Excel 导入整表替换当前数据 | 不采纳 | 保留既有明确语义（新浏览器用填写后模板生成数据集） |
| 同时有保险期间和导入状态时，自动计算状态优先 | 不采纳 | 保险期间可计算时以日期状态为准；模板不含保险期间时仍采用导入状态 |
