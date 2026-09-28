import inquirer from "inquirer";
import chalk from "chalk";
import { SDKInstaller } from "../core/installer.js";
import { printBanner } from "../ui/banner.js";

export interface InstallOptions {
  java?: boolean;
  androidStudio?: boolean;
  androidSdk?: boolean;
  all?: boolean;
  force?: boolean;
}

export async function installCommand(opts: InstallOptions): Promise<void> {
  printBanner("Install SDK Dependencies");

  // If no specific options provided, show interactive menu
  if (!opts.java && !opts.androidStudio && !opts.androidSdk && !opts.all) {
    const answers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "components",
        message: "Select components to install:",
        choices: [
          {
            name: "Java JDK 17",
            value: "java",
            checked: !(await SDKInstaller.checkJava()),
          },
          {
            name: "Android Studio",
            value: "androidStudio",
            checked: !(await SDKInstaller.checkAndroidStudio()),
          },
          {
            name: "Android SDK Components",
            value: "androidSdk",
            checked: true,
          },
        ],
      },
      {
        type: "confirm",
        name: "confirm",
        message: "Proceed with installation?",
        default: true,
      },
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow("\nInstallation cancelled.\n"));
      return;
    }

    // Install selected components
    if (answers.components.includes("java")) {
      opts.java = true;
    }
    if (answers.components.includes("androidStudio")) {
      opts.androidStudio = true;
    }
    if (answers.components.includes("androidSdk")) {
      opts.androidSdk = true;
    }
  }

  // Install all missing if --all flag is used
  if (opts.all) {
    await SDKInstaller.installAllMissing();
    return;
  }

  // Install individual components
  const results: Array<{
    component: string;
    success: boolean;
    message: string;
  }> = [];

  if (opts.java) {
    const hasJava = await SDKInstaller.checkJava();
    if (hasJava && !opts.force) {
      console.log(chalk.green("✓ Java JDK is already installed"));
    } else {
      console.log(chalk.yellow("Installing Java JDK..."));
      const result = await SDKInstaller.installJava();
      results.push({
        component: "Java JDK",
        success: result.success,
        message: result.message,
      });
    }
  }

  if (opts.androidStudio) {
    const hasAndroidStudio = await SDKInstaller.checkAndroidStudio();
    if (hasAndroidStudio && !opts.force) {
      console.log(chalk.green("✓ Android Studio is already installed"));
    } else {
      console.log(chalk.yellow("Installing Android Studio..."));
      const result = await SDKInstaller.installAndroidStudio();
      results.push({
        component: "Android Studio",
        success: result.success,
        message: result.message,
      });
    }
  }

  if (opts.androidSdk) {
    const hasAndroidSDK = await SDKInstaller.checkAndroidSDK();
    if (!hasAndroidSDK) {
      console.log(
        chalk.red(
          "✗ Android SDK not found. Please install Android Studio first.",
        ),
      );
      results.push({
        component: "Android SDK Components",
        success: false,
        message: "Android SDK not found",
      });
    } else {
      console.log(chalk.yellow("Installing Android SDK components..."));
      const result = await SDKInstaller.installAndroidSDKComponents();
      results.push({
        component: "Android SDK Components",
        success: result.success,
        message: result.message,
      });
    }
  }

  // Print results
  if (results.length > 0) {
    console.log(chalk.bold("\n📋 Installation Results:\n"));

    let allSuccess = true;
    for (const result of results) {
      if (result.success) {
        console.log(chalk.green(`✓ ${result.component}: ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.component}: ${result.message}`));
        allSuccess = false;
      }
    }

    if (allSuccess) {
      console.log(chalk.green("\n✓ Installation completed successfully!"));
      console.log(
        chalk.yellow(
          "Please restart your terminal and run 'web2apk doctor' to verify.\n",
        ),
      );
    } else {
      console.log(
        chalk.red(
          "\n✗ Some components failed to install. Please install them manually.\n",
        ),
      );
    }
  } else {
    console.log(
      chalk.green("\n✓ All selected components are already installed!\n"),
    );
  }
}
