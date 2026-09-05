# PLAN.md — 当前需求与验收

## 目标与验收

目标：保留现有用户改动，将指定的 `C:\Users\ZhuanZ\Desktop\家庭保单明细表模板.xls`
作为看板内置 Excel 模板，修通模板导出、填写后导入、添加保单后明细显示三条联动链路；
另由 Codex 单独完成随屏幕宽度变化的响应式布局。

| ID | 验收标准 | 预期证据 | 状态 |
|---|---|---|---|
| A1 | 新浏览器中点击“导出 Excel 模板”下载与指定源文件字节一致的 `.xls` | 文件名、大小、SHA256 | 已通过 |
| A2 | 指定模板填写后导入，受支持列正确映射，保单明细与汇总立即刷新 | 自动化解析 + 浏览器导入 | 已通过 |
| A3 | 点击“添加保单”填写并保存后，新记录立即显示在保单明细 | 浏览器表单、明细与 localStorage | 已通过 |
| A4 | 页面宽度不再固定为 1280px 上限；宽屏充分利用空间，窄屏不出现页面级横向溢出 | 1920px / 390px 浏览器视口 | 已通过 |
| A5 | 保留用户现有未提交变化，不提交、推送、发布或安装依赖 | Git diff/status 与边界检查 | 已通过 |
| A6 | Claude Code 对 A1-A3 做独立只读检查；响应式 A4 不派给 Claude Code | Orca Task/Dispatch/worker_done | 已通过 |

## 状态与文件边界

- 当前执行者：Codex
- 当前阶段：完成
- 协作级别：L1（Codex 实施；Claude Code 只读审查 A1-A3）
- 模板源：`C:\Users\ZhuanZ\Desktop\家庭保单明细表模板.xls`
- 模板基线：5417 bytes；SHA256 `B60855A242E1ECD23199D88ABDD29662025FCAD164A26AF8B2701C9B6ED53146`
- Codex 实际修改：`src/family-insurance-dashboard.html`、`scratch/_test_export.js`、`scratch/_test_csv.js`、本文件（`docs/pm/PLAN.md`）
- Claude Code 实际修改：无
- 外部操作：未提交、未推送、未发布、未安装依赖

## 基线与边界结果

- Git 分支：`main`。
- 开始时已有用户变化：`.gitignore`、`README.md`、`src/family-insurance-dashboard.html`
  已修改；`.gitattributes`、`AGENTS.md`、`CLAUDE.md`、`scratch/README1.md`、本文件（`docs/pm/PLAN.md`）、
  `scratch/_test_csv.js`、`scratch/_test_export.js`、`docs/`（现含 `pm/`、`roles/`、`qa/`、`review/`、`handoff/`）、`scratch/gen_svg.js` 未跟踪。
- 本轮在 `src/family-insurance-dashboard.html` 既有未提交变化上增量修改；未清理、回退或覆盖
  `.gitignore`、`README.md` 等用户变化。
- `git diff --check` 通过；最终 Git 状态没有提交或推送。

## Agent 与派工记录

| 尝试 | Task / Dispatch | 交付证据 | 结果与恢复 |
|---|---|---|---|
| 1 | Run `run_526303cce06f`; Task `task_b8a5b7aa1edb`; Dispatch `ctx_eedf091d170c` | Task/Dispatch 一致；当前 `=== TASK ===` 后出现读取与测试活动 | capability 有效的 `worker_done`：`msg_94c05543f6d6`；成功 |

- Claude Code 严格只读审查 A1-A3，未审查响应式 A4。
- `worker-release` 返回 `retained / user_takeover`，没有关闭或操作用户接管的终端。

## 审查发现处置

| 发现 | 处置 | 理由与结果 |
|---|---|---|
| 模板自带“参考示例 / 1 / 2”三行会被当真实保单导入 | 采纳 | 导入时识别并跳过原样示例/占位行；用户改写后正常导入 |
| `initFilters` 每次刷新重复追加筛选项 | 采纳 | 重建选项并保留仍有效的当前筛选值 |
| 文件选择器允许 `.xlsx`，但实现只解析 SpreadsheetML `.xls` | 采纳 | 移除 `.xlsx`，与指定模板格式一致 |
| Excel 导入整表替换当前数据 | 不采纳 | 本任务主流程是新浏览器用填写后的模板生成当前数据集；保留既有明确语义 |
| 同时有保险期间和导入状态时，自动计算状态优先 | 不采纳 | 保险期间可计算时应以日期状态为准；模板不含保险期间时仍采用导入状态 |

## 验证矩阵

| 验收项 | 证据类型 | 结果 |
|---|---|---|
| A1 | 自动化 + 浏览器实测 | 点击按钮后文件名 `家庭保单明细表模板.xls`；5417 bytes；SHA256 与源文件完全一致 |
| A2 | 自动化 + 浏览器实测 | 填写模板后导入 1 条；明细 1 行；`annualPremium=999`；提示“导入成功：1 条”；原样示例/占位行未导入 |
| A3 | 浏览器实测 | 新增后数据 1→2 条；明细立即显示；localStorage 已持久化；筛选项无重复 |
| A4 | 浏览器实测 | 1920px 视口 `.wrap=1905px`；390px 视口页面宽/滚动宽均 390px，KPI 单列 |
| A5 | 自动化 + Git 检查 | JS 语法、两个 Node 测试、`git diff --check` 通过；无越界外部操作 |
| A6 | Orca 编排记录 | Claude Code 只读审查完成，1 高 1 中 3 低发现均已处置 |

浏览器日志仅有缺失 favicon 的 404，不影响页面、模板、导入、添加或响应式功能。

## 最终结论

完成。A1-A6 均有证据并通过，Claude Code 发现已逐项处置；未提交、推送或发布。
