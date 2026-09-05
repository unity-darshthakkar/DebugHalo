# DebugHalo

**DebugHalo** is a pre-deployment PII/secret detox pipeline. It scans files for secrets and personally identifiable information (PII), and can sanitize them by replacing detected values with safe placeholders. DebugHalo performs this processing locally and has no runtime telemetry or network integration.

## 🔒 Local-First & Privacy-Focused

- All processing happens locally on your machine
- The scanner and sanitizer do not send file contents to external servers or APIs
- Sensitive information (PII, secrets, passwords) is automatically detected and can be masked/sanitized
- Designed for secure debugging and preprocessing in sensitive environments

## 📦 Installation

DebugHalo requires Node.js 20 or newer. Install the package globally to use the
`debug-halo` command:

```bash
npm install --global debug-halo
debug-halo --version
```

To build the current source checkout instead:

```bash
# Clone and build locally
git clone https://github.com/unity-darshthakkar/DebugHalo.git
cd DebugHalo
npm ci
npm run build

# Run directly
node dist/cli/index.js scan .
```

## 🛠️ Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/unity-darshthakkar/DebugHalo.git
   cd DebugHalo
   ```

2. Install dependencies:

   ```bash
   npm ci
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

## Package API

DebugHalo is an ECMAScript module. Import the public core API from the package root:

```js
import { detectOnly, quickSanitize } from 'debug-halo';

const findings = await detectOnly('Contact user@example.com');
const sanitized = await quickSanitize('Contact user@example.com');
```

TypeScript declarations are included. CommonJS `require()` is not a supported entry point.

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
| `-f, --format <format>`      | `text`, `json`, `jsonl`, or `sarif`       | `text`                            |
| `-o, --output <path>`        | Write machine output to a file            | Standard output                   |
| `--fail-on-findings`         | Exit with code 1 if any findings detected | `false`                           |
| `--staged`                   | Scan staged Git index content only        | `false`                           |
| `--cache`                    | Reuse unchanged filesystem scan results   | `false`                           |
| `-q, --quiet`                | Suppress nonessential text output         | `false`                           |
| `--no-color`                 | Disable ANSI color output                 | `false`                           |
| `-c, --config <path>`        | Path to config file                       | Auto-discovered `.debughalo.json` |
| `-v, --verbose`              | Enable verbose output                     | `false`                           |

**Exit Codes:**

- `0` — Success, no findings (or findings found but `--fail-on-findings` not set)
- `1` — Findings detected and `--fail-on-findings` enabled
- `2` — Usage, config, discovery, processing, or internal failure

**Examples:**

```bash
# Scan current directory with text output
debug-halo scan

# Scan specific paths with JSON output
debug-halo scan src/ tests/ --format json

# Legacy JSON format selection remains supported
debug-halo scan src/ tests/ --output json

# Write SARIF without mixing human text into the file
debug-halo scan . --format sarif --output debughalo.sarif

# Only scan TypeScript and JavaScript files
debug-halo scan --ext ts js

# Ignore specific patterns
debug-halo scan --ignore "**/*.min.js" "**/vendor/**"

# Fail CI if secrets found
debug-halo scan --fail-on-findings

# Use explicit config file
debug-halo scan --config ./configs/debug-halo.json

# Scan exactly what is staged for the next commit
debug-halo scan --staged --fail-on-findings

# Opt into the local incremental cache for a large repository
debug-halo scan . --cache
```

With `--staged`, DebugHalo finds the repository root and reads regular-file snapshots directly
from Git's index. Deleted files, unstaged edits, and untracked files are excluded; rename and copy
destinations are scanned. Existing extension, `.debughaloignore`, suppression, confidence,
category, structured-output, quiet, color, and exit-code behavior still applies. No staged files is
a clean successful scan.

For normal filesystem scans, DebugHalo reads files through a bounded pool of at most four workers
and restores deterministic file and finding order before rendering results. Interactive text-mode
scans report progress every 100 completed files on a TTY. Progress is disabled for quiet mode,
redirected/non-TTY output, and JSON, JSONL, or SARIF output. The final text summary always reports
discovered, scanned, skipped, failed, and finding counts; scans with findings also group them by
severity and category.

