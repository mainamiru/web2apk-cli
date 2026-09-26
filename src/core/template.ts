import path from "node:path";
import fs from "fs-extra";
import { TEMPLATE_DIR, projectDir } from "../utils/paths.js";

const COPY_FILTER = (src: string): boolean => {
  const rel = path.relative(TEMPLATE_DIR, src);
  // Skip machine-local / build outputs so generated projects stay clean
  const skip = ["build", ".gradle", ".idea", ".kotlin", "local.properties"];
  const parts = rel.split(path.sep);
  if (parts.some((p) => skip.includes(p))) return false;
  return true;
};

export class TemplateManager {
  /** Copy the read-only master template to projects/<name>. Never modifies the template. */
  static async cloneTemplate(projectName: string): Promise<string> {
    const dest = projectDir(projectName);
    if (await fs.pathExists(dest)) {
      throw new Error(
        `Project already exists: ${projectName}\n\nUse another project name or remove the existing project.`,
      );
    }
    if (!(await fs.pathExists(TEMPLATE_DIR))) {
      throw new Error(`Android template not found at ${TEMPLATE_DIR}`);
    }
    await fs.ensureDir(path.dirname(dest));
    await fs.copy(TEMPLATE_DIR, dest, { filter: COPY_FILTER });
    return dest;
  }

  static async projectExists(projectName: string): Promise<boolean> {
    return fs.pathExists(projectDir(projectName));
  }

  static async gradleWrapperExists(projectName: string): Promise<boolean> {
    const dir = projectDir(projectName);
    const bat = await fs.pathExists(path.join(dir, "gradlew.bat"));
    const sh = await fs.pathExists(path.join(dir, "gradlew"));
    const jar = await fs.pathExists(
      path.join(dir, "gradle", "wrapper", "gradle-wrapper.jar"),
    );
    return bat && sh && jar;
  }
}
