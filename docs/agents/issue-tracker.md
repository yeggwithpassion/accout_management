# 需求跟踪器：本地 Markdown

Issue 和 PRD 以 markdown 文件形式存放在 `.scratch/` 目录下。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件：`.scratch/<feature-slug>/PRD.md`
- 实现 issue：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号
- Issue 文件顶部用 `Status:` 行记录当前状态（标签名称见 `docs/agents/triage-labels.md`）
- 讨论和对话记录追加到 `## Comments` 标题下方

## 当技能说"发布到需求跟踪器"

在 `.scratch/<feature-slug>/` 下创建新文件（目录不存在时先创建）。

## 当技能说"获取相关 ticket"

读取对应路径的文件。用户通常会直接提供文件路径或 issue 编号。