The incremental cache is deliberately opt-in and is not used for `--staged`. With `--cache`, it is
stored at `.debughalo/cache.json`, which normal discovery excludes. Each reusable entry requires an
exact schema version, detection-configuration fingerprint, normalized path, byte size, modification
time, and SHA-256 content hash match. Cached finding metadata omits raw values, previews, snippets,
and source content. The hash is for change detection, not cryptographic integrity; a malformed,
incompatible, or differently configured cache is safely rebuilt. Inspect or remove it with:

```bash
debug-halo cache status
debug-halo cache clear
```

Changing `minConfidence` or `disabledCategories` invalidates the cache. Presentation-only options
such as color do not. For large repositories, start with the default bounded concurrency and opt
into `--cache` when the local metadata file is acceptable.

### `debug-halo hook`

Manage a non-interactive pre-commit guard for the current repository:

```bash
npx debug-halo hook install
npx debug-halo hook status
npx debug-halo hook uninstall
```

The managed hook invokes the project-local `node_modules/.bin/debug-halo` with `scan --staged
--fail-on-findings`. It blocks commits on findings or processing failures, never sanitizes or
modifies files, and never prints raw values. Installation uses Git's resolved hooks directory,
including `core.hooksPath`, and creates that directory when needed.

Installation and removal are idempotent. DebugHalo refuses to overwrite an unrelated existing
`pre-commit` hook. Uninstall removes only an exact DebugHalo-managed hook; unexpected additional or
malformed managed content is left untouched with an error.

Recommended workflow:

```bash
npm install --save-dev --save-exact debug-halo
npx debug-halo hook install
git add .
git commit -m "example"
```

If findings exist, the commit is blocked before completion. Run `npx debug-halo scan --staged` to
review them. DebugHalo does not automatically sanitize staged content.

If a Git command reports that no repository is available, run it from inside the intended working
tree. Use `git config --get core.hooksPath` and `npx debug-halo hook status` when troubleshooting a
custom hooks directory. If status reports an unrelated hook, integrate the tools manually rather
than replacing that hook.

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
| `-o, --output <path>`        | Write one sanitized copy; keep source intact  | None                              |
| `--output-dir <path>`        | Write sanitized copies beneath a directory    | None                              |
| `--vault <path>`             | Persist mappings for reversible sanitization  | User-local vault for copy outputs |
| `-c, --config <path>`        | Path to config file                           | Auto-discovered `.debughalo.json` |
| `-v, --verbose`              | Enable verbose output                         | `false`                           |

**Exit Codes:**

- `0` — Success, no files changed
- `1` — Files were modified (or would be modified in dry-run)
- `2` — Usage, config, discovery, processing, or internal failure

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

# Create a reversible copy without changing the source
debug-halo sanitize error.log --output error.sanitized.log
```

Copy output enables vault persistence automatically. Multiple inputs require `--output-dir`; a
single `--output` is rejected when discovery produces more than one file. Output paths may not be
the source path. In-place sanitization is irreversible unless `--vault` is explicitly supplied;
use a dry run and version control before changing important files.

### `debug-halo restore`

Restore aliases known to the local vault. Unknown aliases remain unchanged and are counted.

```bash
debug-halo restore debughalo-output/error.sanitized.log
debug-halo restore debughalo-output --dry-run
debug-halo restore copy.log --vault .debughalo/vault.json
```

Restore uses the same protected replacement writes as in-place sanitization. Exit code `1` means
files were restored (or would be restored during dry-run), `0` means no changes, and `2` means a
processing failure. Original values are never printed.

### `debug-halo share`

Create local sanitized copies, persist their mappings, and rescan the copies before reporting them
ready to share. This command never uploads, transmits, or sends files.

```bash
debug-halo share error.log
# Produces debughalo-output/error.sanitized.log

debug-halo restore debughalo-output/error.sanitized.log
```

The original files remain unchanged. `share` exits with code `2` and does not claim success if file
processing fails or the validation scan finds active findings.

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
  "failOnFindings": false,
  "dryRun": false,
  "minConfidence": 0.5,
  "disabledCategories": [],
  "outputDirectory": "debughalo-output"
}
```

