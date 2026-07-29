# DebugHalo

**DebugHalo** is an open-source, local-first developer tool that converts raw logs and stack traces into clean, structured, privacy-safe debugging bundles that can be shared with AI assistants or other developers.

## 🔒 Local-First & Privacy-Focused

- All processing happens locally on your machine
- No data is ever sent to external servers or APIs
- Sensitive information (PII, secrets, passwords) is automatically detected and masked before sharing
- Designed for secure debugging in sensitive environments

## 🚧 Current Status

This project is currently under active development. The core functionality for PII/secret detection and sanitization is planned for future phases.

## 📦 Installation

```bash
npm install debug-halo
```

## 🛠️ Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/debug-halo.git
   cd debug-halo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Available development scripts:
   - `npm run dev` - Start development mode with file watching
   - `npm run test` - Run tests
   - `npm run test:watch` - Run tests in watch mode
   - `npm run lint` - Run ESLint
   - `npm run lint:fix` - Run ESLint with auto-fix
   - `npm run format` - Format code with Prettier
   - `npm run format:check` - Check formatting with Prettier
   - `npm run typecheck` - Run TypeScript type checking
   - `npm run build` - Build production distribution
   - `npm run check` - Run all validation checks (format, lint, type, test, build)

## 🧪 Usage

```bash
# Basic usage (placeholder - functionality coming in Phase 2)
debug-halo scan ./logs
debug-halo sanitize ./src --dry-run
debug-halo init
```

## 📚 Documentation

- [Architecture Overview](#) - Coming soon
- [API Reference](#) - Coming soon
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 🔒 Security

Please review our [Security Policy](./SECURITY.md) for details on our security reporting procedures.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for secure, local-first debugging tools
- Built with TypeScript and Node.js
