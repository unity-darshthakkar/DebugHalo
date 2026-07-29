# Contributing to DebugHalo

Thank you for considering contributing to DebugHalo! We appreciate your help in making this project better.

## 📋 How to Contribute

### Reporting Issues

- Use the [GitHub Issues](https://github.com/Darsh/DebugHalo/issues) tracker
- Please check if the issue has already been reported
- Include as much detail as possible: steps to reproduce, expected vs actual behavior, environment details

### Suggesting Features

- Use the [GitHub Issues](https://github.com/Darsh/DebugHalo/issues) tracker
- Clearly describe the feature and why it would be useful
- Consider if it aligns with the project's local-first, privacy-focused goals

### Submitting Changes

Please follow these steps to contribute:

1. **Fork** the repository
2. **Create a branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following our coding standards
4. **Add tests** for any new functionality
5. **Run the test suite** to ensure nothing is broken:
   ```bash
   npm run test
   ```
6. **Run linting and formatting checks**:
   ```bash
   npm run check
   ```
7. **Commit your changes** using conventional commits:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
8. **Push to your branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
9. **Open a Pull Request** against the `main` branch

## 🔧 Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Familiarize yourself with the project structure:
   ```
   src/
   ├── core/         # Core logic (Phase 2+)
   ├── detectors/    # PII/secret detectors (Phase 2+)
   ├── masking/      # Data masking utilities (Phase 2+)
   ├── bundle/       # Bundle creation (Phase 2+)
   ├── cli/          # Command-line interface
   ├── types/        # TypeScript type definitions
   └── utils/        # Utility functions
   ```

````
4. Run tests to ensure everything works:
   ```bash
   npm run test
````

## 📝 Coding Standards

### TypeScript

- Use TypeScript 5.0+ features
- Enable strict mode in tsconfig.json
- Write type definitions for all public APIs
- Use interfaces for public contracts, types for internal types

### Code Style

- Follow Prettier formatting (run `npm run format`)
- Follow ESLint rules (run `npm run lint`)
- Meaningful, descriptive variable and function names
- Small, focused functions that do one thing well

### Documentation

- Export all public APIs with JSDoc comments
- Comment complex logic and algorithms
- Update README when adding/changing features
- Keep code comments up-to-date

### Testing

- Write unit tests for all new functions
- Aim for high test coverage (>80%)
- Test both positive and negative cases
- Use Vitest for testing framework
- Place tests in `tests/` directory mirroring source structure

### Git Practices

- Make small, frequent commits
- Write clear, descriptive commit messages
- Reference issues in commit messages when applicable
- Squash commits before merging if requested

## 🧪 Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔍 Linting and Formatting

```bash
# Check for linting errors
npm run lint

# Automatically fix linting errors
npm run lint:fix

# Check formatting
npm run format:check

# Automatically format code
npm run format

# Run all validation checks
npm run check
```

## 📦 Building

```bash
# Create production build
npm run build

# Preview build (if applicable)
npm run preview
```

## 🎯 First Contributions

Looking for a place to start? Look for issues labeled:

- `good first issue`
- `help wanted`
- `documentation`

## 💡 Questions?

Feel free to open an issue or reach out to the maintainers.

Thank you for contributing to DebugHalo!
