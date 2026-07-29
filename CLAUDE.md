# Claude Code Development Guidelines for DebugHalo

## 🔍 Before Making Changes

1. **Inspect before modifying**: Always review existing code to understand patterns and conventions
2. **Understand the context**: Read related files and documentation before making changes
3. **Check for existing solutions**: Look for similar functionality that might already exist

## 🎯 Making Changes

1. **Make the smallest coherent change**: Break down work into minimal, focused commits
2. **One concern per commit**: Each commit should address a single logical change
3. **Preserve local-first behavior**: Never introduce external dependencies or telemetry
4. **Never store or print real secrets**: Use mock data for testing and examples
5. **Preserve privacy guarantees**: All data processing must remain local

## ✅ Testing

1. **Add or update tests for every behavior change**: No feature is complete without tests
2. **Run relevant validation commands after changes**:
   ```bash
   npm run check  # Runs format, lint, typecheck, test, and build
   ```
3. **Do not claim tests passed unless they were actually executed**
4. **Ensure tests pass before considering work complete**

## 🚫 What NOT to Do (Phase 1 Restrictions)

These limitations apply specifically to Phase 1 foundation work:

- ❌ Do not implement masking or redaction logic
- ❌ Do not implement reversible masking vaults
- ❌ Do not implement secret or PII detectors
- ❌ Do not implement stack-trace parsing
- ❌ Do not implement Clean Debug Bundle generation
- ❌ Do not implement CLI commands beyond minimal placeholder entry point
- ❌ Do not implement Chrome extension functionality
- ❌ Do not implement AI integrations
- ❌ Do not implement telemetry
- ❌ Do not implement authentication systems
- ❌ Do not implement cloud storage
- ❌ Do not implement databases

## 🏗️ When to Begin Later Phases

Do not begin Phase 2 or later functionality without explicit instruction. Phase 1 focuses solely on:

- Repository foundation and baseline setup
- TypeScript configuration
- Build, test, linting setup
- Basic project structure
- Documentation

## 📝 Commit Message Format

Follow conventional commits:

- `feat: add new feature`
- `fix: fix bug`
- `docs: update documentation`
- `style: formatting changes`
- `refactor: code restructuring`
- `perf: performance improvements`
- `test: add/update tests`
- `chore: maintenance tasks`

## 🔄 Development Workflow

1. Create feature branch from `main`
2. Make small, incremental changes
3. Write/update tests as you go
4. Frequently run `npm run test` and `npm run lint`
5. Before merging, run full validation: `npm run check`
6. Submit pull request with clear description
