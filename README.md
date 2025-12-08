<div align="center">
    <img src="./icons/stable/neko_cnl.svg" alt="Neko Logo" width="128"/>
    <h1>Neko</h1>
    <p>AI 驱动的智能代码编辑器</p>
</div>

<p align="center">
    <a href="https://github.com/GitNekoTeam/neko/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License"/>
    </a>
    <a href="https://github.com/GitNekoTeam/neko/actions/workflows/stable-linux.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/GitNekoTeam/neko/stable-linux.yml?branch=main&label=Linux" alt="Linux Build"/>
    </a>
    <a href="https://github.com/GitNekoTeam/neko/actions/workflows/stable-macos.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/GitNekoTeam/neko/stable-macos.yml?branch=main&label=macOS" alt="macOS Build"/>
    </a>
    <a href="https://github.com/GitNekoTeam/neko/actions/workflows/stable-windows.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/GitNekoTeam/neko/stable-windows.yml?branch=main&label=Windows" alt="Windows Build"/>
    </a>
    <a href="https://github.com/GitNekoTeam/neko/releases">
        <img src="https://img.shields.io/github/v/release/GitNekoTeam/neko?label=Release" alt="Release"/>
    </a>
</p>

<p align="center">
    <a href="./README_EN.md">English</a> | 简体中文
</p>

---

## 关于

Neko 是一款基于 [VSCodium](https://github.com/VSCodium/vscodium) 构建的开源 AI 代码编辑器。它将强大的代码编辑能力与先进的 AI 辅助功能相结合，为开发者提供智能化的编程体验。

## 核心功能

### AI 智能助手

- **多模型支持**: 支持 16+ AI 提供商，包括 OpenAI、Anthropic、Ollama、Azure、Gemini、DeepSeek、Mistral、Groq、xAI、Bedrock、Cohere、Together、Moonshot、Qwen 等
- **自定义提供商**: 支持配置任意兼容 OpenAI API 的服务端点
- **流式响应**: 实时流式输出，提供流畅的交互体验

### 代码理解

- **语义索引**: 基于嵌入模型的代码库语义索引，实现深度代码理解
- **上下文感知**: 智能识别当前编辑上下文，提供精准的代码建议
- **符号搜索**: 快速定位函数、类、变量等代码符号

### 智能编辑

- **Tab 补全**: AI 驱动的智能内联代码补全
- **范围化变更**: 使用自然语言描述进行定向代码编辑
- **代码重构**: 智能代码重构、优化和文档生成
- **Diff 预览**: 变更前后对比预览，一键应用或撤销

### 开发工具

- **终端集成**: 智能终端命令执行，支持超时自动终止
- **浏览器调试**: Chrome DevTools 集成，可视化调试和布局验证
- **Git 集成**: AI 生成提交信息，智能代码审查
- **MCP 支持**: Model Context Protocol 服务器集成

### 多语言支持

内置 22 种语言本地化支持：

简体中文、繁体中文、English、日本语、한국어、Deutsch、Francais、Espanol、Portugues、Italiano、Nederlands、Polski、Русский、Turkce、العربية、हिन्दी、ไทย、Tieng Viet、Bahasa Indonesia、Cestina、Catala、Українська

## 下载安装

从 [GitHub Releases](https://github.com/GitNekoTeam/neko/releases) 下载最新版本，或访问[官方网站](https://gitneko.com/editor/download)。

### 支持平台

| 平台 | 架构 | 安装包格式 |
|------|------|-----------|
| macOS | ARM64 / x64 / Universal | DMG, ZIP |
| Linux | x64 / ARM64 | DEB, RPM, AppImage, tar.gz |
| Windows | x64 / ARM64 | 系统安装程序, 用户安装程序, ZIP |

## 快速开始

### 1. 配置 AI 提供商

打开设置 (`Ctrl+,` / `Cmd+,`)，搜索 `Neko AI`：

```json
{
    "neko-ai.provider": "openai",
    "neko-ai.apiKey": "your-api-key",
    "neko-ai.model": "gpt-4o"
}
```

### 2. 开始对话

- 使用快捷键 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板
- 输入 `Neko: Open Chat` 打开 AI 对话面板
- 或点击侧边栏的 Neko 图标

### 3. 使用内联补全

在编辑器中输入代码时，AI 会自动提供补全建议，按 `Tab` 键接受建议。

## 配置选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `neko-ai.provider` | AI 提供商 | `openai` |
| `neko-ai.apiKey` | API 密钥 | - |
| `neko-ai.apiEndpoint` | 自定义 API 端点 | - |
| `neko-ai.model` | 聊天模型 | - |
| `neko-ai.completionModel` | 补全模型 | - |
| `neko-ai.embeddingModel` | 嵌入模型 | - |
| `neko-ai.temperature` | 生成温度 | `0.7` |
| `neko-ai.maxTokens` | 最大 Token 数 | `4096` |
| `neko-ai.timeout` | 命令超时(秒) | `120` |
| `neko-ai.enableCompletion` | 启用内联补全 | `true` |
| `neko-ai.enableIndexing` | 启用代码索引 | `false` |
| `neko-ai.enableBrowser` | 启用浏览器集成 | `false` |
| `neko-ai.debugPort` | Chrome 调试端口 | `9222` |
| `neko-ai.locale` | 界面语言 | 系统语言 |

## 从源码构建

### 环境要求

- Node.js 20+
- npm 10+
- Python 3.11+
- Git

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/GitNekoTeam/neko.git
cd neko

# 构建
./build.sh
```

详细构建说明请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 项目结构

```
neko/
├── build/              # 构建脚本
├── extensions/
│   └── neko-ai/        # AI 扩展
│       ├── src/
│       │   ├── api/        # API 提供商
│       │   ├── core/       # 核心模块
│       │   ├── services/   # 服务层
│       │   ├── integrations/ # 集成模块
│       │   ├── i18n/       # 国际化
│       │   └── utils/      # 工具函数
│       └── webview-ui/     # WebView 界面
├── icons/              # 应用图标
├── patches/            # 补丁文件
└── src/                # VSCodium 定制
```

## 贡献指南

欢迎贡献代码！请在提交 Pull Request 之前：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细的贡献流程。

## 致谢

本项目基于以下开源项目构建：

- [VSCodium](https://github.com/VSCodium/vscodium) (MIT) - 开源 VS Code 构建
- [Kilocode](https://github.com/Kilo-Org/kilocode) (Apache-2.0) - AI 编程助手参考
- [Cursor](https://github.com/getcursor/cursor) - AI 代码助手功能参考
- [Chrome DevTools MCP](https://github.com/AntGroupOpenSource/chrome-devtools-mcp) (Apache-2.0) - 浏览器调试集成

## 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 许可证。

---

<p align="center">
    <a href="https://gitneko.com">官方网站</a> |
    <a href="https://github.com/GitNekoTeam/neko/issues">问题反馈</a> |
    <a href="https://github.com/GitNekoTeam/neko/discussions">社区讨论</a>
</p>
