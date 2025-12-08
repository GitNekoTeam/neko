<div align="center">
    <img src="./icons/stable/neko_cnl.svg" alt="Neko Logo" width="128"/>
    <h1>Neko</h1>
    <p>AI-Powered Intelligent Code Editor</p>
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
    English | <a href="./README.md">简体中文</a>
</p>

---

## About

Neko is an open-source AI code editor built on [VSCodium](https://github.com/VSCodium/vscodium). It combines powerful code editing capabilities with advanced AI assistance features to provide developers with an intelligent programming experience.

## Key Features

### AI Assistant

- **Multi-Model Support**: 16+ AI providers including OpenAI, Anthropic, Ollama, Azure, Gemini, DeepSeek, Mistral, Groq, xAI, Bedrock, Cohere, Together, Moonshot, Qwen, and more
- **Custom Providers**: Configure any OpenAI API-compatible endpoint
- **Streaming Response**: Real-time streaming output for smooth interaction

### Code Understanding

- **Semantic Indexing**: Embedding-based codebase semantic indexing for deep code comprehension
- **Context Awareness**: Intelligent recognition of current editing context for precise suggestions
- **Symbol Search**: Quick navigation to functions, classes, variables, and other code symbols

### Intelligent Editing

- **Tab Completion**: AI-powered inline code completion
- **Scoped Changes**: Natural language-driven targeted code editing
- **Code Refactoring**: Intelligent refactoring, optimization, and documentation generation
- **Diff Preview**: Before/after comparison preview with one-click apply or revert

### Development Tools

- **Terminal Integration**: Smart terminal command execution with automatic timeout
- **Browser Debugging**: Chrome DevTools integration for visual debugging and layout verification
- **Git Integration**: AI-generated commit messages and intelligent code review
- **MCP Support**: Model Context Protocol server integration

### Localization

Built-in support for 22 languages:

English, Simplified Chinese, Traditional Chinese, Japanese, Korean, German, French, Spanish, Portuguese, Italian, Dutch, Polish, Russian, Turkish, Arabic, Hindi, Thai, Vietnamese, Indonesian, Czech, Catalan, Ukrainian

## Download

Download the latest release from [GitHub Releases](https://github.com/GitNekoTeam/neko/releases) or visit our [official website](https://gitneko.com/editor/download).

### Supported Platforms

| Platform | Architecture | Package Format |
|----------|-------------|----------------|
| macOS | ARM64 / x64 / Universal | DMG, ZIP |
| Linux | x64 / ARM64 | DEB, RPM, AppImage, tar.gz |
| Windows | x64 / ARM64 | System Installer, User Installer, ZIP |

## Quick Start

### 1. Configure AI Provider

Open Settings (`Ctrl+,` / `Cmd+,`) and search for `Neko AI`:

```json
{
    "neko-ai.provider": "openai",
    "neko-ai.apiKey": "your-api-key",
    "neko-ai.model": "gpt-4o"
}
```

### 2. Start Chatting

- Use `Ctrl+Shift+P` / `Cmd+Shift+P` to open the Command Palette
- Type `Neko: Open Chat` to open the AI chat panel
- Or click the Neko icon in the sidebar

### 3. Use Inline Completion

As you type code in the editor, AI will automatically provide completion suggestions. Press `Tab` to accept.

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `neko-ai.provider` | AI provider | `openai` |
| `neko-ai.apiKey` | API key | - |
| `neko-ai.apiEndpoint` | Custom API endpoint | - |
| `neko-ai.model` | Chat model | - |
| `neko-ai.completionModel` | Completion model | - |
| `neko-ai.embeddingModel` | Embedding model | - |
| `neko-ai.temperature` | Generation temperature | `0.7` |
| `neko-ai.maxTokens` | Maximum tokens | `4096` |
| `neko-ai.timeout` | Command timeout (seconds) | `120` |
| `neko-ai.enableCompletion` | Enable inline completion | `true` |
| `neko-ai.enableIndexing` | Enable code indexing | `false` |
| `neko-ai.enableBrowser` | Enable browser integration | `false` |
| `neko-ai.debugPort` | Chrome debug port | `9222` |
| `neko-ai.locale` | UI language | System language |

## Build from Source

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Git

### Build Steps

```bash
# Clone the repository
git clone https://github.com/GitNekoTeam/neko.git
cd neko

# Build
./build.sh
```

For detailed build instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Project Structure

```
neko/
├── build/              # Build scripts
├── extensions/
│   └── neko-ai/        # AI extension
│       ├── src/
│       │   ├── api/        # API providers
│       │   ├── core/       # Core modules
│       │   ├── services/   # Service layer
│       │   ├── integrations/ # Integration modules
│       │   ├── i18n/       # Internationalization
│       │   └── utils/      # Utility functions
│       └── webview-ui/     # WebView UI
├── icons/              # Application icons
├── patches/            # Patch files
└── src/                # VSCodium customization
```

## Contributing

Contributions are welcome! Before submitting a Pull Request:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Acknowledgments

This project is built upon the following open-source projects:

- [VSCodium](https://github.com/VSCodium/vscodium) (MIT) - Open-source VS Code build
- [Kilocode](https://github.com/Kilo-Org/kilocode) (Apache-2.0) - AI programming assistant reference
- [Cursor](https://github.com/getcursor/cursor) - AI code assistant feature reference
- [Chrome DevTools MCP](https://github.com/AntGroupOpenSource/chrome-devtools-mcp) (Apache-2.0) - Browser debugging integration

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

---

<p align="center">
    <a href="https://gitneko.com">Official Website</a> |
    <a href="https://github.com/GitNekoTeam/neko/issues">Report Issues</a> |
    <a href="https://github.com/GitNekoTeam/neko/discussions">Discussions</a>
</p>
