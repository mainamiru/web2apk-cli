import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";
import { printBanner } from "../ui/banner.js";
import { TEMPLATE_DIR } from "../utils/paths.js";
import inquirer from "inquirer";
import { SDKInstaller } from "../core/installer.js";

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

async function cmdExists(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execa(
      process.platform === "win32" ? "where" : "which",
      [cmd],
    );
    return stdout.split("\n")[0]?.trim() || null;
  } catch {
    return null;
  }
}

export async function doctorCommand(opts?: { json?: boolean }): Promise<void> {
  const json = Boolean(opts?.json);
  if (!json) printBanner("Web2APK Environment");

  const checks: Check[] = [];

  // Node.js
  checks.push({ label: `Node.js ${process.version}`, ok: true });

  // Java/JDK
  let javaOk = false;
  let javaDetail = "";
  try {
    const { stdout, stderr } = await execa("java", ["-version"]);
    const out = `${stdout}\n${stderr}`.trim().split("\n")[0] || "";
    javaOk = true;
    javaDetail = out;
  } catch {
    javaDetail = "java not found on PATH";
  }
  checks.push({
    label: javaOk ? `Java ${javaDetail}` : "Java/JDK",
    ok: javaOk,
    detail: javaOk ? undefined : javaDetail,
  });

  // Android SDK
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
  const sdkExists = sdkRoot ? await fs.pathExists(sdkRoot) : false;
  checks.push({
    label: sdkExists ? `Android SDK (${sdkRoot})` : "Android SDK",
    ok: sdkExists,
    detail: sdkExists
      ? undefined
      : "ANDROID_HOME/ANDROID_SDK_ROOT not set or SDK directory missing. Install Android Studio and set ANDROID_HOME.",
  });
  checks.push({
    label: "ANDROID_HOME / ANDROID_SDK_ROOT",
    ok: Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT),
    detail: `ANDROID_HOME=${process.env.ANDROID_HOME || "(unset)"}`,
  });

  // SDK Platform + Build Tools
  if (sdkRoot && (await fs.pathExists(sdkRoot))) {
    const platforms = (await fs.pathExists(path.join(sdkRoot, "platforms")))
      ? await fs.readdir(path.join(sdkRoot, "platforms"))
      : [];
    checks.push({
      label: platforms.length
        ? `Android SDK Platform (${platforms.join(", ")})`
        : "Android SDK Platform",
      ok: platforms.length > 0,
      detail: platforms.length
        ? undefined
        : "No platforms found under $ANDROID_HOME/platforms",
    });
    const tools = (await fs.pathExists(path.join(sdkRoot, "build-tools")))
      ? await fs.readdir(path.join(sdkRoot, "build-tools"))
      : [];
    checks.push({
      label: tools.length
        ? `Android Build Tools (${tools.join(", ")})`
        : "Android Build Tools",
      ok: tools.length > 0,
      detail: tools.length
        ? undefined
        : "No build-tools found under $ANDROID_HOME/build-tools",
    });
  } else {
    checks.push({
      label: "Android SDK Platform",
      ok: false,
      detail: "SDK not found",
    });
    checks.push({
      label: "Android Build Tools",
      ok: false,
      detail: "SDK not found",
    });
  }

  // Gradle wrapper in template
  const jar = await fs.pathExists(
    path.join(TEMPLATE_DIR, "gradle", "wrapper", "gradle-wrapper.jar"),
  );
  checks.push({
    label: "Gradle Wrapper (template)",
    ok: jar,
    detail: jar ? undefined : "gradle-wrapper.jar missing in android-template",
  });

  // Optional tools
  void cmdExists;

  const allOk = checks.every((c) => c.ok);
  if (json) {
    console.log(JSON.stringify({ success: allOk, checks }, null, 2));
    return;
  }
  for (const c of checks) {
    console.log(
      `${c.ok ? chalk.green("✓") : chalk.red("✗")} ${c.ok ? c.label : `${c.label}${c.detail ? chalk.gray(` — ${c.detail}`) : ""}`}`,
    );
  }
  
  if (!allOk) {
    console.log(
      chalk.yellow(
        "\nSome checks failed. Install the missing components above.\n",
      ),
    );

    // Offer to auto-install missing components
    if (process.stdin.isTTY) {
      const missingComponents: string[] = [];
      
      // Check for missing Java
      const javaCheck = checks.find(c => c.label.includes("Java"));
      if (javaCheck && !javaCheck.ok) {
        missingComponents.push("Java JDK");
      }
      
      // Check for missing Android SDK (by checking if ANDROID_HOME is set)
      const androidHomeCheck = checks.find(c => c.label.includes("ANDROID_HOME"));
      if (androidHomeCheck && !androidHomeCheck.ok) {
        missingComponents.push("Android Studio/SDK");
      }
      
      // Check for missing SDK platforms or build tools
      const platformCheck = checks.find(c => c.label.includes("Android SDK Platform"));
      const buildToolsCheck = checks.find(c => c.label.includes("Android Build Tools"));
      if ((platformCheck && !platformCheck.ok) || (buildToolsCheck && !buildToolsCheck.ok)) {
        if (!missingComponents.includes("Android SDK Components")) {
          missingComponents.push("Android SDK Components");
        }
      }

      if (missingComponents.length > 0) {
        const { shouldInstall } = await inquirer.prompt([
          {
            type: "confirm",
            name: "shouldInstall",
            message: `Would you like to automatically install missing components (${missingComponents.join(", ")})?`,
            default: true,
          },
        ]);

        if (shouldInstall) {
          console.log(chalk.bold("\n🔧 Starting automatic installation...\n"));
          await SDKInstaller.installAllMissing();
        }
      }
    }
  } else {
    console.log(chalk.green("\nEnvironment is ready.\n"));
  }
}
