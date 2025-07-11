# Biome + Turbo Setup Usage Guide

This project is now configured with Biome for linting and formatting, integrated with Turbo for monorepo-wide operations.

## Available Commands

### Turbo Commands (Recommended)

Run these commands from the **root** of the project:

```bash
# Check linting and formatting across all packages
pnpm run check

# Fix auto-fixable linting and formatting issues across all packages
pnpm run check:fix

# Check linting and formatting for the entire project (including root files)
pnpm run check:all

# Fix auto-fixable issues for the entire project
pnpm run check:all:fix
```

### Individual Package Commands

Run these commands from within any package directory (apps/bifrost, apps/midgard, packages/ui):

```bash
# Check linting and formatting for current package only
pnpm run check

# Fix auto-fixable issues for current package only
pnpm run check:fix
```

### Legacy Commands (Still Available)

```bash
# Original biome commands (still work)
pnpm run format-and-lint
pnpm run format-and-lint:fix
```

## What Biome Does

### Formatting
- Consistent code formatting (indentation, spacing, line breaks)
- Automatic import organization
- CSS class sorting (Tailwind classes are automatically sorted)
- JSON formatting

### Linting
- Code quality checks
- Accessibility (a11y) checks
- Performance best practices
- React-specific rules
- TypeScript-specific rules

## Configuration

The Biome configuration is in `biome.json` at the root level. It includes:

- **Formatter settings**: Tabs, semicolons, quote style, etc.
- **Linter rules**: Recommended rules plus CSS class sorting
- **File exclusions**: Build files, node_modules, etc. are ignored

## Integration with VS Code

To get real-time linting and formatting in VS Code:

1. Install the Biome extension
2. Add to your VS Code settings:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## Workflow Recommendations

### During Development
- Use `pnpm run check` frequently to catch issues early
- Run `pnpm run check:fix` to auto-fix simple issues
- Some issues may require manual fixes (marked as "unsafe" fixes)

### Before Committing
```bash
# From project root - check everything
pnpm run check:all:fix

# Then check if there are remaining issues
pnpm run check:all
```

### CI/CD Integration
Add to your CI pipeline:
```bash
pnpm run check:all
```

## Troubleshooting

### Common Issues

1. **Exit code 1**: This is normal when there are linting/formatting issues
2. **"Unsafe fixes skipped"**: Some fixes require manual review - use `--unsafe` flag if needed
3. **Files still showing issues**: Some rules require manual fixes (like accessibility improvements)

### Manual Fixes Required
Some issues can't be auto-fixed and need manual attention:
- Accessibility improvements
- Component architecture issues
- Complex refactoring suggestions

### Ignoring Rules
If needed, you can disable specific rules by adding comments:
```javascript
// biome-ignore lint/suspicious/noDocumentCookie: Legacy code
document.cookie = "...";
```

## Performance

- Biome is extremely fast (written in Rust)
- Turbo caches results, so subsequent runs are even faster
- Only changed packages are rechecked
