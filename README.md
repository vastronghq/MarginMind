# Zotero MarginMind

<div align="center">
  <strong>
    <a href="README.md">English</a> | 
    <a href="docs/README.zh-CN.md">中文</a>
  </strong>
</div>

<br/>

Zotero plugin for discussing literature with AI in the sidebar. Select text to invoke explanation, critique, translation, and more.

[![zotero target version](https://img.shields.io/badge/Zotero-8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

## Changelog

### v1.2.1

- **chore**: bump max Zotero version to 9.\*

### v1.2.0

- **feat**: added session persistence. All chat histories are now automatically saved to a local SQLite database.
  > storage path\*\*: `marginmind/sessions.sqlite` within the Zotero data directory.

### v1.1.1

- **fix**: resolved an issue where content could not be copied in certain scenarios.

### v1.1.0

- **feat**: added **AI Configuration** import and export functionality, making it easier to sync API settings across different projects and devices.
- **feat**: **QuickAction** buttons now support custom Prompts to meet personalized needs.
- **feat**: increased **MinerU** parsing timeout to 10 minutes to support small and medium-sized book PDFs.
- **refactor**: refined the **Token calculation algorithm** to provide more accurate usage estimates.

### v1.0.0

- **feat**: initial release with basic features as follows:

## Demo

### AI Chat: Discuss Based on Literature Context

![ai_discussion](./docs/assets/ai_discussion.gif)

### PDF to Markdown Parsing for Context Injection

![pdf_parse_to_markdown](./docs/assets/pdf_parse_to_markdown.gif)

### Save Chat Messages as PDF Annotations

![save_chat_to_selected_text](./docs/assets/save_chat_to_selected_text.gif)

## What It Can Do

- **Sidebar Chat** — Click the toolbar icon to open the panel, automatically load the current literature's title, authors, abstract, and full-text PDF as context
- **Quick Text Actions** — Select text in the reader to pop up buttons for Explain / Critique / Bulletize / Translate
- **AI Annotations** — Chat responses can be saved directly as PDF annotations, with right-click mode selection
- **PDF → Markdown Parsing** — Built-in MinerU integration, parsed results are automatically cached and injected into conversations
- **Thinking Mode** — Automatically parse reasoning models' `<thinking>` tags
- **Multi-Preset Management** — Save multiple AI configurations for quick switching, supports 17+ OpenAI-compatible providers

## Installation

1. Download the `.xpi` file from [Releases](https://github.com/northword/MarginMind/releases)
2. Zotero → Tools → Add-ons → Gear icon → Install Add-on From File
3. Select the `.xpi` file and restart Zotero

## Usage

Select a literature item → Click the toolbar icon → Type your question in the sidebar input box, or click the quick question buttons that appear after selecting text in the reader

## Configuration

Edit → Settings → MarginMind:

- Enter API Key, Base URL, Model, etc. (OpenAI-compatible)
- MinerU API Key: Apply at [mineru.net/apiManage/token](https://mineru.net/apiManage/token)
- Save multiple presets for quick switching

## Build from Source

```bash
npm install
npm run build
```

Output is located at `.scaffold/build/marginmind-*.xpi`

## License

[AGPL-3.0](https://license/)
