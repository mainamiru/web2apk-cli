import { spawn, type ChildProcess } from "node:child_process";
import * as vscode from "vscode";

export interface RunJsonOptions {
  command: string;
  args: string[];
  cwd: string;
  output: vscode.OutputChannel;
  token?: vscode.CancellationToken;
  timeoutMs?: number;
}

export interface RunResult {
  code: number | null;
  output: string;
  payload: unknown | null;
  cancelled: boolean;
  timedOut: boolean;
}

interface TerminalOptions {
  command: string;
  args: string[];
  cwd?: string;
}

const MAX_OUTPUT = 4_000_000;
const TERMINAL_NAME = "Web2APK";

let terminal: vscode.Terminal | undefined;

/** Quote a value for both cmd.exe/PowerShell and POSIX shells. */
export function quoteForShell(value: string): string {
  if (!/[\s"'&|<>^()]/.test(value)) return value;
  if (process.platform === "win32") return `"${value.replace(/"/g, '""')}"`;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function runInTerminal(options: TerminalOptions): void {
  if (!terminal || terminal.exitStatus) {
    terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      cwd: options.cwd,
    });
  }
  terminal.show(true);
  const parts = [options.command, ...options.args].map(quoteForShell);
  if (options.cwd) {
    terminal.sendText(`cd ${quoteForShell(options.cwd)} && ${parts.join(" ")}`);
  } else {
    terminal.sendText(parts.join(" "));
  }
}

/**
 * Run the CLI capturing stdout/stderr, stream it into the output channel and
 * return the machine-readable payload printed with `--json`.
 */
export function runJson(options: RunJsonOptions): Promise<RunResult> {
  const line = [options.command, ...options.args]
    .map(quoteForShell)
    .join(" ");
  options.output.appendLine(`\n> ${line}`);
  options.output.appendLine(`  cwd: ${options.cwd}`);

  return new Promise<RunResult>((resolve, reject) => {
    const useShell = process.platform === "win32";
    let child: ChildProcess;
    try {
      // On Windows the command runs through cmd.exe so that npm `.cmd` shims
      // resolve. Arguments are pre-quoted into a single command line (passing
      // an args array with `shell: true` triggers Node's DEP0190 warning and
      // is not escaped anyway).
      child = useShell
        ? spawn(line, {
            cwd: options.cwd,
            shell: true,
            windowsHide: true,
            env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
          })
        : spawn(options.command, options.args, {
            cwd: options.cwd,
            windowsHide: true,
            detached: true,
            env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
          });
    } catch (error) {
      reject(error);
      return;
    }

    let buffer = "";
    let cancelled = false;
    let timedOut = false;
    let settled = false;

    const onChunk = (chunk: Buffer | string): void => {
      const text = chunk.toString();
      buffer += text;
      if (buffer.length > MAX_OUTPUT) {
        buffer = `[... earlier output truncated ...]\n${buffer.slice(
          -MAX_OUTPUT / 2,
        )}`;
      }
      options.output.append(text);
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);

    const cancellation = options.token?.onCancellationRequested(() => {
      cancelled = true;
      killTree(child);
    });
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killTree(child);
        }, options.timeoutMs)
      : undefined;

    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      cancellation?.dispose();
    };

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      options.output.appendLine(`\n[spawn error] ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      const payload = parseCliJson(buffer);
      if (timedOut) options.output.appendLine("\n[timed out]");
      else if (cancelled) options.output.appendLine("\n[cancelled]");
      else if (code !== 0) options.output.appendLine(`\n[exit code ${code ?? "?"}]`);
      resolve({ code, output: buffer, payload, cancelled, timedOut });
    });
  });
}

/**
 * The CLI prints single-line JSON for most commands but pretty-printed JSON for
 * others (`validate`, `doctor`, `config`), surrounded by banner, Gradle or
 * error text on both sides. Scan candidate `{` positions from the end, match
 * the balanced closing brace and accept the first object carrying `success`.
 */
export function parseCliJson<T>(text: string): T | null {
  const source = text.trim();
  if (!source) return null;

  const accept = (candidate: string): T | null => {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && "success" in value) {
        return value as T;
      }
    } catch {
      return null;
    }
    return null;
  };

  const whole = accept(source);
  if (whole) return whole;

  let start = source.lastIndexOf("{");
  while (start >= 0) {
    const end = findBalancedEnd(source, start);
    if (end >= 0) {
      const parsed = accept(source.slice(start, end + 1));
      if (parsed) return parsed;
    }
    if (start === 0) break;
    start = source.lastIndexOf("{", start - 1);
  }
  return null;
}

/** Index of the `}` closing the `{` at `start`, or -1 when unbalanced. */
function findBalancedEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    }).on("error", () => undefined);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}
