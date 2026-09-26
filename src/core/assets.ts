import path from "node:path";
import fs from "fs-extra";
import { projectDir } from "../utils/paths.js";

/**
 * AssetManager — clean service boundary for future icon/splash support.
 * First implementation: copy web assets + stub icon methods.
 */
export class AssetManager {
  /** Copy a local HTML file or folder into app/src/main/assets/www/. Returns relative asset path. */
  static async copyWebAssets(
    projectName: string,
    sourcePath: string,
  ): Promise<string> {
    const destBase = path.join(
      projectDir(projectName),
      "app",
      "src",
      "main",
      "assets",
      "www",
    );
    await fs.ensureDir(destBase);
    const stat = await fs.stat(sourcePath);
    if (stat.isDirectory()) {
      await fs.copy(sourcePath, destBase);
      return "www/index.html";
    }
    await fs.copy(sourcePath, path.join(destBase, path.basename(sourcePath)));
    return `www/${path.basename(sourcePath)}`;
  }

  /** Future: replace launcher icons from a source PNG. Currently a no-op stub. */
  static async copyIcon(
    _projectName: string,
    _iconPath: string,
  ): Promise<void> {
    return;
  }

  static async copySplash(
    _projectName: string,
    _splashPath: string,
  ): Promise<void> {
    return;
  }

  static async copyWebAssetsToDir(
    destBase: string,
    sourcePath: string,
  ): Promise<string> {
    await fs.ensureDir(destBase);
    const stat = await fs.stat(sourcePath);
    if (stat.isDirectory()) {
      await fs.copy(sourcePath, destBase);
      return "www/index.html";
    }
    await fs.copy(sourcePath, path.join(destBase, path.basename(sourcePath)));
    return `www/${path.basename(sourcePath)}`;
  }
}
