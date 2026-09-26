import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";
import { projectDir } from "../utils/paths.js";
import { gradleInvocation } from "../utils/platform.js";

export type BuildTarget = "debug" | "release" | "aab";

export function targetToGradleTask(target: BuildTarget): string {
  switch (target) {
    case "debug":
      return "assembleDebug";
    case "release":
      return "assembleRelease";
    case "aab":
      return "bundleRelease";
  }
}

export async function runGradle(
  projectName: string,
  gradleArgs: string[],
  opts?: { verbose?: boolean },
): Promise<void> {
  const cwd = projectDir(projectName);
  const { file, args } = gradleInvocation(cwd, gradleArgs);
  await execa(file, args, { cwd, stdio: "inherit" });
  void opts;
}

export async function findBuildOutput(
  projectName: string,
  target: BuildTarget,
): Promise<string | null> {
  const dir = projectDir(projectName);
  const candidates: string[] = [];
  if (target === "debug")
    candidates.push(path.join(dir, "app", "build", "outputs", "apk", "debug"));
  else if (target === "release")
    candidates.push(
      path.join(dir, "app", "build", "outputs", "apk", "release"),
    );
  else
    candidates.push(
      path.join(dir, "app", "build", "outputs", "bundle", "release"),
    );

  const ext = target === "aab" ? ".aab" : ".apk";
  for (const c of candidates) {
    if (!(await fs.pathExists(c))) continue;
    const files = (await fs.readdir(c)).filter((f) => f.endsWith(ext));
    if (files.length === 0) continue;
    // Prefer release-named artifact, else newest by mtime
    files.sort();
    let best = path.join(c, files[0]!);
    let bestMtime = 0;
    for (const f of files) {
      const st = await fs.stat(path.join(c, f));
      if (st.mtimeMs >= bestMtime) {
        bestMtime = st.mtimeMs;
        best = path.join(c, f);
      }
    }
    return best;
  }
  return null;
}
