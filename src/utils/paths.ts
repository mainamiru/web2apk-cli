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

/**
 * Resolve a generated project directory.
 * An omitted/empty project name means "the current working directory", so
 * `web2apk build` inside a generated project works without arguments.
 */
export function projectDir(projectName?: string): string {
  if (!projectName) return projectsDir();
  return path.join(projectsDir(), projectName);
}

export function configFilePath(projectName?: string): string {
  return path.join(projectDir(projectName), "web2apk.config.json");
}

/** Human readable project label for logs, hints and machine-readable output. */
export function projectLabel(projectName?: string): string {
  return projectName || path.basename(process.cwd());
}
