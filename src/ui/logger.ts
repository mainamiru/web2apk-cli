import chalk from "chalk";

let jsonMode = false;

export function setJsonMode(v: boolean): void {
  jsonMode = v;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function ok(msg: string): void {
  if (jsonMode) return;
  console.log(chalk.green(`✓ ${msg}`));
}

export function fail(msg: string): void {
  if (jsonMode) return;
  console.log(chalk.red(`✗ ${msg}`));
}

export function info(msg: string): void {
  if (jsonMode) return;
  console.log(chalk.gray(msg));
}

export function title(msg: string): void {
  if (jsonMode) return;
  console.log(chalk.bold.cyan(`\n${msg}\n`));
}

export function printErrorBlock(
  heading: string,
  received?: string,
  hint?: string,
): void {
  if (jsonMode) {
    console.error(JSON.stringify({ success: false, error: heading, received }));
    return;
  }
  console.log(chalk.red(`\n✗ ${heading}\n`));
  if (received !== undefined) {
    console.log(chalk.gray("Received:"));
    console.log(chalk.yellow(`  ${received}\n`));
  }
  if (hint) console.log(chalk.gray(hint));
}
