# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-09-28

### Added
- VS Code extension in `vscode-extension/` (create, validate, build, clean, doctor, open config, status bar and explorer actions, schema validation for `web2apk.config.json`), published as `mainamiru.web2apk`
- `web2apk --cli-version` now reports the real package version instead of a hardcoded `1.0.0`

### Changed
- Documentation: VS Code extension section in `README.md` and extension publishing guide in `PUBLISHING.md`

## [1.0.1] - 2026-09-28

### Added
- Real icon pipeline (`sharp`): `create --icon` / `config --icon` copy the source into `assets/icon.<ext>`, store it as `app.icon`, and generate square + circular launcher icons for every density plus the adaptive foreground
- Icons are regenerated from `app.icon` on every `build` and config injection
- `validate` now checks that launcher icons and the configured icon source are present
- `config` command to read or update `web2apk.config.json` (`web2apk config --name "Hello World"`), saving the file and injecting it into the Android project immediately
- Automatic SDK installation functionality for Java JDK, Android Studio, and Android SDK components
- Interactive install command with component selection
- Enhanced doctor command with auto-install prompts
- Platform-specific installation support for Windows, macOS, and Linux
- Cross-platform dependency detection and installation

### Changed
- `validate`, `build` and `clean` accept an optional project name and fall back to the current directory
- `build` injects `web2apk.config.json` into the Android project before running Gradle, so config edits are picked up on every build
- `app.icon` added to the configuration schema (defaults to empty, backward compatible)
- Node.js requirement raised to `>=18.17.0` (required by `sharp@0.34`)
- Updated README with new install command documentation
- Improved CLI structure and command organization

## [1.0.0] - 2025-01-XX

### Added
- Initial release of web2apk-cli
- Project creation from Android template
- APK/AAB building with Gradle
- Interactive configuration wizard
- Support for web URLs, local assets, and inline HTML
- Custom signing keystore support
- Environment checking with doctor command
- Cross-platform support (Windows, macOS, Linux)
- High-density icon processing
- WebView configuration options

[Unreleased]: https://github.com/mainamiru/web2apk-cli/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/mainamiru/web2apk-cli/releases/tag/v1.2.0
[1.0.1]: https://github.com/mainamiru/web2apk-cli/releases/tag/v1.0.1
[1.0.0]: https://github.com/mainamiru/web2apk-cli/releases/tag/v1.0.0