### Config Fields

| Field                | Type                                     | Default                                             | Description                           |
| -------------------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| `extensions`         | `string[]`                               | `["ts","tsx","js","jsx","json","yaml","yml","env"]` | File extensions to process            |
| `ignorePatterns`     | `string[]`                               | `["node_modules/**","dist/**",".git/**"]`           | Glob patterns to ignore               |
| `outputFormat`       | `"text" \| "json" \| "jsonl" \| "sarif"` | `"text"`                                            | Default output format for `scan`      |
| `failOnFindings`     | `boolean`                                | `false`                                             | Default for `scan --fail-on-findings` |
| `dryRun`             | `boolean`                                | `false`                                             | Default dry-run mode for `sanitize`   |
| `minConfidence`      | `number`                                 | `0.5`                                               | Minimum accepted confidence (`0`–`1`) |
| `disabledCategories` | `string[]`                               | `[]`                                                | Categories to suppress                |
| `vaultPath`          | `string`                                 | `""` (user-local vault for copy/share workflows)    | Local plaintext alias vault path      |
| `outputDirectory`    | `string`                                 | `"debughalo-output"`                                | Default `share` output directory      |

> **Note**: `debug-halo init` omits `dryRun` from the generated file, so sanitization writes by default. You can add `"dryRun": true` to configuration or pass `--dry-run` on the command line.

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
  "failOnFindings": true,
  "dryRun": true,
  "minConfidence": 0.85,
  "disabledCategories": ["email", "ip_address"],
  "vaultPath": ".debughalo/vault.json",
  "outputDirectory": "debughalo-output"
}
```

### Reversible sanitization and vault safety

The vault is an auditable JSON document containing only alias mappings and their category/count
metadata. It is local persistence, **not encryption and not a secrets manager**: anyone who can
read the vault can read the original values. When persistence is enabled without a configured path,
DebugHalo uses `~/.debughalo/vault.json`, outside the project. A configured project-local vault is accepted only beneath `.debughalo/`, which DebugHalo
always excludes from discovery. Keep that directory out of source control and protect it with
normal operating-system file permissions. Vault parsing errors never include stored secret values.
For persisted sanitization, DebugHalo verifies the vault can be written before modifying files and
persists new mappings before each changed file write, so a vault failure cannot strand a newly
sanitized file without its restoration mapping.

### False-positive controls

- Add file globs to `.debughaloignore` using the same gitignore-style syntax as `.gitignore`.
- Disable specific categories with `disabledCategories` in `.debughalo.json`.
- Raise `minConfidence` when only high-confidence findings are desired.
- Add `debughalo-ignore` on a source line to suppress detections on that line.
- Add `debughalo-ignore-next-line` on the preceding line to suppress the next source line.
- Append a category, such as `debughalo-ignore google_api_key`, to limit an inline suppression.
- Obvious service-credential placeholders containing markers such as `example`, `placeholder`, or `changeme` are suppressed automatically.

Inline suppression comments are explicit source directives; use them only for reviewed values that are safe to retain.

## Severity levels

Every finding includes deterministic `severity`, `confidence`, `detector`, `reason`, and `likelyTestValue` fields in JSON output. Text output shows severity and confidence; verbose text output also shows the reason.

| Severity   | Intended meaning                                                  |
| ---------- | ----------------------------------------------------------------- |
| `critical` | Directly usable private keys or high-impact service secrets       |
| `high`     | Access tokens, credentials, and authenticated service identifiers |
| `medium`   | Context-dependent or generic secret material                      |
| `low`      | PII or internal-network indicators with lower credential impact   |

## 🔍 Supported Detectors

DebugHalo detects various secret types and PII categories:

| Category                | Description                     | Example                                    |
| ----------------------- | ------------------------------- | ------------------------------------------ |
| `api_key`               | Generic API keys                | `sk-123...`                                |
| `stripe_key`            | Stripe API keys                 | `sk_live_...`                              |
| `openai_key`            | OpenAI API keys                 | `sk-...`                                   |
| `anthropic_key`         | Anthropic API keys              | `sk-ant-...`                               |
| `google_api_key`        | Google API keys                 | `AIza...`                                  |
| `gitlab_token`          | GitLab access tokens            | `glpat-...`                                |
| `discord_token`         | Discord bot tokens              | Three-segment bot token                    |
| `stripe_webhook_secret` | Stripe webhook secrets          | `whsec_...`                                |
| `sendgrid_api_key`      | SendGrid API keys               | `SG....`                                   |
| `twilio_api_key`        | Twilio API key SIDs             | `SK...`                                    |
| `oauth_client_secret`   | Contextual OAuth client secrets | `OAUTH_CLIENT_SECRET=...`                  |
| `azure_client_secret`   | Contextual Azure client secrets | `AZURE_CLIENT_SECRET=...`                  |
| `slack_token`           | Slack OAuth tokens              | `xoxb-...`                                 |
| `github_token`          | GitHub personal access tokens   | `ghp_...`                                  |
| `private_key`           | PEM private keys                | `-----BEGIN PRIVATE KEY-----`              |
| `ssh_private_key`       | SSH private keys                | `-----BEGIN OPENSSH PRIVATE KEY-----`      |
| `pgp_private_key`       | PGP private keys                | `-----BEGIN PGP PRIVATE KEY BLOCK-----`    |
| `bearer_token`          | Bearer tokens in headers        | `Authorization: Bearer xyz`                |
| `basic_auth`            | Basic auth in headers           | `Authorization: Basic dXNlcjpwYXNz`        |
| `authorization_header`  | Generic auth headers            | `Authorization: abc123`                    |
| `api_key_env`           | API keys in env assignments     | `API_KEY=sk-...`                           |
| `secret_env`            | Generic secrets in env          | `SECRET=xyz`                               |
| `password_env`          | Passwords in env                | `PASSWORD=secret`                          |
| `password_config`       | Passwords in config files       | `password: "secret"`                       |
| `postgres_url`          | PostgreSQL URLs                 | `postgres://user:pass@host/db`             |
| `mysql_url`             | MySQL URLs                      | `mysql://user:pass@host/db`                |
| `mongodb_url`           | MongoDB URLs                    | `mongodb://user:pass@host/db`              |
| `redis_url`             | Redis URLs                      | `redis://user:pass@host:6379`              |
| `database_url`          | Generic database URLs           | `db://user:pass@host/db`                   |
| `aws_secret_key`        | AWS secret access keys          | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `aws_access_key`        | AWS access key IDs              | `AKIAIOSFODNN7EXAMPLE`                     |
| `jwt`                   | JSON Web Tokens                 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  |
| `email`                 | Email addresses                 | `user@example.com`                         |
| `ip_address`            | IPv4/IPv6 addresses             | `192.168.1.1`, `2001:db8::1`               |
| `internal_url`          | Internal/private URLs           | `http://internal.corp/service`             |
| `internal_domain`       | Internal domain names           | `internal.corp`, `server.local`            |
| `generic_secret`        | Generic high-entropy strings    | `x7k9m2p4q8r1s3t5v7y9`                     |

