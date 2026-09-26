import path from "node:path";
import { fileURLToPath } from "node:url";

function findModuleRoot(): string {
  // src/utils -> src -> package root
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/utils or src/utils both resolve two levels up
  return path.resolve(here, "..", "..");
}

export const REPO_ROOT = findModuleRoot();

/** Read-only master template ships with the CLI package — always resolved from the module. */
export const TEMPLATE_DIR = path.join(REPO_ROOT, "android-template");

/**
 * Generated projects live where the user invokes the CLI (current working
 * directory), NOT inside the CLI package. This keeps global installs clean:
 * `cd D:\MyWork && web2apk create my-app` → `D:\MyWork\projects\my-app`.
 */
export function projectsDir(): string {
  return path.join(process.cwd());
}

export function projectDir(projectName: string): string {
  return path.join(projectsDir(), projectName);
}

export function configFilePath(projectName: string): string {
  return path.join(projectDir(projectName), "web2apk.config.json");
}
