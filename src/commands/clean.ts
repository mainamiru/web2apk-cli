import chalk from "chalk";
import ora from "ora";
import { runGradle } from "../core/gradle.js";
import { printBanner } from "../ui/banner.js";
import { projectDir } from "../utils/paths.js";
import fs from "fs-extra";

export async function cleanCommand(projectName: string): Promise<void> {
  printBanner("Clean Project");
  if (!(await fs.pathExists(projectDir(projectName)))) {
    console.log(chalk.red(`\n✗ Project not found: ${projectName}\n`));
    process.exit(1);
  }
  const spinner = ora("Running Gradle clean...").start();
  try {
    await runGradle(projectName, ["clean"]);
    spinner.succeed("Project cleaned");
  } catch (e) {
    spinner.fail("Clean failed");
    console.log(chalk.gray(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
}
