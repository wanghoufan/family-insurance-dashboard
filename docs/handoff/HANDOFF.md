# 交接与历史协作协议（HANDOFF）

## 新会话接手指南（Neat-Freak 2026-08-17 整理）

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
