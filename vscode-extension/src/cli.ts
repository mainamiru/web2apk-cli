import { exec } from "node:child_process";
import * as vscode from "vscode";
import type { CliInfo } from "./types";

let cached: CliInfo | null = null;
let cachedKey = "";

export function cliCommand(): string {
  const value = vscode.workspace
    .getConfiguration("web2apk")
    .get<string>("cliPath", "web2apk")
    .trim();
  return value.length > 0 ? value : "web2apk";
}

export function invalidateCli(): void {
  cached = null;
  cachedKey = "";
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .replace(/^[^\d]+/, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Resolve the CLI by asking it for its version. Uses a shell (cmd.exe on
 * Windows) so that `.cmd` shims installed by npm are found on PATH.
 */
export function probeCli(force = false): Promise<CliInfo> {
  const command = cliCommand();
  if (!force && cached && cachedKey === command) return Promise.resolve(cached);

  return new Promise((resolve) => {
    exec(
      `${quote(command)} --cli-version`,
      { timeout: 20000, windowsHide: true },
      (error, stdout, stderr) => {
        const text = `${stdout ?? ""}\n${stderr ?? ""}`;
        const version = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^\d+\.\d+\.\d+/.test(line))
          .pop();

        const info: CliInfo = version
          ? { command, found: true, version }
          : {
              command,
              found: false,
              version: "",
              error:
                text.trim().split(/\r?\n/)[0] ||
                (error ? error.message : "no output"),
            };
        cached = info;
        cachedKey = command;
        resolve(info);
      },
    );
  });
}

function quote(value: string): string {
  return /[\s"'&|<>^()]/.test(value)
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}
