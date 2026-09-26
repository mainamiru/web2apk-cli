import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import {
  Web2ApkConfigSchema,
  defaultConfig,
  isValidPackageName,
  isValidProjectName,
  isValidUrl,
  normalizeHosts,
  type Web2ApkConfig,
} from "../schemas/web2apk-config.js";
import { TemplateManager } from "../core/template.js";
import { AndroidConfigurator } from "../core/configurator.js";
import { ProjectManager } from "../core/project.js";
import { AssetManager } from "../core/assets.js";
import { printBanner } from "../ui/banner.js";
import { projectDir } from "../utils/paths.js";

export interface CreateOptions {
  name?: string;
  package?: string;
  url?: string;
  version?: string;
  versionCode?: string | number;
  contentType?: string;
  asset?: string;
  html?: string;
  icon?: string;
  json?: boolean;
}

function fail(msg: string, hint?: string): never {
  console.log(chalk.red(`\n✗ ${msg}\n`));
  if (hint) console.log(chalk.gray(hint));
  process.exit(1);
}

type MutableConfig = Web2ApkConfig & {
  content: Web2ApkConfig["content"] & { assetSource?: string };
};

export async function createCommand(
  projectName: string,
  opts: CreateOptions,
): Promise<void> {
  if (!isValidProjectName(projectName)) {
    fail(
      "Invalid project name",
      `Received: ${projectName}\nExpected: letters, numbers, "-" and "_" (e.g. my-app)`,
    );
  }

  printBanner("Create Android Application");

  if (await fs.pathExists(projectDir(projectName))) {
    fail(
      `Project already exists\n\nProject:\n  ${projectName}`,
      "Use another project name or remove the existing project.",
    );
  }

  const nonInteractive = Boolean(
    opts.name || opts.url || opts.package || opts.contentType,
  );

  let config: MutableConfig;
  if (nonInteractive) {
    config = await buildConfigFromFlags(projectName, opts);
  } else {
    config = await interactiveFlow(projectName, opts);
  }

  // Single source of truth validation
  const parsed = Web2ApkConfigSchema.safeParse(config);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    fail(
      `Invalid configuration: ${first?.path.join(".") || "config"} — ${first?.message}`,
      "Run with --help or use interactive mode.",
    );
  }
  config = { ...parsed.data } as MutableConfig;
  // restore assetSource (stripped by zod)
  const rawSource = (
    arguments.length >= 0
      ? (config as unknown as Record<string, unknown>)
      : null
  ) as unknown;
  void rawSource;

  const spinner = ora("Cloning Android template...").start();
  try {
    await TemplateManager.cloneTemplate(projectName);

    // Copy asset source (collected pre-clone) into the new project
    const assetSource = pendingAssetSource;
    pendingAssetSource = undefined;
    if (
      config.content.type === "asset" &&
      assetSource &&
      (await fs.pathExists(assetSource))
    ) {
      const assetsBase = path.join(
        projectDir(projectName),
        "app",
        "src",
        "main",
        "assets",
        "www",
      );
      config.content.assetPath = await AssetManager.copyWebAssetsToDir(
        assetsBase,
        assetSource,
      );
    } else if (opts.asset && (await fs.pathExists(path.resolve(opts.asset)))) {
      const assetsBase = path.join(
        projectDir(projectName),
        "app",
        "src",
        "main",
        "assets",
        "www",
      );
      config.content.assetPath = await AssetManager.copyWebAssetsToDir(
        assetsBase,
        path.resolve(opts.asset),
      );
    }

    spinner.text = "Applying configuration...";
    if (opts.icon && (await fs.pathExists(path.resolve(opts.icon)))) {
      await AssetManager.copyIcon(projectName, path.resolve(opts.icon));
    }
    await AndroidConfigurator.apply(config);
    await ProjectManager.saveConfig(config);
    spinner.succeed("Project created");
  } catch (err) {
    spinner.fail("Failed to create project");
    throw err;
  }

  if (opts.json) {
    console.log(
      JSON.stringify({
        success: true,
        project: projectName,
        path: projectDir(projectName),
      }),
    );
    return;
  }
  console.log(chalk.green(`\n✓ Project created: ${projectName}`));
  console.log(chalk.gray(`  Location: ${projectDir(projectName)}`));
  console.log(
    chalk.gray(
      `  Config:   ${path.join(projectDir(projectName), "web2apk.config.json")}`,
    ),
  );
  console.log(
    chalk.cyan(
      `\nNext steps:\n  web2apk validate ${projectName}\n  web2apk build ${projectName} --debug\n`,
    ),
  );
}