> **Note**: The type system defines additional categories (e.g., `aws_session_token`, `generic_token`, `password`, `phone`, `ssn`, `credit_card`, `localhost_url`) that are not yet backed by active detectors. Only categories listed above are actively detected.

## 🛡️ Safety Features

- **No raw secrets in output**: Text output never prints values; machine formats omit previews, source context, and raw offsets
- **Binary file skipping**: Files containing NUL bytes are automatically skipped
- **Bounded text input**: CLI filesystem and staged inputs use a 10 MiB byte limit; oversized UTF-8 files fail and are never silently truncated
- **`.gitignore` respected**: Patterns from local `.gitignore` are automatically applied
- **Dedicated ignore file**: `.debughaloignore` excludes tool-specific file globs without changing Git behavior
- **Default exclusions**: `.git/**`, `node_modules/**`, `dist/**`, `coverage/**` are always ignored
- **Dry-run mode**: Preview sanitization changes without writing files
- **Safer replacement**: Sanitized content is written to a temporary file in the same directory and atomically replaces the regular target; no persistent backup copy is created
- **Symlink refusal**: Sanitize refuses symbolic-link targets instead of replacing them or writing through them
- **Predictable scan symlinks**: Recursive discovery does not follow file or directory symlinks, preventing loops; an explicitly named file symlink is read-only scan input, while broken links are rejected as missing

