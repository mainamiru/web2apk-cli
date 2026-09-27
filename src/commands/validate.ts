import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import { ProjectManager } from "../core/project.js";
import { IconGenerator } from "../core/icon.js";
import { printBanner } from "../ui/banner.js";
import { configFilePath, projectDir, projectLabel } from "../utils/paths.js";
import type { Web2ApkConfig } from "../schemas/web2apk-config.js";

export async function validateCommand(
  projectName: string | undefined,
  opts?: { json?: boolean },
): Promise<boolean> {
  const json = Boolean(opts?.json);
  if (!json) printBanner("Web2APK Project Validation");

  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
  const dir = projectDir(projectName);
  const label = projectLabel(projectName);

  // 1. Configuration file exists
  const cfgPath = configFilePath(projectName);
  const cfgExists = await fs.pathExists(cfgPath);
  checks.push({
    label: "Configuration file exists",
    ok: cfgExists,
    detail: cfgPath,
  });

  // 2. Configuration is valid (zod)
  let configValid = false;
  let configError = "";
  let cfg: Web2ApkConfig | null = null;
  if (cfgExists) {
    try {
      cfg = await ProjectManager.loadConfig(projectName);
      configValid = true;
    } catch (e) {
      configError = e instanceof Error ? e.message : String(e);
    }
  }
  checks.push({
    label: "Configuration is valid",
    ok: configValid,
    detail: configError,
  });

  // 3. Android project exists
  const projExists = await fs.pathExists(
    path.join(dir, "app", "src", "main", "AndroidManifest.xml"),
  );
  checks.push({ label: "Android project exists", ok: projExists });

  // 4. Gradle wrapper exists
  const wrapper = await fs.pathExists(path.join(dir, "gradlew.bat"));
  const wrapperSh = await fs.pathExists(path.join(dir, "gradlew"));
  checks.push({ label: "Gradle wrapper exists", ok: wrapper && wrapperSh });

  // 5. gradle-wrapper.jar exists
  const jar = await fs.pathExists(
    path.join(dir, "gradle", "wrapper", "gradle-wrapper.jar"),
  );
  checks.push({ label: "gradle-wrapper.jar exists", ok: jar });

  // 6. Android configuration is valid (web2apk_config.xml present with key resource)
  let androidCfg = false;
  const xmlPath = path.join(
    dir,
    "app",
    "src",
    "main",
    "res",
    "values",
    "web2apk_config.xml",
  );
  if (await fs.pathExists(xmlPath)) {
    const xml = await fs.readFile(xmlPath, "utf-8");
    androidCfg =
      xml.includes('name="web2apk_content_type"') &&
      xml.includes('name="web2apk_default_url"');
  }
  checks.push({ label: "Android configuration is valid", ok: androidCfg });

  // 7. Required files exist (settings + app build script + gradle.properties)
  const required = [
    path.join(dir, "settings.gradle.kts"),
    path.join(dir, "app", "build.gradle.kts"),
    path.join(dir, "gradle.properties"),
  ];
  const missing = (
    await Promise.all(
      required.map(async (f) => ((await fs.pathExists(f)) ? null : f)),
    )
  ).filter(Boolean);
  checks.push({
    label: "Required files exist",
    ok: missing.length === 0,
    detail: missing.length ? `Missing: ${missing.join(", ")}` : undefined,
  });

  // 8. Launcher icons present (legacy densities + adaptive foreground)
  const resDir = path.join(dir, "app", "src", "main", "res");
  const iconFiles = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].flatMap(
    (d) => [
      path.join(resDir, `mipmap-${d}`, "ic_launcher.png"),
      path.join(resDir, `mipmap-${d}`, "ic_launcher_round.png"),
    ],
  );
  iconFiles.push(path.join(resDir, "drawable", "ic_web2apk_icon.png"));
  const missingIcons = (
    await Promise.all(
      iconFiles.map(async (f) => ((await fs.pathExists(f)) ? null : f)),
    )
  ).filter((f): f is string => f !== null);
  checks.push({
    label: "Launcher icons present",
    ok: missingIcons.length === 0,
    detail: missingIcons.length
      ? `Missing: ${missingIcons.length} of ${iconFiles.length} files`
      : undefined,
  });

  // 9. Configured icon source still exists (only checked when one is set)
  if (cfg?.app.icon) {
    const src = await IconGenerator.resolveSource(projectName, cfg.app.icon);
    checks.push({
      label: "Icon source present",
      ok: Boolean(src),
      detail: src ? undefined : `Not found: ${cfg.app.icon}`,
    });
  }

  const allOk = checks.every((c) => c.ok);

  if (json) {
    console.log(
      JSON.stringify({ success: allOk, project: label, checks }, null, 2),
    );
    return allOk;
  }

  for (const c of checks) {
    const icon = c.ok ? chalk.green("✓") : chalk.red("✗");
    console.log(
      `${icon} ${c.label}${c.ok ? "" : c.detail ? chalk.gray(` — ${c.detail.split("\n")[0]}`) : ""}`,
    );
  }
  if (allOk) {
    console.log(chalk.green("\nProject is ready to build.\n"));
  } else {
    console.log(chalk.red("\nProject validation failed.\n"));
    if (configError)
      console.log(chalk.gray(configError.split("\n").slice(0, 5).join("\n")));
  }
  return allOk;
}