let pendingAssetSource: string | undefined;

async function buildConfigFromFlags(
  projectName: string,
  opts: CreateOptions,
): Promise<MutableConfig> {
  const base = defaultConfig(projectName) as MutableConfig;
  const contentType = (opts.contentType || "url").toLowerCase();
  if (!["url", "asset", "html"].includes(contentType)) {
    fail(
      "Invalid content type",
      `Received: ${opts.contentType}\nExpected: url | asset | html`,
    );
  }
  if (opts.name) base.app.name = opts.name;
  if (opts.package) {
    if (!isValidPackageName(opts.package)) {
      fail(
        "Invalid package name",
        `Received: ${opts.package}\nExpected: com.company.myapp`,
      );
    }
    base.app.packageName = opts.package;
  }
  if (opts.version) base.app.versionName = opts.version;
  if (opts.versionCode !== undefined)
    base.app.versionCode = Number(opts.versionCode);
  base.content.type = contentType as "url" | "asset" | "html";
  if (base.content.type === "url") {
    if (opts.url) base.content.url = opts.url;
    if (!isValidUrl(base.content.url)) {
      fail(
        "Invalid URL",
        `Received: ${base.content.url}\nExpected: https://example.com`,
      );
    }
  } else if (base.content.type === "asset") {
    if (opts.asset) pendingAssetSource = path.resolve(opts.asset);
  } else {
    if (opts.html) {
      const p = path.resolve(opts.html);
      if (await fs.pathExists(p))
        base.content.rawHtml = await fs.readFile(p, "utf-8");
      else base.content.rawHtml = opts.html;
    }
    if (!base.content.rawHtml.trim() && opts.url)
      base.content.rawHtml = opts.url;
  }
  return base;
}

