# ⚡ Web2APK CLI

[![npm version](https://badge.fury.io/js/web2apk-cli.svg)](https://www.npmjs.com/package/web2apk-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A cross-platform TypeScript Command-Line Interface (CLI) that transforms any website, Progressive Web App (PWA), or offline HTML5/JS web project into production-ready Android native binaries (**APK** and **AAB**) with automated configuration, density-scaled adaptive icons, and custom signing.

---

## 🚀 Key Highlights

- **Complete TypeScript**: Built with strict typing and modern ESM bundler architecture.
- **Cross-Platform**: First-class support for **Windows**, **macOS**, and **Linux** with native path resolution and Gradle process spawning (`gradlew.bat` / `./gradlew`).
- **Automatic Prerequisites Diagnostics**: Running `web2apk` or `web2apk doctor` checks your environment (**Java JDK 17+**, **Android SDK**, **Android Studio**, **Gradle**, and **Keytool**). If any requirement is missing, step-by-step installation guides are printed for your operating system.
- **Automatic SDK Installation**: Use `web2apk install --all` to automatically install missing dependencies like Java JDK and Android Studio.
- **Interactive "Ask Mode"**: If any parameter is omitted when executing `web2apk build`, the CLI prompts interactively with clean menus, validation, and masked password prompts.
- **Flexible Syntax**: Supports both standard GNU flags (`--orientation portrait`) and loose key-value pairs (`orientation=portrait`, `--content-type=url`).
- **High-Density Icon Processor**: Resizes any PNG, JPG, or WEBP into all Android mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) including circular masked variants and adaptive foregrounds.
- **Custom Keystore & Signing**: Full support for release signing with `.jks`/`.keystore` files or the built-in interactive keystore generator (`web2apk keygen`).
- **Offline HTML Asset Bundling**: Direct support for loading either remote websites (`--content-type url`) or offline bundled web assets (`--content-type index.html`).

---

## 📋 Prerequisites & Quick Setup

### 1. Java Development Kit (JDK 17 or higher)
- **Windows**:
  ```powershell
  winget install Microsoft.OpenJDK.17
  # or download Eclipse Temurin: https://adoptium.net
  ```
- **macOS**:
  ```bash
  brew install openjdk@17
  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
  export JAVA_HOME=$(/usr/libexec/java_home -v 17)
  ```
- **Linux** (Ubuntu/Debian):
  ```bash
  sudo apt update && sudo apt install -y openjdk-17-jdk
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  ```

### 2. Android SDK
- Install [Android Studio](https://developer.android.com/studio) and let the setup wizard install the Android SDK to its default path.
- Or set `ANDROID_HOME`:
  - **Windows**: `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"`
  - **macOS**: `export ANDROID_HOME=$HOME/Library/Android/sdk`
  - **Linux**: `export ANDROID_HOME=$HOME/Android/Sdk`

---

## 🛠️ Installation & Usage

### Install from npm

```bash
npm install -g web2apk-cli
# or
npx web2apk-cli
```

### Development Installation

Install project dependencies:

```bash
bun install
# or npm install
```

Build the CLI binary:

```bash
bun run build
```

Run directly:

```bash
bun run web2apk
# or
node dist/index.js
```

You can also link it globally on your machine:

```bash
npm link
# then use anywhere:
web2apk --help
```

---

## 💻 Commands & Examples

### 1. Check Prerequisites & Environment (`doctor`)
Runs a comprehensive environment check and displays tailored guides for anything missing:

```bash
web2apk doctor
# or
web2apk check
```

The `doctor` command will also offer to automatically install any missing dependencies if you're in an interactive terminal.

### 2. Install Missing Dependencies (`install`)
Automatically install missing SDK dependencies:

```bash
# Install all missing dependencies
web2apk install --all

# Install specific components
web2apk install --java
web2apk install --android-studio
web2apk install --android-sdk

# Interactive mode (select components to install)
web2apk install

# Force reinstall even if already installed
web2apk install --java --force
```

### 3. Create Project (`create`)

#### Example A: Full Command-Line Create (Non-Interactive)
```bash
web2apk create myproject \
  --name "My Store" \
  --url "https://mystore.example.com" \
  --icon "assets/icon.png" \
  --orientation portrait \
  --content-type url
```

#### Example B: Interactive "Ask Mode"
If you run `web2apk create` without options, the wizard will guide you:

```bash
web2apk create myproject
```
It will ask:
1. Application Name
2. Package Name
3. Version Name and Version Code
4. Content Source (Website URL or Local HTML)
5. Website URL / Path to local `index.html`
6. WebView Features (JavaScript, DOM Storage, Downloads, etc.)
7. Navigation restrictions
8. Custom User-Agent suffix

#### Example C: Offline HTML / Local Assets
Wrap an offline web folder or single `index.html`:

```bash
web2apk create myproject \
  --name "Offline Game" \
  --content-type asset \
  --asset "assets/index.html" \
  --icon "assets/icon.png"
```

### 4. Build APK / AAB (`build`)

#### Example A: Build Debug APK
```bash
web2apk build myproject --debug
```

#### Example B: Build Release APK
```bash
web2apk build myproject --release
```

#### Example C: Build Release AAB (for Google Play)
```bash
web2apk build myproject --aab
```

#### Example D: Interactive Build Mode
If you run `web2apk build` without options, it will prompt for build type:

```bash
web2apk build myproject
```

### 5. Validate Project (`validate`)
Validate a generated project's configuration:

```bash
web2apk validate myproject
```

### 6. Clean Build Cache (`clean`)
Purges Gradle build caches and previous outputs:

```bash
web2apk clean myproject
```

---

## ⚙️ CLI Options Reference

### `web2apk install`

| Option | Description | Default |
| :--- | :--- | :--- |
| `--java` | Install Java JDK | `false` |
| `--android-studio` | Install Android Studio | `false` |
| `--android-sdk` | Install Android SDK components | `false` |
| `--all` | Install all missing dependencies | `false` |
| `--force` | Force reinstall even if already installed | `false` |

### `web2apk doctor`

| Option | Description | Default |
| :--- | :--- | :--- |
| `--json` | Machine-readable output | `false` |

### `web2apk create <project-name>`

| Option | Description | Default |
| :--- | :--- | :--- |
| `--name <name>` | App display name | `My Website` |
| `--package <package>` | Android package name (e.g. com.example.mywebsite) | `com.example.mywebsite` |
| `--url <url>` | Website URL | `https://example.com` |
| `--version <version>` | Version name (e.g. 1.0.0) | `1.0.0` |
| `--version-code <code>` | Version code (integer) | `1` |
| `--content-type <type>` | Content type: url | asset | html | `url` |
| `--asset <path>` | Path to HTML file or asset directory (content-type asset) | None |
| `--html <path-or-string>` | HTML file path or inline HTML (content-type html) | None |
| `--icon <path>` | Path to app icon | None |
| `--json` | Machine-readable output | `false` |
| `--verbose` | Show full error stack traces | `false` |

### `web2apk build <project-name>`

| Option | Description | Default |
| :--- | :--- | :--- |
| `--debug` | Build Debug APK (assembleDebug) | `false` |
| `--release` | Build Release APK (assembleRelease) | `false` |
| `--aab` | Build Release AAB (bundleRelease) | `false` |
| `--json` | Machine-readable output | `false` |
| `--verbose` | Show full error stack traces | `false` |

---

## 📦 Output Artifacts

All compiled artifacts are saved into `./dist/` (or your `--output` path) with explicit naming, file sizes, and SHA256 checksums:

```
dist/
├── Web2Apk-1.0.0-release.apk   (Installable native APK)
└── Web2Apk-1.0.0-release.aab   (Google Play App Bundle)
```