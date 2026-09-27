import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import {
  Web2ApkConfigSchema,
  isValidPackageName,
  isValidUrl,
  type Web2ApkConfig,
} from "../schemas/web2apk-config.js";
import { ProjectManager } from "../core/project.js";
import { AndroidConfigurator } from "../core/configurator.js";
import { IconGenerator } from "../core/icon.js";
import { printBanner } from "../ui/banner.js";
import { configFilePath, projectLabel } from "../utils/paths.js";

export interface ConfigOptions {
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

const CHANGE_LABELS: Record<string, string> = {
  name: "app.name",
  package: "app.packageName",
  url: "content.url",
  version: "app.versionName",
  versionCode: "app.versionCode",
  contentType: "content.type",
  asset: "content.assetPath",
  html: "content.rawHtml",
  icon: "app.icon",
};

export async function configCommand(
  projectName: string | undefined,
  opts: ConfigOptions,
): Promise<void> {
  const json = Boolean(opts.json);
  const key = projectName ?? "";
  const label = projectLabel(projectName);
  const file = configFilePath(key);

  if (!json) printBanner("Web2APK Configuration");

  const changed = (
    Object.keys(CHANGE_LABELS) as Array<keyof ConfigOptions>
  ).filter((k) => opts[k] !== undefined);

  // ---------- Read mode: no setting flags ----------
  if (changed.length === 0) {
    let config: Web2ApkConfig;
    try {
      config = await ProjectManager.loadConfig(key);
    } catch (e) {
      fail(
        e instanceof Error ? e.message.split("\n")[0]! : String(e),
        e instanceof Error && e.message.includes("\n")
          ? e.message.split("\n").slice(1).join("\n")
          : undefined,
      );
    }

    if (json) {
      console.log(
        JSON.stringify({ success: true, project: label, path: file, config }, null, 2),
      );
      return;
    }
    console.log(chalk.gray(`Config: ${file}\n`));
    console.log(chalk.white(JSON.stringify(config, null, 2)));
    console.log(
      chalk.cyan(
        `\nUpdate it with:\n  web2apk config${projectName ? ` ${projectName}` : ""} --name "Hello World"\n`,
      ),
    );
    return;
  }

  // ---------- Write mode ----------
  let config: Web2ApkConfig;
  try {
    config = await ProjectManager.loadConfig(key);
  } catch (e) {
    fail(
      e instanceof Error ? e.message.split("\n")[0]! : String(e),
      e instanceof Error && e.message.includes("\n")
        ? e.message.split("\n").slice(1).join("\n")
        : undefined,
    );
  }

  const next: Web2ApkConfig = structuredClone(config);

  if (opts.name !== undefined) {
    const v = opts.name.trim();
    if (!v) fail("App name cannot be empty.", "Example: --name \"Hello World\"");
    next.app.name = v;
  }
  if (opts.package !== undefined) {
    const v = opts.package.trim();
    if (!isValidPackageName(v))
      fail(
        "Invalid package name",
        `Received: ${v}\nExpected: com.company.myapp`,
      );
    next.app.packageName = v;
  }
  if (opts.version !== undefined) {
    const v = opts.version.trim();
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(v))
      fail("Invalid version name", `Received: ${v}\nExpected: 1.0.0`);
    next.app.versionName = v;
  }
  if (opts.versionCode !== undefined) {
    const n = Number(opts.versionCode);
    if (!Number.isInteger(n) || n < 1)
      fail(
        "Invalid version code",
        `Received: ${opts.versionCode}\nExpected: an integer >= 1`,
      );
    next.app.versionCode = n;
  }
  if (opts.contentType !== undefined) {
    const v = opts.contentType.toLowerCase();
    if (!["url", "asset", "html"].includes(v))
      fail(
        "Invalid content type",
        `Received: ${opts.contentType}\nExpected: url | asset | html`,
      );
    next.content.type = v as Web2ApkConfig["content"]["type"];
  }
  if (opts.url !== undefined) {
    const v = opts.url.trim();
    if (!isValidUrl(v))
      fail("Invalid URL", `Received: ${v}\nExpected: https://example.com`);
    next.content.url = v;
    if (next.content.type !== "url") next.content.type = "url";
  }
  if (opts.asset !== undefined) {
    next.content.assetPath = opts.asset.trim();
    if (next.content.type !== "asset") next.content.type = "asset";
  }
  if (opts.html !== undefined) {
    const asPath = path.resolve(opts.html);
    next.content.rawHtml = (await fs.pathExists(asPath))
      ? await fs.readFile(asPath, "utf-8")
      : opts.html;
    if (next.content.type !== "html") next.content.type = "html";
  }
  if (opts.icon !== undefined) {
    try {
      next.app.icon = await IconGenerator.ingest(key, opts.icon);
    } catch (e) {
      fail(
        e instanceof Error ? e.message.split("\n")[0]! : String(e),
        "Expected a PNG, JPG, WEBP or SVG file.",
      );
    }
  }

  const parsed = Web2ApkConfigSchema.safeParse(next);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    fail(
      `Invalid configuration: ${first?.path.join(".") || "config"} — ${first?.message}`,
    );
  }

  const saved = await ProjectManager.saveConfig(parsed.data, key);

  // Inject into the Android project right away so the change is build-ready
  let warnings: string[] = [];
  try {
    ({ warnings } = await AndroidConfigurator.apply(parsed.data, key));
  } catch (e) {
    fail(
      `Configuration saved but injection failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`,
      `Config file: ${saved}`,
    );
  }

  if (json) {
    console.log(
      JSON.stringify({
        success: true,
        project: label,
        path: saved,
        updated: changed.map((k) => CHANGE_LABELS[k]!),
        warnings,
        config: parsed.data,
      }),
    );
    return;
  }

  for (const k of changed) {
    console.log(chalk.green(`✓ Updated ${CHANGE_LABELS[k]}`));
  }
  for (const w of warnings) console.log(chalk.yellow(`⚠ ${w}`));
  console.log(chalk.green(`\n✓ Configuration written: ${saved}`));
  console.log(chalk.green("✓ Injected into the Android project"));
  console.log(
    chalk.cyan(
      `\nNext:\n  web2apk build${projectName ? ` ${projectName}` : ""} --debug\n`,
    ),
  );
}
