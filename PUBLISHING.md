# Publishing Guide

This guide explains how to publish the web2apk-cli package to npm.

## Prerequisites

1. **npm account**: Make sure you have an npm account at [npmjs.com](https://www.npmjs.com/)
2. **npm login**: Authenticate with npm:
   ```bash
   npm login
   ```

## Pre-Publishing Checklist

- [ ] Update version in `package.json` (follow semantic versioning)
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run `npm run build` to ensure the latest build
- [ ] Run `npm run typecheck` to ensure no TypeScript errors
- [ ] Test the CLI locally with `npm link`
- [ ] Verify the `.npmignore` file excludes unnecessary files
- [ ] Ensure `README.md` is up to date
- [ ] Verify `LICENSE` file exists

## Publishing Process

### 1. Build the package

```bash
npm run build
```

### 2. Dry-run (optional)

To see what would be published without actually publishing:

```bash
npm pack --dry-run
```

### 3. Publish to npm

```bash
npm publish
```

Or for a specific tag:

```bash
npm publish --tag next
```

## Post-Publishing

1. **Verify the package**: Visit [npmjs.com/package/web2apk-cli](https://www.npmjs.com/package/web2apk-cli)
2. **Test installation**: Install it in a clean environment:
   ```bash
   npm install -g web2apk-cli
   web2apk --help
   ```
3. **Tag the release**: Create a git tag for the version:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Version Management

Use semantic versioning:

- **Major version (X.0.0)**: Breaking changes
- **Minor version (0.X.0)**: New features, backward compatible
- **Patch version (0.0.X)**: Bug fixes, backward compatible

Update version in `package.json`:

```bash
npm version patch   # 0.0.1 -> 0.0.2
npm version minor   # 0.0.1 -> 0.1.0
npm version major   # 0.0.1 -> 1.0.0
```

## Troubleshooting

### Package name already taken

If the package name is already taken, you'll need to choose a different name or use a scoped package:

```json
{
  "name": "@username/web2apk-cli"
}
```

### Publishing fails

Common issues:
- **Authentication**: Run `npm login` again
- **Version conflict**: Increment the version in `package.json`
- **Files missing**: Check `.npmignore` doesn't exclude necessary files
- **Build errors**: Run `npm run build` and fix any TypeScript errors

### Unpublishing

**Warning**: You can only unpublish within 72 hours of publishing, and only if no other packages depend on yours.

```bash
npm unpublish web2apk-cli@1.0.0
```

To deprecate a version (recommended):

```bash
npm deprecate web2apk-cli@1.0.0 "This version has security issues"
```

## CI/CD Automation

Consider setting up automated publishing via GitHub Actions or similar CI/CD systems. Here's a basic example:

```yaml
name: Publish to npm
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
## Publishing the VS Code Extension

The VS Code extension lives in [`vscode-extension/`](vscode-extension/) and is published to the Visual Studio Marketplace under the publisher id `mainamiru` (must match `publisher` in `vscode-extension/package.json`).

### One-time setup

1. Create the publisher at https://marketplace.visualstudio.com/manage (Publishers -> Create publisher) with the id `mainamiru`.
2. Create a **Personal Access Token** (PAT) at https://dev.azure.com:
   - Organization: `All accessible organizations`
   - Expiration: as long as allowed (Azure DevOps retires global PATs on Dec 1, 2026)
   - Custom published scope: **Marketplace** -> **Manage**
3. Log in once: `cd vscode-extension && npx vsce login mainamiru` (the token is stored in `~/.vsce`).

### Publishing process

```bash
cd vscode-extension
npm install
npm run package              # type-check + production bundle (runs automatically on publish)
npm run vsce:package         # -> web2apk-<version>.vsix
npm run vsce:publish         # publishes to the Marketplace
```

Or publish the `.vsix` by hand: https://marketplace.visualstudio.com/manage → *...* → *Upload Extension*.

### Checklist

- [ ] `vscode-extension/package.json` version matches the release you are shipping
- [ ] `vscode-extension/CHANGELOG.md` updated
- [ ] `npm run check-types` passes
- [ ] `npm run test:bundle` then run both suites against a real project (see `vscode-extension/README.md`)
- [ ] `web2apk-<version>.vsix` installs cleanly: `code --install-extension web2apk-<version>.vsix`
- [ ] `schema/web2apk-config.schema.json` still mirrors `src/schemas/web2apk-config.ts`

### CI publishing

After the Azure DevOps global PAT retirement (Dec 1, 2026) prefer Azure CLI authentication instead of a PAT:

```bash
az login
npx vsce publish --azure-credential
```
