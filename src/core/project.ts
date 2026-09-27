import path from "node:path";
import fs from "fs-extra";
import { parseConfig, type Web2ApkConfig } from "../schemas/web2apk-config.js";
import { configFilePath, projectDir } from "../utils/paths.js";

export class ProjectManager {
  static async saveConfig(
    config: Web2ApkConfig,
    projectName?: string,
  ): Promise<string> {
    const file = configFilePath(projectName ?? config.project.name);
    await fs.ensureDir(path.dirname(file));
    // Validate before saving (single source of truth)
    const parsed = parseConfig(config);
    await fs.writeJson(file, parsed, { spaces: 2 });
    return file;
  }

  static async loadConfig(projectName?: string): Promise<Web2ApkConfig> {
    const file = configFilePath(projectName);
    if (!(await fs.pathExists(file))) {
      throw new Error(
        projectName
          ? `Configuration file not found for project "${projectName}".\n\nExpected: ${file}\nRun: web2apk create ${projectName}`
          : `Configuration file not found in the current directory.\n\nExpected: ${file}\nRun: web2apk create <project-name>, or cd into a generated project first.`,
      );
    }
    const raw = await fs.readJson(file);
    return parseConfig(raw);
  }

  static async exists(projectName?: string): Promise<boolean> {
    return fs.pathExists(projectDir(projectName));
  }
}
