import { execa } from "execa";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "node:path";
import { isWindows } from "../utils/platform.js";

export interface InstallResult {
  success: boolean;
  message: string;
  requiresRestart?: boolean;
}

export class SDKInstaller {
  /**
   * Install Java JDK
   */
  static async installJava(): Promise<InstallResult> {
    const spinner = ora("Installing Java JDK...").start();

    try {
      if (isWindows()) {
        // Windows: Use winget to install OpenJDK 17
        await execa("winget", [
          "install",
          "--id",
          "Microsoft.OpenJDK.17",
          "--silent",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ]);
        spinner.succeed("Java JDK 17 installed successfully");
        return {
          success: true,
          message:
            "Java JDK 17 installed via winget. Please restart your terminal.",
          requiresRestart: true,
        };
      } else if (process.platform === "darwin") {
        // macOS: Use Homebrew to install OpenJDK 17
        await execa("brew", ["install", "openjdk@17"]);

        // Create symlink for macOS
        await execa("sudo", [
          "ln",
          "-sfn",
          "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk",
          "/Library/Java/JavaVirtualMachines/openjdk-17.jdk",
        ]);

        spinner.succeed("Java JDK 17 installed successfully");
        return {
          success: true,
          message:
            "Java JDK 17 installed via Homebrew. Please restart your terminal.",
          requiresRestart: true,
        };
      } else {
        // Linux: Use apt to install OpenJDK 17
        await execa("sudo", ["apt-get", "update"]);
        await execa("sudo", ["apt-get", "install", "-y", "openjdk-17-jdk"]);

        spinner.succeed("Java JDK 17 installed successfully");
        return {
          success: true,
          message:
            "Java JDK 17 installed via apt. Please restart your terminal.",
          requiresRestart: true,
        };
      }
    } catch (error) {
      spinner.fail("Failed to install Java JDK");
      return {
        success: false,
        message: `Failed to install Java JDK: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Install Android Studio (which includes Android SDK)
   */
  static async installAndroidStudio(): Promise<InstallResult> {
    const spinner = ora("Installing Android Studio...").start();

    try {
      if (isWindows()) {
        // First check if already installed via winget
        try {
          await execa("winget", ["list", "--id", "Google.AndroidStudio"]);
          spinner.succeed("Android Studio is already installed");
          return {
            success: true,
            message:
              "Android Studio is already installed via winget. If you need to reinstall, use the --force flag.",
          };
        } catch {
          // Not installed, proceed with installation
        }

        // Windows: Use winget to install Android Studio
        await execa("winget", [
          "install",
          "--id",
          "Google.AndroidStudio",
          "--silent",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ]);
        spinner.succeed("Android Studio installed successfully");
        return {
          success: true,
          message:
            "Android Studio installed via winget. Please launch Android Studio and complete the initial setup to install the Android SDK.",
          requiresRestart: true,
        };
      } else if (process.platform === "darwin") {
        // macOS: Use Homebrew Cask to install Android Studio
        await execa("brew", ["install", "--cask", "android-studio"]);
        spinner.succeed("Android Studio installed successfully");
        return {
          success: true,
          message:
            "Android Studio installed via Homebrew. Please launch Android Studio and complete the initial setup to install the Android SDK.",
          requiresRestart: true,
        };
      } else {
        // Linux: Download and install Android Studio
        spinner.fail(
          "Automatic Android Studio installation not supported on Linux",
        );
        return {
          success: false,
          message:
            "Please install Android Studio manually: https://developer.android.com/studio",
        };
      }
    } catch (error) {
      spinner.fail("Failed to install Android Studio");
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if the error is because it's already installed
      if (
        errorMessage.includes("already installed") ||
        errorMessage.includes("cannot be upgraded")
      ) {
        return {
          success: true,
          message:
            "Android Studio is already installed. If you need to reinstall, use the --force flag.",
        };
      }

      return {
        success: false,
        message: `Failed to install Android Studio: ${errorMessage}`,
      };
    }
  }

  /**
   * Install Android SDK components using sdkmanager
   */
  static async installAndroidSDKComponents(): Promise<InstallResult> {
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

    if (!sdkRoot || !(await fs.pathExists(sdkRoot))) {
      return {
        success: false,
        message: "Android SDK not found. Please install Android Studio first.",
      };
    }

    const spinner = ora("Installing Android SDK components...").start();

    try {
      const sdkmanagerPath = isWindows()
        ? path.join(sdkRoot, "cmdline-tools", "latest", "bin", "sdkmanager.bat")
        : path.join(sdkRoot, "cmdline-tools", "latest", "bin", "sdkmanager");

      if (!(await fs.pathExists(sdkmanagerPath))) {
        spinner.fail("sdkmanager not found");
        return {
          success: false,
          message:
            "sdkmanager not found. Please install Android SDK Command-line Tools via Android Studio SDK Manager.",
        };
      }

      // Install platform-tools and latest Android platform
      await execa(
        sdkmanagerPath,
        [
          "platform-tools",
          "platform-tools",
          "platforms;android-34",
          "build-tools;34.0.0",
        ],
        {
          env: {
            ...process.env,
            ANDROID_HOME: sdkRoot,
            ANDROID_SDK_ROOT: sdkRoot,
          },
        },
      );

      spinner.succeed("Android SDK components installed successfully");
      return {
        success: true,
        message: "Android SDK components installed successfully.",
      };
    } catch (error) {
      spinner.fail("Failed to install Android SDK components");
      return {
        success: false,
        message: `Failed to install Android SDK components: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check if a command exists
   */
  static async commandExists(cmd: string): Promise<boolean> {
    try {
      await execa(process.platform === "win32" ? "where" : "which", [cmd]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Java is installed
   */
  static async checkJava(): Promise<boolean> {
    try {
      await execa("java", ["-version"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Android SDK is installed
   */
  static async checkAndroidSDK(): Promise<boolean> {
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    return sdkRoot ? await fs.pathExists(sdkRoot) : false;
  }

  /**
   * Check if Android Studio is installed
   */
  static async checkAndroidStudio(): Promise<boolean> {
    if (isWindows()) {
      // Check multiple possible installation paths on Windows
      const possiblePaths = [
        path.join(
          process.env.LOCALAPPDATA || "",
          "Programs",
          "Android Studio",
          "studio64.exe",
        ),
        path.join(
          process.env.PROGRAMFILES || "",
          "Android",
          "Android Studio",
          "bin",
          "studio64.exe",
        ),
        path.join(
          process.env.PROGRAMFILES || "",
          "Android",
          "Android Studio",
          "bin",
          "studio.bat",
        ),
        path.join(
          process.env.LOCALAPPDATA || "",
          "Android",
          "android-studio",
          "bin",
          "studio64.exe",
        ),
      ];

      for (const checkPath of possiblePaths) {
        if (await fs.pathExists(checkPath)) {
          return true;
        }
      }

      // Also check using winget
      try {
        await execa("winget", ["list", "--id", "Google.AndroidStudio"]);
        return true;
      } catch {
        return false;
      }
    } else if (process.platform === "darwin") {
      const androidStudioPath = "/Applications/Android Studio.app";
      return await fs.pathExists(androidStudioPath);
    } else {
      // Linux - check common installation paths
      const commonPaths = [
        "/opt/android-studio/bin/studio.sh",
        "/usr/local/android-studio/bin/studio.sh",
        path.join(process.env.HOME || "", "android-studio", "bin", "studio.sh"),
      ];

      for (const checkPath of commonPaths) {
        if (await fs.pathExists(checkPath)) {
          return true;
        }
      }
      return false;
    }
  }

  /**
   * Install all missing dependencies
   */
  static async installAllMissing(): Promise<void> {
    console.log(chalk.bold("\n🔧 Checking for missing dependencies...\n"));

    const results: Array<{ component: string; result: InstallResult }> = [];

    // Check and install Java
    const hasJava = await this.checkJava();
    if (!hasJava) {
      console.log(chalk.yellow("Java JDK not found. Installing..."));
      const result = await this.installJava();
      results.push({ component: "Java JDK", result });
    } else {
      console.log(chalk.green("✓ Java JDK is already installed"));
    }

    // Check and install Android Studio
    const hasAndroidStudio = await this.checkAndroidStudio();
    if (!hasAndroidStudio) {
      console.log(chalk.yellow("Android Studio not found. Installing..."));
      const result = await this.installAndroidStudio();
      results.push({ component: "Android Studio", result });
    } else {
      console.log(chalk.green("✓ Android Studio is already installed"));
    }

    // Check and install Android SDK components
    const hasAndroidSDK = await this.checkAndroidSDK();
    if (!hasAndroidSDK) {
      console.log(
        chalk.yellow(
          "Android SDK not found. Please install Android Studio and complete the setup first.",
        ),
      );
    } else {
      console.log(chalk.green("✓ Android SDK is found"));

      // Check for required SDK components
      const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (sdkRoot) {
        const platformsPath = path.join(sdkRoot, "platforms");
        const buildToolsPath = path.join(sdkRoot, "build-tools");

        const hasPlatforms =
          (await fs.pathExists(platformsPath)) &&
          (await fs.readdir(platformsPath)).length > 0;
        const hasBuildTools =
          (await fs.pathExists(buildToolsPath)) &&
          (await fs.readdir(buildToolsPath)).length > 0;

        if (!hasPlatforms || !hasBuildTools) {
          console.log(
            chalk.yellow("Android SDK components missing. Installing..."),
          );
          const result = await this.installAndroidSDKComponents();
          results.push({ component: "Android SDK Components", result });
        } else {
          console.log(chalk.green("✓ Android SDK components are installed"));
        }
      }
    }

    // Print summary
    console.log(chalk.bold("\n📋 Installation Summary:\n"));

    let allSuccess = true;
    for (const { component, result } of results) {
      if (result.success) {
        console.log(chalk.green(`✓ ${component}: ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${component}: ${result.message}`));
        allSuccess = false;
      }
    }

    if (results.length === 0) {
      console.log(chalk.green("All dependencies are already installed!"));
    } else if (allSuccess) {
      console.log(
        chalk.green("\n✓ All missing dependencies installed successfully!"),
      );

      const requiresRestart = results.some((r) => r.result.requiresRestart);
      if (requiresRestart) {
        console.log(
          chalk.yellow(
            "\n⚠️  Please restart your terminal and run 'web2apk doctor' to verify the installation.",
          ),
        );
      }
    } else {
      console.log(
        chalk.red(
          "\n✗ Some dependencies failed to install. Please install them manually.",
        ),
      );
    }
  }
}
