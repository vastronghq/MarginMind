# Zotero MarginMind

Zotero 插件，在侧边栏与 AI 讨论文献。选中文本即可调用解释、批判、翻译等功能。

[![zotero target version](https://img.shields.io/badge/Zotero-8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

## 更新日志

### v1.4.0

- **fix**: 默认折叠 thinking 部分。

### v1.3.0

- **feat**: 在消息泡泡下增加复制、重试、删除按钮，方便管理消息。
- **feat**: 实现对话输入框动态调整高度。
- **feat**: 增加 ModelScope AI 提供商支持。
- **fix**: 修复重渲染覆盖输入框草稿的 bug。
- **fix**: 修复 markdown 代码块渲染样式 bug。
- **refactor**: 简化 InputArea 中的按钮样式并改进布局换行。
- **refactor**: 从 SelectionModeBar、InputAreaProps、InputArea、SidebarPanel 中删除原 Delete 按钮相关的 props 和逻辑。
- **refactor**: 简化 InputArea.tsx 中 presets 选择框的实现方式。
- **refactor**: 注释掉 SidebarPanel 中的 requestError 显示。

### v1.2.1

- **chore**：将最大支持的 Zotero 版本提升至 9.\*

### v1.2.0

- **feat**：增加会话持久化功能。将所有对话记录保存至本地 SQLite 数据库。
  > **存储路径**：Zotero 数据目录下的 `marginmind/sessions.sqlite`。

### v1.1.1

- **fix**：解决了在某些场景下内容无法被复制的问题。

### v1.1.0

- **feat**：新增 **AI Configuration** 导入与导出功能，方便在不同项目、不同设备间同步API设置。
- **feat**：**QuickAction** 按钮支持自定义 Prompt，满足个性化需求。
- **feat**：增加**MinerU** 解析时间至 10 分钟，以应对中、小型图书 PDF。
- **refactor**：改进了 **Token 计数算法**，提供更准确的用量预估。

### v1.0.0

- **feat**：项目发布。基本功能如下：

## 功能演示

### AI 对话：基于文献上下文讨论

![ai_discussion](./assets/ai_discussion.gif)

### PDF 解析为 Markdown 注入上下文

![pdf_parse_to_markdown](./assets/pdf_parse_to_markdown.gif)

### 将对话消息保存为 PDF 批注

![save_chat_to_selected_text](./assets/save_chat_to_selected_text.gif)

## 能做什么

- **侧边栏对话** — 点击工具栏图标打开面板，自动载入当前文献的标题、作者、摘要和 PDF 全文作为上下文
- **文本快捷操作** — 阅读器中选中文本后弹出 Explain / Critique / Bulletize / Translate 按钮
- **AI 批注** — 对话回复可直接保存为 PDF 批注，右键选择模式
- **PDF → Markdown 解析** — 内置 MinerU 接入，解析结果自动缓存、自动注入对话
- **Thinking 模式** — 自动解析推理模型的 `<thinking>` 标签
- **多预设管理** — 保存多套 AI 配置快速切换，支持 17+ 兼容 OpenAI 协议的提供商

## 安装

1. 从 [Releases](https://github.com/northword/MarginMind/releases) 下载 `.xpi`
2. Zotero → 工具 → 附加组件 → 齿轮图标 → 从文件安装
3. 选择 `.xpi` 文件，重启 Zotero

## 使用

选中一篇文献 → 点击工具栏图标 → 在侧边栏输入问题。

在阅读器选中文本后弹出四个分析按钮，点击即可调用 AI。

## 配置

编辑 → 设置 → MarginMind：

- 填入 API Key、Base URL、Model 等参数（兼容 OpenAI 协议）
- MinerU API Key 前往 [mineru.net/apiManage/token](https://mineru.net/apiManage/token) 申请
- 可保存多套预设快速切换

## 从源码构建

```bash
npm install
npm run build
```

产物在 `.scaffold/build/marginmind-*.xpi`

## 许可证

[AGPL-3.0](LICENSE)
