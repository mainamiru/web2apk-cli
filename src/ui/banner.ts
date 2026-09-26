import chalk from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";

export function printBanner(subtitle?: string): void {
  let title = "Web2APK";
  try {
    title = figlet.textSync("Web2APK", {
      font: "ANSI Shadow",
      horizontalLayout: "default",
      verticalLayout: "default",
    });
  } catch {
    // fall back to plain title
  }
  console.log(gradient(["#2563EB", "#06B6D4"]).multiline(title));
  console.log(chalk.gray("  Build Android apps from web"));
  if (subtitle) console.log(chalk.cyan(`\n${subtitle}\n`));
  else console.log();
}
