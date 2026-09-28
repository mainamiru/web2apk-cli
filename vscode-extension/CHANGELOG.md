# Changelog

All notable changes to the Web2APK VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-09-28

### Notes
- Version bump only: no functional changes.
- Investigated the `DEP0169` (`url.parse()`) warning printed by `code --install-extension`. The stack points at VS Code's own `vs/code/node/cliProcessMain.js` (gallery metadata query), not at this extension — the extension bundle and every runtime dependency were scanned and contain no `url.parse()` call.

## [1.0.1] - 2026-09-28

### Added
- Initial release: create, validate, build, clean, doctor and config commands
- Status bar with project, CLI version and a command menu
- Cancellable build progress with artifact reveal on success
- Explorer context menu actions for projects
- JSON schema validation for `web2apk.config.json`
- Settings: `web2apk.cliPath`, `web2apk.defaultBuildTarget`, `web2apk.notifyOnSuccess`, `web2apk.autoDetect`

[Unreleased]: https://github.com/mainamiru/web2apk-cli/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/mainamiru/web2apk-cli/releases/tag/v1.2.0
[1.0.1]: https://github.com/mainamiru/web2apk-cli/releases/tag/v1.0.1
