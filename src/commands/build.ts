import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs-extra";
import { ProjectManager } from "../core/project.js";
import {
  findBuildOutput,
  runGradle,
  targetToGradleTask,
  type BuildTarget,
} from "../core/gradle.js";
import { printBanner } from "../ui/banner.js";
import { formatBytes } from "../utils/filesystem.js";
import { projectDir } from "../utils/paths.js";

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

export async function buildCommand(
  projectName: string,
  opts: BuildOptions,
): Promise<void> {
  const json = Boolean(opts.json);
  if (!json) printBanner("Build Android Application");

  // 1. Validate config + project (quiet in json mode)
  try {
    await ProjectManager.loadConfig(projectName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (json) {
      console.log(
        JSON.stringify({ success: false, project: projectName, error: msg }),
      );
      process.exit(1);
    }
    console.log(chalk.red(`\n✗ Project validation failed\n`));
    console.log(chalk.gray(msg));
    process.exit(1);
  }

  if (!(await fs.pathExists(projectDir(projectName)))) {
    const msg = `Android project not found for "${projectName}". Run: web2apk create ${projectName}`;
    if (json) {
      console.log(
        JSON.stringify({ success: false, project: projectName, error: msg }),
      );
      process.exit(1);
    }
    console.log(chalk.red(`\n✗ ${msg}\n`));
    process.exit(1);
  }

  // 2. Resolve target
  const target = await resolveTarget(opts, !json);

  const task = targetToGradleTask(target);
  const label =
    target === "debug"
      ? "Debug APK"
      : target === "release"
        ? "Release APK"
        : "Release AAB";

  if (!json)
    console.log(
      chalk.gray(`\nBuilding ${label} for ${projectName} (${task})...\n`),
    );

  // 3. Run Gradle Wrapper (never global gradle)
  const spinner = json ? null : ora(`Running Gradle ${task}...`).start();
  const started = Date.now();
  try {
    await runGradle(projectName, [task], { verbose: opts.verbose });
    spinner?.succeed("Gradle build completed");
  } catch (e) {
    spinner?.fail("Gradle build failed");
    const msg = e instanceof Error ? e.message : String(e);
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          project: projectName,
          variant: target,
          error: msg,
        }),
      );
      process.exit(1);
    }
    console.log(chalk.red(`\n✗ Build failed\n`));
    console.log(chalk.gray(`Gradle exited with an error (task: ${task}).`));
    console.log(chalk.gray(`\nProject:\n  ${projectName}`));
    console.log(chalk.gray(`\nBuild:\n  ${label}`));
    console.log(
      chalk.gray(
        `\nRun:\n  web2apk build ${projectName} --${target === "aab" ? "aab" : target}\n`,
      ),
    );
    console.log(
      chalk.gray("Build logs:\n" + msg.split("\n").slice(0, 40).join("\n")),
    );
    process.exit(1);
  }

  // 4. Locate artifact (don't assume exact filename)
  const output = await findBuildOutput(projectName, target);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (!output) {
    const msg =
      "Build finished but no APK/AAB artifact was found in the expected output directory.";
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          project: projectName,
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
        project: projectName,
        type,
        variant: target === "aab" ? "release" : target,
        output,
        sizeBytes: stat.size,
        elapsedSeconds: Number(elapsed),
      }),
    );
    return;
  }

  console.log(chalk.green("✓ Project validated"));
  console.log(chalk.green("✓ Android template prepared"));
  console.log(chalk.green("✓ Configuration applied"));
  console.log(chalk.green("✓ Gradle build completed"));
  console.log(chalk.bold.green("\nBuild successful!\n"));
  console.log(chalk.gray(type === "aab" ? "AAB:" : "APK:"));
  console.log(chalk.white(`  ${output}\n`));
  console.log(chalk.gray("Size:"));
  console.log(chalk.white(`  ${size}\n`));
}
