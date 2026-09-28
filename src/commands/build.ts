import chalk from "chalk";
import path from "node:path";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs-extra";
import { ProjectManager } from "../core/project.js";
import { AndroidConfigurator } from "../core/configurator.js";
import {
  findBuildOutput,
  runGradle,
  targetToGradleTask,
  type BuildTarget,
} from "../core/gradle.js";
import { printBanner } from "../ui/banner.js";
import { formatBytes } from "../utils/filesystem.js";
import { projectDir, projectLabel } from "../utils/paths.js";
import type { Web2ApkConfig } from "../schemas/web2apk-config.js";

export interface BuildOptions {
  debug?: boolean;
  release?: boolean;
  aab?: boolean;
  json?: boolean;
  verbose?: boolean;
}

function resolveTarget(
  opts: BuildOptions,
  interactive: boolean,
): Promise<BuildTarget> | BuildTarget {
  if (opts.aab) return "aab";
  if (opts.release) return "release";
  if (opts.debug) return "debug";
  if (interactive && process.stdin.isTTY) {
    return inquirer
      .prompt([
        {
          type: "select",
          name: "buildType",
          message: "Build type:",
          choices: [
            { name: "Debug APK", value: "debug" },
            { name: "Release APK", value: "release" },
            { name: "Release AAB", value: "aab" },
          ],
          default: "debug",
        },
      ])
      .then((ans) => ans.buildType as BuildTarget);
  }
  return "debug";
}

function failBuild(
  json: boolean,
  projectName: string | undefined,
  msg: string,
  extra?: Record<string, unknown>,
): never {
  if (json) {
    console.log(
      JSON.stringify({
        success: false,
        project: projectLabel(projectName),
        ...extra,
        error: msg,
      }),
    );
    process.exit(1);
  }
  console.log(chalk.red(`\n✗ ${msg.split("\n")[0]}\n`));
  if (msg.includes("\n"))
    console.log(chalk.gray(msg.split("\n").slice(1).join("\n")));
  process.exit(1);
}

export async function buildCommand(
  projectName: string | undefined,
  opts: BuildOptions,
): Promise<void> {
  const json = Boolean(opts.json);
  const key = projectName ?? "";
  const labelName = projectLabel(projectName);
  if (!json) printBanner("Build Android Application");

  // 1. Validate config + project (quiet in json mode)
  let config: Web2ApkConfig;
  try {
    config = await ProjectManager.loadConfig(key);
  } catch (e) {
    failBuild(json, projectName, e instanceof Error ? e.message : String(e));
  }

  const manifest = path.join(
    projectDir(key),
    "app",
    "src",
    "main",
    "AndroidManifest.xml",
  );
  if (!(await fs.pathExists(manifest))) {
    failBuild(
      json,
      projectName,
      projectName
        ? `Android project not found for "${projectName}". Run: web2apk create ${projectName}`
        : `No Android project found in ${projectDir(key)}. Run: web2apk create <project-name>, or cd into a generated project.`,
    );
  }

  // 2. Resolve target
  const target = await resolveTarget(opts, !json);

  const task = targetToGradleTask(target);
  const buildLabel =
    target === "debug"
      ? "Debug APK"
      : target === "release"
        ? "Release APK"
        : "Release AAB";

  if (!json)
    console.log(
      chalk.gray(`\nBuilding ${buildLabel} for ${labelName} (${task})...\n`),
    );

  // 3. Inject web2apk.config.json into the Android project, then build
  const injecting = json
    ? null
    : ora("Injecting web2apk.config.json...").start();
  let injectWarnings: string[] = [];
  try {
    ({ warnings: injectWarnings } = await AndroidConfigurator.apply(
      config,
      key,
    ));
    injecting?.succeed("Configuration injected");
  } catch (e) {
    injecting?.fail("Configuration injection failed");
    failBuild(json, projectName, e instanceof Error ? e.message : String(e), {
      stage: "configure",
    });
  }
  if (!json) {
    for (const w of injectWarnings) console.log(chalk.yellow(`⚠ ${w}`));
  }

  // 4. Run Gradle Wrapper (never global gradle)
  const spinner = json ? null : ora(`Running Gradle ${task}...`).start();
  const started = Date.now();
  try {
    await runGradle(key, [task], { verbose: opts.verbose });
    spinner?.succeed("Gradle build completed");
  } catch (e) {
    spinner?.fail("Gradle build failed");
    const msg = e instanceof Error ? e.message : String(e);
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          project: labelName,
          variant: target,
          error: msg,
        }),
      );
      process.exit(1);
    }
    console.log(chalk.red(`\n✗ Build failed\n`));
    console.log(chalk.gray(`Gradle exited with an error (task: ${task}).`));
    console.log(chalk.gray(`\nProject:\n  ${labelName}`));
    console.log(chalk.gray(`\nBuild:\n  ${buildLabel}`));
    console.log(
      chalk.gray(
        `\nRun:\n  web2apk build${projectName ? ` ${projectName}` : ""} --${target === "aab" ? "aab" : target}\n`,
      ),
    );
    console.log(
      chalk.gray("Build logs:\n" + msg.split("\n").slice(0, 40).join("\n")),
    );
    process.exit(1);
  }

  // 5. Locate artifact (don't assume exact filename)
  const output = await findBuildOutput(key, target);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (!output) {
    const msg =
      "Build finished but no APK/AAB artifact was found in the expected output directory.";
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          project: labelName,
          variant: target,
          error: msg,
        }),
      );
      process.exit(1);
    }
    console.log(chalk.red(`\n✗ ${msg}\n`));
    process.exit(1);
  }

  const stat = await fs.stat(output);
  const size = formatBytes(stat.size);
  const type = target === "aab" ? "aab" : "apk";

  if (json) {
    console.log(
      JSON.stringify({
        success: true,
        project: labelName,
        type,
        variant: target === "aab" ? "release" : target,
        output,
        sizeBytes: stat.size,
        elapsedSeconds: Number(elapsed),
        warnings: injectWarnings,
      }),
    );
    return;
  }

  console.log(chalk.green("✓ Project validated"));
  console.log(chalk.green("✓ Android template prepared"));
  console.log(chalk.green("✓ web2apk.config.json injected"));
  console.log(chalk.green("✓ Gradle build completed"));
  console.log(chalk.bold.green("\nBuild successful!\n"));
  console.log(chalk.gray(type === "aab" ? "AAB:" : "APK:"));
  console.log(chalk.white(`  ${output}\n`));
  console.log(chalk.gray("Size:"));
  console.log(chalk.white(`  ${size}\n`));
}
