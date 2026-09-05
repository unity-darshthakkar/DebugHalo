# Changelog

All notable user-facing changes to DebugHalo are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-05

### Added

- Local secret and PII detection with confidence, severity, explanations, placeholder filtering,
  inline suppression, and detector-specific ignore controls.
- Safe sanitization with dry-run support, deterministic category aliases, atomic writes, and
  collision-safe output planning.
- Reversible sanitization through a persistent local vault, plus restore and safe-share workflows.
- Text, JSON, JSONL, and SARIF scan output for interactive use and CI systems.
- Git staged-content scanning and managed pre-commit hook installation, status, and removal.
- Opt-in incremental scan caching and bounded concurrency for large projects.
- Cross-platform path, ignore-file, line-ending, Git-hook, file-reading, and symlink protections for
  Windows, macOS, and Linux.
- Project configuration through `.debughalo.json` and file/detector suppression through
  `.debughaloignore`.

### Security

- Local-first processing with no telemetry or automatic content upload.
- Secret-free diagnostic and machine-readable output.
- Size and binary-input checks, symlink-safe writes and recursive discovery, and guarded vault paths.
- Vault persistence before corresponding sanitized writes, with atomic replacement and consistent
  filesystem error handling.

[1.0.0]: https://github.com/unity-darshthakkar/DebugHalo/releases/tag/v1.0.0
