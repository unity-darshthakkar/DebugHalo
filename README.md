# DebugHalo

**DebugHalo** is a pre-deployment PII/secret detox pipeline. It scans files for secrets and personally identifiable information (PII), and can sanitize them by replacing detected values with safe placeholders — all locally, with no data sent to external servers.

## 🔒 Local-First & Privacy-Focused

- All processing happens locally on your machine
- No data is ever sent to external servers or APIs
- Sensitive information (PII, secrets, passwords) is automatically detected and can be masked/sanitized
- Designed for secure debugging and preprocessing in sensitive environments

## 📦 Installation

```bash
# Clone and build locally
git clone https://github.com/yourusername/debug-halo.git
cd debug-halo
npm install
npm run build

# Run directly
node dist/cli/index.js scan .
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

3. Build the CLI:

   ```bash
   npm run build
   ```

4. Available development scripts:
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

## 🚀 Quick Start

```bash
# Initialize a config file in your project
debug-halo init

# Scan for secrets
debug-halo scan .

# Sanitize files (dry-run first to preview)
debug-halo sanitize . --dry-run

# Sanitize for real
debug-halo sanitize .
```

> **Note**: The examples above assume the CLI is in your PATH or you're using `node dist/cli/index.js` from the built project.

## 📖 Commands

### `debug-halo scan`

Scan files for secrets and PII.

```bash
debug-halo scan [paths...] [options]
```

**Options:**

| Option                       | Description                               | Default                           |
| ---------------------------- | ----------------------------------------- | --------------------------------- |
| `-e, --ext <extensions...>`  | File extensions to scan (space-separated) | All supported extensions          |
| `-i, --ignore <patterns...>` | Glob patterns to ignore (space-separated) | None (uses .gitignore + defaults) |
| `-o, --output <format>`      | Output format: `text` or `json`           | `text`                            |
| `--fail-on-findings`         | Exit with code 1 if any findings detected | `false`                           |
| `-c, --config <path>`        | Path to config file                       | Auto-discovered `.debughalo.json` |
| `-v, --verbose`              | Enable verbose output                     | `false`                           |

**Exit Codes:**

- `0` — Success, no findings (or findings found but `--fail-on-findings` not set)
- `1` — Findings detected and `--fail-on-findings` enabled
- `2` — Config error, invalid arguments, or scan failure

**Examples:**

```bash
# Scan current directory with text output
debug-halo scan

# Scan specific paths with JSON output
debug-halo scan src/ tests/ --output json

# Only scan TypeScript and JavaScript files
debug-halo scan --ext ts js

# Ignore specific patterns
debug-halo scan --ignore "**/*.min.js" "**/vendor/**"

# Fail CI if secrets found
debug-halo scan --fail-on-findings

# Use explicit config file
debug-halo scan --config ./configs/debug-halo.json
```

### `debug-halo sanitize`

Sanitize files by replacing detected secrets/PII with safe placeholders (e.g., `<API_KEY_ENV_1>`).

```bash
debug-halo sanitize [paths...] [options]
```

**Options:**

| Option                       | Description                                   | Default                           |
| ---------------------------- | --------------------------------------------- | --------------------------------- |
| `-e, --ext <extensions...>`  | File extensions to sanitize (space-separated) | All supported extensions          |
| `-i, --ignore <patterns...>` | Glob patterns to ignore (space-separated)     | None (uses .gitignore + defaults) |
| `--dry-run`                  | Preview changes without writing files         | `false`                           |
| `-c, --config <path>`        | Path to config file                           | Auto-discovered `.debughalo.json` |
| `-v, --verbose`              | Enable verbose output                         | `false`                           |

**Exit Codes:**

- `0` — Success, no files changed
- `1` — Files were modified (or would be modified in dry-run)
- `2` — Config error, invalid arguments, or sanitization failure

**Examples:**

```bash
# Preview what would change
debug-halo sanitize . --dry-run

# Actually sanitize files
debug-halo sanitize .

# Only sanitize specific extensions
debug-halo sanitize --ext ts js --dry-run

