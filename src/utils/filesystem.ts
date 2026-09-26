import fs from "fs-extra";

export async function pathExists(p: string): Promise<boolean> {
  return fs.pathExists(p);
}

export async function readJson<T>(p: string): Promise<T> {
  return fs.readJson(p) as Promise<T>;
}

export async function writeJsonPretty(p: string, data: unknown): Promise<void> {
  await fs.writeJson(p, data, { spaces: 2 });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}
