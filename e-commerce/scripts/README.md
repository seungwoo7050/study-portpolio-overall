# Sagaline Scripts

Utility scripts for development and operations.

## Installation

### Install Git Hooks

To set up pre-commit hooks:

```bash
./scripts/install-hooks.sh
```

This will automatically run quality checks before each commit.

## Available Scripts

### `pre-commit`

Git pre-commit hook that runs automatically before commits.

**Checks**:
- Binary files (prevents accidental commits)
- Sensitive information (passwords, API keys)
- Code compilation (Maven/Gradle)
- TODO/FIXME markers (warnings only)
- Commit message format (conventional commits)

**Usage**:
Installed automatically via `install-hooks.sh`. Runs on every `git commit`.

To bypass (not recommended):
```bash
git commit --no-verify
```

### `install-hooks.sh`

Installs Git hooks for the project.

**Usage**:
```bash
chmod +x scripts/install-hooks.sh
./scripts/install-hooks.sh
```

## Future Scripts

Additional scripts will be added as the project progresses:

- `build.sh` - Build and package application
- `test.sh` - Run full test suite
- `deploy.sh` - Deploy to environments
- `db-migrate.sh` - Database migration helper
- `generate-docs.sh` - Generate API documentation
- `health-check.sh` - Check service health
- `performance-test.sh` - Run performance benchmarks

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `style`: Code style changes (formatting)
- `ci`: CI/CD changes
- `build`: Build system changes

**Examples**:

```
feat: add user registration endpoint

Implement POST /api/users/register with email validation
and password hashing using BCrypt.

Closes #1
```

```
fix: resolve database connection pool leak

Connection pool was not releasing connections properly
under high load. Added proper cleanup in finally blocks.

Fixes #42
```

```
docs: update API documentation for orders endpoint

Added examples for order creation and status updates.
```

## Development Workflow

1. **Before coding**: Install Git hooks
2. **During coding**: Code compiles and passes checks
3. **Before commit**: Pre-commit hook runs automatically
4. **Commit**: Use conventional commit format
5. **Push**: CI/CD runs full test suite
6. **Review**: PR checks must pass

## Troubleshooting

### Pre-commit hook fails

If the pre-commit hook fails:

1. Read the error message carefully
2. Fix the issue (compilation, binary files, etc.)
3. Stage your changes again
4. Retry the commit

### Hook not running

If the hook doesn't run:

```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Reinstall if needed
./scripts/install-hooks.sh

# Verify permissions
chmod +x .git/hooks/pre-commit
```

### Bypassing hooks (emergency only)

```bash
# Skip pre-commit hook (not recommended)
git commit --no-verify

# Use only when:
# - Emergency hotfix
# - CI/CD will catch issues
# - You know what you're doing
```

## Contributing

When adding new scripts:

1. Place in `scripts/` directory
2. Make executable: `chmod +x scripts/your-script.sh`
3. Add shebang: `#!/bin/bash`
4. Add description header
5. Handle errors: `set -e`
6. Update this README

## License

Part of the Sagaline project.
