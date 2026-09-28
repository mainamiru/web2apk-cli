/** Smallest CLI version that ships the `config` command and the icon pipeline. */
export const MIN_CLI_VERSION = "1.0.1";

/** Package published on npm — used by the Install CLI command. */
export const CLI_PACKAGE = "@mainamiru/web2apk-cli";

export function isValidProjectName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(name) && name.length <= 64;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ""
  );
}

export function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
