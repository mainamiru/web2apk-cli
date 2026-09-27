#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { createCommand } from "./commands/create.js";
import { validateCommand } from "./commands/validate.js";
import { buildCommand } from "./commands/build.js";
import { cleanCommand } from "./commands/clean.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { installCommand } from "./commands/install.js";
import { printBanner } from "./ui/banner.js";

const program = new Command();

program
  .name("web2apk")
  .description("Build Android apps from web")
  .version("1.0.0", "-V, --cli-version", "Output the CLI version number");

program
  .command("create <project-name>")
  .description("Create a new Android project from the template")
  .option("--name <name>", "App display name")
  .option(
    "--package <package>",
    "Android package name (e.g. com.example.mywebsite)",
  )
  .option("--url <url>", "Website URL")
  .option("--version <version>", "Version name (e.g. 1.0.0)")
  .option("--version-code <code>", "Version code (integer)")
  .option("--content-type <type>", "Content type: url | asset | html")
  .option(
    "--asset <path>",
    "Path to HTML file or asset directory (content-type asset)",
  )
  .option(
    "--html <path-or-string>",
    "HTML file path or inline HTML (content-type html)",
  )
  .option(
    "--icon <path>",
    "App icon source (PNG, JPG, WEBP or SVG) — generates all launcher densities",
  )
  .option("--json", "Machine-readable output")
  .option("--verbose", "Show full error stack traces")
  .action(async (projectName: string, options: Record<string, unknown>) => {
    try {
      await createCommand(projectName, options as never);
    } catch (err) {
      handleError(err, Boolean(options.verbose));
    }
  });

program
  .command("validate [project-name]")
  .description("Validate a generated project (defaults to the current directory)")
  .option("--json", "Machine-readable output")
  .action(async (projectName: string | undefined, options: { json?: boolean }) => {
    try {
      const ok = await validateCommand(projectName, options);
      if (!ok) process.exit(1);
    } catch (err) {
      handleError(err, false);
    }
  });

program
  .command("build [project-name]")
  .description(
    "Build APK/AAB with the project's Gradle Wrapper (defaults to the current directory)",
  )
  .option("--debug", "Build Debug APK (assembleDebug)")
  .option("--release", "Build Release APK (assembleRelease)")
  .option("--aab", "Build Release AAB (bundleRelease)")
  .option("--json", "Machine-readable output")
  .option("--verbose", "Show full error stack traces")
  .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
    try {
      await buildCommand(projectName, options as never);
    } catch (err) {
      handleError(err, Boolean(options.verbose));
    }
  });

program
  .command("clean [project-name]")
  .description("Run Gradle clean inside the generated project (defaults to the current directory)")
  .action(async (projectName: string | undefined) => {
    try {
      await cleanCommand(projectName);
    } catch (err) {
      handleError(err, false);
    }
  });

program
  .command("config [project-name]")
  .description("Read or update web2apk.config.json (defaults to the current directory)")
  .option("--name <name>", "App display name")
  .option(
    "--package <package>",
    "Android package name (e.g. com.example.mywebsite)",
  )
  .option("--url <url>", "Website URL")
  .option("--version <version>", "Version name (e.g. 1.0.0)")
  .option("--version-code <code>", "Version code (integer)")
  .option("--content-type <type>", "Content type: url | asset | html")
  .option(
    "--asset <path>",
    "Path to HTML file or asset directory (content-type asset)",
  )
  .option(
    "--html <path-or-string>",
    "HTML file path or inline HTML (content-type html)",
  )
  .option(
    "--icon <path>",
    "App icon source (PNG, JPG, WEBP or SVG) — generates all launcher densities",
  )
  .option("--json", "Machine-readable output")
  .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
    try {
      await configCommand(projectName, options as never);
    } catch (err) {
      handleError(err, false);
    }
  });

program
  .command("doctor")
  .description("Check the local Android build environment")
  .option("--json", "Machine-readable output")
  .action(async (options: { json?: boolean }) => {
    try {
      await doctorCommand(options);
    } catch (err) {
      handleError(err, false);
    }
  });

program
  .command("install")
  .description("Install missing SDK dependencies (Java, Android Studio, Android SDK)")
  .option("--java", "Install Java JDK")
  .option("--android-studio", "Install Android Studio")
  .option("--android-sdk", "Install Android SDK components")
  .option("--all", "Install all missing dependencies")
  .option("--force", "Force reinstall even if already installed")
  .action(async (options: Record<string, unknown>) => {
    try {
      await installCommand(options as never);
    } catch (err) {
      handleError(err, false);
    }
  });

// Default: show banner + help when no command given
if (process.argv.length <= 2) {
  printBanner();
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err) => handleError(err, false));

function handleError(err: unknown, verbose: boolean): never {
  const globalJson = process.argv.includes("--json");
  if (globalJson) {
    console.error(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exit(1);
  }
  console.log(
    chalk.red(
      `\n✗ ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\n`,
    ),
  );
  if (err instanceof Error && verbose) console.log(chalk.gray(err.stack || ""));
  else if (err instanceof Error && err.message.includes("\n"))
    console.log(chalk.gray(err.message));
  process.exit(1);
}