# Ignore specific paths
debug-halo sanitize --ignore "**/generated/**"
```

### `debug-halo init`

Initialize a `.debughalo.json` configuration file in the current directory.

```bash
debug-halo init [options]
```

**Options:**

| Option        | Description                    |
| ------------- | ------------------------------ |
| `-f, --force` | Overwrite existing config file |

**Exit Codes:**

- `0` — Config file created successfully
- `2` — Config file already exists (use `--force` to overwrite) or write error

### `debug-halo version`

Display version information.

```bash
debug-halo version
```

## ⚙️ Configuration

DebugHalo uses a `.debughalo.json` file in your project root (or a custom path via `--config`).

### Config Schema

```json
{
  "extensions": ["ts", "tsx", "js", "jsx", "json", "yaml", "yml", "env"],
  "ignorePatterns": ["node_modules/**", "dist/**", ".git/**"],
  "outputFormat": "text",
  "failOnFindings": false
}
```

### Config Fields

| Field            | Type               | Default                                             | Description                           |
| ---------------- | ------------------ | --------------------------------------------------- | ------------------------------------- |
| `extensions`     | `string[]`         | `["ts","tsx","js","jsx","json","yaml","yml","env"]` | File extensions to process            |
| `ignorePatterns` | `string[]`         | `["node_modules/**","dist/**",".git/**"]`           | Glob patterns to ignore               |
| `outputFormat`   | `"text" \| "json"` | `"text"`                                            | Default output format for `scan`      |
| `failOnFindings` | `boolean`          | `false`                                             | Default for `scan --fail-on-findings` |

> **Note**: `--dry-run` is a `sanitize`-only CLI flag and is not stored in the config file.

### Config Precedence

Options are resolved in this order (highest priority last):

1. **Built-in defaults** (see table above)
2. **`.debughalo.json`** in the current working directory (auto-discovered)
3. **Explicit `--config <path>`** file
4. **Explicit CLI options** (e.g., `--ext`, `--ignore`, `--output`, `--fail-on-findings`, `--dry-run`)

> **Note**: Only explicitly provided CLI options override config. Empty arrays or undefined values from CLI are ignored.

### Example Config

```json
{
  "extensions": ["ts", "js", "json"],
  "ignorePatterns": ["**/*.min.js", "**/vendor/**", "coverage/**"],
  "outputFormat": "json",
  "failOnFindings": true
}
```

## 🔍 Supported Detectors

DebugHalo detects various secret types and PII categories:

| Category               | Description                   | Example                                    |
| ---------------------- | ----------------------------- | ------------------------------------------ |
| `api_key`              | Generic API keys              | `sk-123...`                                |
| `stripe_key`           | Stripe API keys               | `sk_live_...`                              |
| `openai_key`           | OpenAI API keys               | `sk-...`                                   |
| `anthropic_key`        | Anthropic API keys            | `sk-ant-...`                               |
| `slack_token`          | Slack OAuth tokens            | `xoxb-...`                                 |
| `github_token`         | GitHub personal access tokens | `ghp_...`                                  |
| `private_key`          | PEM private keys              | `-----BEGIN PRIVATE KEY-----`              |
| `ssh_private_key`      | SSH private keys              | `-----BEGIN OPENSSH PRIVATE KEY-----`      |
| `pgp_private_key`      | PGP private keys              | `-----BEGIN PGP PRIVATE KEY BLOCK-----`    |
| `bearer_token`         | Bearer tokens in headers      | `Authorization: Bearer xyz`                |
| `basic_auth`           | Basic auth in headers         | `Authorization: Basic dXNlcjpwYXNz`        |
| `authorization_header` | Generic auth headers          | `Authorization: abc123`                    |
| `api_key_env`          | API keys in env assignments   | `API_KEY=sk-...`                           |
| `secret_env`           | Generic secrets in env        | `SECRET=xyz`                               |
| `password_env`         | Passwords in env              | `PASSWORD=secret`                          |
| `password_config`      | Passwords in config files     | `password: "secret"`                       |
| `postgres_url`         | PostgreSQL URLs               | `postgres://user:pass@host/db`             |
| `mysql_url`            | MySQL URLs                    | `mysql://user:pass@host/db`                |
| `mongodb_url`          | MongoDB URLs                  | `mongodb://user:pass@host/db`              |
| `redis_url`            | Redis URLs                    | `redis://user:pass@host:6379`              |
| `database_url`         | Generic database URLs         | `db://user:pass@host/db`                   |
| `aws_secret_key`       | AWS secret access keys        | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `aws_access_key`       | AWS access key IDs            | `AKIAIOSFODNN7EXAMPLE`                     |
| `jwt`                  | JSON Web Tokens               | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  |
| `email`                | Email addresses               | `user@example.com`                         |
| `ip_address`           | IPv4/IPv6 addresses           | `192.168.1.1`, `2001:db8::1`               |
| `internal_url`         | Internal/private URLs         | `http://internal.corp/service`             |
| `internal_domain`      | Internal domain names         | `internal.corp`, `server.local`            |
| `generic_secret`       | Generic high-entropy strings  | `x7k9m2p4q8r1s3t5v7y9`                     |

> **Note**: The type system defines additional categories (e.g., `aws_session_token`, `gitlab_token`, `discord_token`, `stripe_webhook_secret`, `sendgrid_api_key`, `generic_token`, `password`, `phone`, `ssn`, `credit_card`, `localhost_url`) that are not yet backed by active detectors. Only categories listed above are actively detected.

## 🛡️ Safety Features

- **No raw secrets in output**: Both text and JSON output redact secret values (showing only previews like `sk***78`)
- **Binary file skipping**: Files containing NUL bytes are automatically skipped
- **`.gitignore` respected**: Patterns from local `.gitignore` are automatically applied
- **Default exclusions**: `.git/**`, `node_modules/**`, `dist/**`, `coverage/**` are always ignored
- **Dry-run mode**: Preview sanitization changes before applying

## 📊 Exit Codes

All commands follow consistent exit codes:

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | Success (no findings, or no files changed)                                  |
| `1`  | Findings detected (`scan --fail-on-findings`) or files changed (`sanitize`) |
| `2`  | Error: invalid config, missing file, bad arguments, or processing failure   |

## 🧪 CI/CD Integration

```yaml
# GitHub Actions example (run from built project)
- name: DebugHalo Scan
  run: node dist/cli/index.js scan --fail-on-findings --output json
```

Use `--output json` for machine-parsable results and `--fail-on-findings` to fail the build on detections.

## 🚫 Current Limitations

- **No SARIF output** — JSON and text only
- **No restoration/backup** — Sanitize modifies files in-place; use version control
- **No vault persistence** — Sanitization mappings are not stored across runs
- **No YAML config** — Only `.debughalo.json` supported
- **No Chrome extension** — CLI only
- **No AI integrations** — Standalone detector/sanitizer
- **Limited detector set** — Covers common secret types; not exhaustive
- **No incremental scanning** — Full scan each run

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) — planned
- [API Reference](./docs/API.md) — planned
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 🔒 Security

Please review our [Security Policy](./SECURITY.md) for details on our security reporting procedures.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for secure, local-first secret detection and sanitization
- Built with TypeScript and Node.js
