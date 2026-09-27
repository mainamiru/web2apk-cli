import path from "node:path";
import fs from "fs-extra";
import { projectDir } from "../utils/paths.js";

/** Project-relative prefix where the user supplied icon is stored (`assets/icon.<ext>`). */
export const ICON_SOURCE_PREFIX = "assets/icon";

/** Minimum size recommended for a source icon (all densities are derived from it). */
const MIN_RECOMMENDED = 512;

const SUPPORTED_EXT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
];

/** Launcher densities: folder -> pixel size of `ic_launcher.png`. */
const DENSITIES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
] as const;

/** The adaptive-icon foreground layer (`ic_web2apk_icon.png`, 72dp inside a 108dp canvas). */
const ADAPTIVE_SIZE = 512;

type Sharp = typeof import("sharp");

export interface IconGenerationResult {
  /** Absolute paths of every file written. */
  files: string[];
  /** Non-fatal problems, e.g. a source icon that is too small. */
  warnings: string[];
}

export class IconGenerator {
  private static async loadSharp(): Promise<Sharp> {
    try {
      // sharp is CJS: Node exposes module.exports as `default` for ESM importers
      const mod = (await import("sharp")) as unknown as { default?: unknown };
      const resolved =
        typeof mod.default === "function" ? mod.default : mod;
      return resolved as unknown as Sharp;
    } catch {
      throw new Error(
        'Icon processing is unavailable: the "sharp" module could not be loaded.\n' +
          "Reinstall the CLI with Node.js 18.17 or newer: npm i -g @mainamiru/web2apk-cli",
      );
    }
  }

  /**
   * Copy a user supplied icon into the project (`assets/icon.<ext>`) and return
   * the project-relative path to store in `app.icon`.
   */
  static async ingest(
    projectName: string | undefined,
    sourcePath: string,
  ): Promise<string> {
    const abs = path.resolve(sourcePath);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`Icon file not found: ${sourcePath}`);
    }
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      throw new Error(`Icon path is not a file: ${sourcePath}`);
    }
    const ext = path.extname(abs).toLowerCase();
    if (!SUPPORTED_EXT.includes(ext)) {
      throw new Error(
        `Unsupported icon format "${ext || "(none)"}" — supported: ${SUPPORTED_EXT.join(", ")}`,
      );
    }

    const rel = `${ICON_SOURCE_PREFIX}${ext}`;
    const dest = path.join(projectDir(projectName), rel);
    if (path.resolve(abs) !== path.resolve(dest)) {
      const dir = path.dirname(dest);
      await fs.ensureDir(dir);
      // Drop copies left over from a previous icon with a different extension
      for (const f of await fs.readdir(dir)) {
        if (/^icon\.[a-z0-9]+$/i.test(f) && path.join(dir, f) !== dest) {
          await fs.remove(path.join(dir, f));
        }
      }
      await fs.copy(abs, dest, { overwrite: true });
    }
    return rel;
  }

  /** Resolve a configured icon value to an existing file, or null. */
  static async resolveSource(
    projectName: string | undefined,
    value: string,
  ): Promise<string | null> {
    if (!value) return null;
    const candidates = path.isAbsolute(value)
      ? [value]
      : [path.join(projectDir(projectName), value), path.resolve(value)];
    for (const c of candidates) {
      if (await fs.pathExists(c)) return c;
    }
    return null;
  }

  /**
   * Generate every launcher icon from a source image:
   * square + round PNGs for all densities and the adaptive foreground.
   */
  static async generate(
    projectName: string | undefined,
    sourcePath: string,
  ): Promise<IconGenerationResult> {
    const sharp = await this.loadSharp();
    const abs = path.resolve(sourcePath);
    if (!(await fs.pathExists(abs))) {
      throw new Error(`Icon file not found: ${sourcePath}`);
    }

    const warnings: string[] = [];
    let meta: { width?: number; height?: number; format?: string };
    try {
      meta = await sharp(abs).metadata();
    } catch (e) {
      throw new Error(
        `Could not read icon "${sourcePath}": ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`,
      );
    }
    // Vector sources scale without loss — no size warning for them
    const isVector = meta.format === "svg";
    if (
      !isVector &&
      ((meta.width ?? 0) < MIN_RECOMMENDED ||
        (meta.height ?? 0) < MIN_RECOMMENDED)
    ) {
      warnings.push(
        `Icon source is ${meta.width ?? "?"}x${meta.height ?? "?"} — ${MIN_RECOMMENDED}x${MIN_RECOMMENDED} or larger is recommended (it will be upscaled).`,
      );
    }

    const resDir = path.join(
      projectDir(projectName),
      "app",
      "src",
      "main",
      "res",
    );
    const files: string[] = [];

    // Square: pad to a transparent square so non-square sources stay centered
    const contain = (size: number) =>
      sharp(abs).resize(size, size, {
        fit: "contain",
        kernel: "lanczos3",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

    // Circle mask used for the round launcher icons
    const circleMask = async (size: number) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`;
      return sharp(Buffer.from(svg)).png().toBuffer();
    };

    const jobs: Array<Promise<unknown>> = [];
    for (const { dir, size } of DENSITIES) {
      jobs.push(
        (async () => {
          const outDir = path.join(resDir, dir);
          await fs.ensureDir(outDir);

          const base = await contain(size).png().toBuffer();
          const squarePath = path.join(outDir, "ic_launcher.png");
          await fs.writeFile(squarePath, base);
          files.push(squarePath);

          const roundPath = path.join(outDir, "ic_launcher_round.png");
          await sharp(base)
            .composite([{ input: await circleMask(size), blend: "dest-in" }])
            .png()
            .toFile(roundPath);
          files.push(roundPath);
        })(),
      );
    }

    // Adaptive foreground (referenced by drawable/ic_launcher_foreground.xml)
    jobs.push(
      (async () => {
        const out = path.join(resDir, "drawable", "ic_web2apk_icon.png");
        await fs.ensureDir(path.dirname(out));
        await contain(ADAPTIVE_SIZE).png().toFile(out);
        files.push(out);
      })(),
    );

    await Promise.all(jobs);
    return { files, warnings };
  }
}
