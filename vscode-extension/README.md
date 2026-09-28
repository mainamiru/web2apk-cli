# Web2APK

Create, configure, validate and build Android APK/AAB from web projects — the VS Code companion for the [web2apk CLI](https://www.npmjs.com/package/@mainamiru/web2apk-cli).

The extension is a thin, transparent wrapper around the CLI: every action runs the real `web2apk` command in a terminal or background process, so anything you can do in a terminal works the same way here.

## Features

- **Status bar** with the current project and CLI version, plus a command menu on click
- **Create Project** — interactive `web2apk create` in the integrated terminal
- **Build APK/AAB** — pick Debug APK / Release APK / Release AAB, watch progress, cancel at any time, jump straight to the artifact on success
- **Validate Project** — runs `web2apk validate --json` and surfaces the failing checks
- **Check Environment (Doctor)** — runs `web2apk doctor --json` (Java, Android SDK, build tools, Gradle wrapper)
- **Open web2apk.config.json** from the explorer context menu, with schema validation and completion
- **Clean Build** in the integrated terminal
- **Install / Update CLI** with one command
- Multiple projects in one workspace: commands ask which project to use, and remember your choice
- Right-click a folder or file in the explorer to build or validate the project that contains it

## Requirements

| Requirement | Details |
| --- | --- |
| VS Code | 1.95 or newer |
| web2apk CLI | `npm i -g @mainamiru/web2apk-cli` (Node.js >= 18.17) |
| Android build | JDK 17, Android SDK (`ANDROID_HOME`), Gradle wrapper (ships with each project) |

The **Check Environment** command tells you exactly what is missing.

## Getting started

1. Install the CLI: `npm i -g @mainamiru/web2apk-cli`
2. Open a folder and run **Web2APK: Create Project**
3. Answer the wizard prompts in the integrated terminal
4. Run **Web2APK: Validate Project**, then **Web2APK: Build APK/AAB**

## Commands

| Command | Action |
| --- | --- |
| `Web2APK: Create Project` | `web2apk create <name>` in the terminal |
| `Web2APK: Validate Project` | `web2apk validate --json` |
| `Web2APK: Build APK/AAB` | `web2apk build --debug\|--release\|--aab --json` |
| `Web2APK: Clean Build` | `web2apk clean` in the terminal |
| `Web2APK: Check Environment (Doctor)` | `web2apk doctor --json` |
| `Web2APK: Open web2apk.config.json` | Opens the project config |
| `Web2APK: Install / Update CLI` | `npm i -g @mainamiru/web2apk-cli` |
| `Web2APK: Show Output` | Shows the Web2APK output channel |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `web2apk.cliPath` | `web2apk` | Command used to run the CLI (set an absolute path for a non-global install) |
| `web2apk.defaultBuildTarget` | `debug` | Target pre-selected in the build picker |
| `web2apk.notifyOnSuccess` | `true` | Notification when a build succeeds |
| `web2apk.autoDetect` | `true` | Watch the workspace for `web2apk.config.json` files |

## Development

Open the `vscode-extension` folder (File → Open Folder) and press `F5` to launch an Extension Development Host.

```bash
npm install        # dev dependencies only (esbuild, typescript, vsce)
npm run compile    # type-check + bundle to dist/extension.js
npm run watch      # rebuild on change
npm run check-types
```

### Tests

`test/` contains an integration harness that runs the real CLI through the extension code (`runner.ts`, `cli.ts`, `extension.ts`) with a minimal `vscode` stub.

```bash
npm run test:bundle

# integration suite: needs a generated project + the CLI entry point
node test/run.cjs <project-dir> <path-to-dist/cli.js> <empty-dir> <schema/web2apk-config.schema.json>

# activation suite: activates the extension against a stubbed host and runs its commands
node test/activate.cjs <project-dir>
```

## Publishing

```bash
npm run package            # type-check + production bundle
npm run vsce:package       # produces web2apk-<version>.vsix
npm run vsce:publish       # requires a publisher + PAT (see ../../PUBLISHING.md)
```

## License

MIT — see [LICENSE](LICENSE).