async function interactiveFlow(
  projectName: string,
  opts: CreateOptions,
): Promise<MutableConfig> {
  const base = defaultConfig(projectName) as MutableConfig;

  const basic = await inquirer.prompt([
    {
      type: "input",
      name: "appName",
      message: "App name:",
      default: opts.name || "My Website",
      validate: (v: string) =>
        v.trim().length > 0 ? true : "App name is required",
    },
    {
      type: "input",
      name: "packageName",
      message: "Package name:",
      default: opts.package || "com.example.mywebsite",
      validate: (v: string) =>
        isValidPackageName(v.trim())
          ? true
          : "Invalid package name. Expected: com.company.myapp",
    },
    {
      type: "input",
      name: "versionName",
      message: "Version name:",
      default: opts.version || "1.0.0",
      validate: (v: string) =>
        /^\d+\.\d+\.\d+/.test(v.trim()) ? true : 'Expected semver like "1.0.0"',
    },
    {
      type: "input",
      name: "versionCode",
      message: "Version code:",
      default: String(opts.versionCode ?? "1"),
      validate: (v: string) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1
          ? true
          : "Version code must be an integer >= 1";
      },
    },
    {
      type: "select",
      name: "contentSource",
      message: "Content source:",
      choices: [
        { name: "Website URL", value: "url" },
        { name: "Local HTML asset", value: "asset" },
        { name: "Inline HTML", value: "html" },
      ],
      default: "url",
    },
  ]);

  base.app.name = basic.appName.trim();
  base.app.packageName = basic.packageName.trim();
  base.app.versionName = basic.versionName.trim();
  base.app.versionCode = Number(basic.versionCode);
  base.content.type = basic.contentSource;

  if (base.content.type === "url") {
    const { url } = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Website URL:",
        default: opts.url || "https://example.com",
        validate: (v: string) =>
          isValidUrl(v.trim())
            ? true
            : "Invalid URL. Must start with http:// or https://",
      },
    ]);
    base.content.url = url.trim();
    if (base.content.url.startsWith("http://")) {
      console.log(
        chalk.yellow("  Note: prefer https:// over http:// when possible."),
      );
    }
  } else if (base.content.type === "asset") {
    const { asset } = await inquirer.prompt([
      {
        type: "input",
        name: "asset",
        message:
          "HTML source or asset directory/file (blank for placeholder www/index.html):",
        default: opts.asset || "",
      },
    ]);
    const src = (asset as string).trim();
    if (src) {
      const abs = path.resolve(src);
      if (await fs.pathExists(abs)) {
        pendingAssetSource = abs;
        const stat = await fs.stat(abs);
        base.content.assetPath = stat.isDirectory()
          ? "www/index.html"
          : `www/${path.basename(abs)}`;
      } else {
        base.content.assetPath = src;
      }
    }
  } else {
    const { htmlFile } = await inquirer.prompt([
      {
        type: "input",
        name: "htmlFile",
        message: "HTML file path (or blank for inline editor):",
        default: "",
      },
    ]);
    if ((htmlFile as string).trim()) {
      const abs = path.resolve((htmlFile as string).trim());
      if (await fs.pathExists(abs)) {
        base.content.rawHtml = await fs.readFile(abs, "utf-8");
      } else {
        base.content.rawHtml = htmlFile as string;
      }
    } else {
      const { html } = await inquirer.prompt([
        { type: "editor", name: "html", message: "Inline HTML:" },
      ]);
      base.content.rawHtml = (html as string) || "";
    }
    if (!base.content.rawHtml.trim()) {
      base.content.rawHtml =
        '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Hello Web2APK</h1></body></html>';
    }
  }

  const { restrict } = await inquirer.prompt([
    {
      type: "confirm",
      name: "restrict",
      message: "Restrict WebView navigation to specific domains?",
      default: false,
    },
  ]);
  if (restrict) {
    const { hosts } = await inquirer.prompt([
      {
        type: "input",
        name: "hosts",
        message: "Allowed hosts (comma or semicolon separated):",
        default: "example.com",
      },
    ]);
    base.webview.allowedHosts = normalizeHosts(hosts as string);
  }

  const { customUa } = await inquirer.prompt([
    {
      type: "confirm",
      name: "customUa",
      message: "Add custom User-Agent suffix?",
      default: false,
    },
  ]);
  if (customUa) {
    const { suffix } = await inquirer.prompt([
      {
        type: "input",
        name: "suffix",
        message: "User-Agent suffix:",
        default: `Web2APK/${base.app.versionName}`,
      },
    ]);
    base.webview.userAgentSuffix = (suffix as string).trim();
  } else {
    base.webview.userAgentSuffix = "Web2APK/1.0.0";
  }

  console.log(chalk.cyan("\nWebView Features\n"));
  const feats = await inquirer.prompt([
    {
      type: "confirm",
      name: "javascript",
      message: "Enable JavaScript?",
      default: true,
    },
    {
      type: "confirm",
      name: "domStorage",
      message: "Enable DOM Storage?",
      default: true,
    },
    {
      type: "confirm",
      name: "downloads",
      message: "Enable Downloads?",
      default: true,
    },
    {
      type: "confirm",
      name: "fileUpload",
      message: "Enable File Upload?",
      default: true,
    },
    {
      type: "confirm",
      name: "geolocation",
      message: "Enable Geolocation?",
      default: false,
    },
    {
      type: "confirm",
      name: "cameraMicrophone",
      message: "Enable Camera & Microphone?",
      default: false,
    },
    {
      type: "confirm",
      name: "notifications",
      message: "Enable Notifications?",
      default: false,
    },
  ]);
  Object.assign(base.webview, feats);

  return base;
}