These safeguards reduce common write and input-handling risks, but they do not guarantee recovery from every operating-system, hardware, or filesystem failure. Use version control or another backup strategy before sanitizing important files.

## Structured scan output

`--format json` emits one object with `schemaVersion`, `summary`, `findings`, and `errors`.
Every finding contains only `file`, `category`, `detector`, `severity`, `confidence`, available
`line`/`column`, `reason`, and `likelyTestValue` fields.

`--format jsonl` emits one compact JSON object per line in deterministic order: zero or more
`finding` records, zero or more `error` records, and exactly one final `summary` record. Each record
has a `type` field; the summary also includes `schemaVersion`.

`--format sarif` emits SARIF 2.1.0. Stable rule IDs use `debughalo/<category>`. Severity maps as
follows: `critical` and `high` to `error`, `medium` to `warning`, and `low` to `note`. SARIF includes
file and available line/column locations but never snippets or secret-bearing context.

Machine formats never contain ANSI codes or original secret values. Add `--output <path>` with a
machine format to write through DebugHalo's protected output-file writer; stdout remains empty on
success. Without `--output`, the document is written to stdout. `--quiet` suppresses text results
but not errors or machine output, while `--no-color` guarantees plain text output.

## 📊 Exit Codes

All commands follow consistent exit codes:

| Code | Meaning                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| `0`  | Successful execution                                                                                                |
| `1`  | Intentional domain result: scan findings with `--fail-on-findings`, or files changed/would change during `sanitize` |
| `2`  | Usage, config, discovery, processing, or internal failure                                                           |

Any per-file processing failure produces exit code `2`, even when other files were processed successfully. Binary files are skipped rather than treated as processing failures.

## 🧪 CI/CD Integration

Add DebugHalo to the consuming project as an exact development dependency and commit the updated
manifest and lockfile. This makes `npm ci` install a predictable DebugHalo version in CI:

```bash
npm install --save-dev --save-exact debug-halo
git add package.json package-lock.json
```

```yaml
# Basic GitHub Actions gate after checkout/setup; npm ci installs the locked DebugHalo devDependency
- name: Install project dependencies, including DebugHalo
  run: npm ci
- name: DebugHalo Scan
  run: npx debug-halo scan . --fail-on-findings
```

For GitHub Code Scanning, generate `debughalo.sarif` and upload it with
`github/codeql-action/upload-sarif`. See the complete
[GitHub Actions example](./docs/examples/github-actions.yml). A basic gate plus JSON artifact is
also provided for [GitLab CI](./docs/examples/.gitlab-ci.yml).

Both complete examples assume the one-time dev-dependency setup above; they do not rely on an
undeclared global package or an implicit network install by `npx`.

`--fail-on-findings` preserves the standard exit model: `0` for a successful scan without an
actionable gate result, `1` when findings are present and gating is enabled, and `2` for usage,
configuration, discovery, or processing failures. A SARIF-producing gate may exit `1`; the example
runs the upload step even when the scan reports findings.

## 🚫 Current Limitations

- **No persistent backup** — Sanitize atomically replaces files but does not retain backup copies; use version control
- **Plaintext local vault** — Reversible mappings are local and deliberately not encrypted
- **UTF-8 text only** — Arbitrary text encodings are not supported
- **No YAML config** — Only `.debughalo.json` supported
- **No Chrome extension** — CLI only
- **No AI integrations** — Standalone detector/sanitizer
- **Limited detector set** — Covers common secret types; not exhaustive
- **Opt-in cache only** — Normal scans reprocess selected files unless `--cache` is supplied; staged scans intentionally bypass the filesystem cache

## Supported Platforms

The package supports Node.js 20 or newer on 64-bit and ARM64 Windows, macOS, and Linux. Cross-platform filesystem and CLI behavior is covered by the test suite; exact filesystem guarantees still depend on the host operating system and filesystem.

## 📚 Documentation

- [Changelog](./CHANGELOG.md)
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
