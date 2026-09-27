import { z } from "zod";

// ---------- Primitive validators ----------

export function isValidProjectName(name: string): boolean {
  // Safe directory name: letters, numbers, dashes, underscores; no slashes, no leading dot/dash
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(name) && name.length <= 64;
}

export function isValidPackageName(pkg: string): boolean {
  // Android package: >=2 dot-separated segments, each starting with letter,
  // containing letters/numbers/underscores; no keywords issues handled simply.
  // Reject single-segment ("com.example" is technically 2 segs but too generic? spec says invalid)
  if (!pkg || pkg.length > 255) return false;
  if (pkg.startsWith(".") || pkg.endsWith(".")) return false;
  if (pkg.includes("..")) return false;
  const segments = pkg.split(".");
  if (segments.length < 2) return false;
  // Spec explicitly marks "com.example" as invalid (needs 3+ segments or at least app segment)
  if (segments.length < 3) return false;
  const segRe = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  for (const s of segments) {
    if (!segRe.test(s)) return false;
    if (/^\d/.test(s)) return false;
  }
  // Reject Java keywords commonly problematic
  const keywords = new Set([
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "float",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "void",
    "volatile",
    "while",
    "true",
    "false",
    "null",
  ]);
  for (const s of segments) {
    if (keywords.has(s.toLowerCase())) return false;
  }
  return true;
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHosts(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(",") : input;
  return raw
    .split(/[,\;]+/)
    .map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .trim(),
    )
    .map((h) => h.replace(/:\d+$/, ""))
    .filter(
      (h) =>
        h.length > 0 && /^[a-z0-9_.-]+(:\d+)?$/i.test(h) && h.includes("."),
    )
    .filter((h, i, arr) => arr.indexOf(h) === i);
}

// ---------- Zod schema (single source of truth) ----------

export const ProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(64)
    .refine(isValidProjectName, {
      message:
        'Invalid project name. Use letters, numbers, "-" and "_" (e.g. my-app).',
    }),
});

export const AppSchema = z.object({
  name: z.string().min(1, "App name is required").max(100),
  packageName: z
    .string()
    .min(1, "Package name is required")
    .refine(isValidPackageName, {
      message: "Invalid package name. Expected format: com.company.myapp",
    }),
  versionName: z
    .string()
    .min(1)
    .regex(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/, {
      message: 'Invalid version name. Expected semver like "1.0.0".',
    }),
  versionCode: z.coerce.number().int().min(1).max(2100000000),
  /** Project-relative source icon (e.g. assets/icon.png). Empty = template icons. */
  icon: z.string().max(512).default(""),
});

export const ContentSchema = z
  .object({
    type: z.enum(["url", "asset", "html"]),
    url: z.string().default(""),
    assetPath: z.string().default("www/index.html"),
    rawHtml: z.string().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.type === "url" && !isValidUrl(val.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "Invalid URL. Must start with http:// or https:// (prefer https://).",
      });
    }
    if (
      val.type === "asset" &&
      (!val.assetPath || val.assetPath.trim() === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["assetPath"],
        message: "Asset path is required when content type is 'asset'.",
      });
    }
    if (val.type === "html" && (!val.rawHtml || val.rawHtml.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["rawHtml"],
        message: "Raw HTML is required when content type is 'html'.",
      });
    }
  });

export const WebviewSchema = z.object({
  allowedHosts: z.array(z.string().min(1)).default([]),
  userAgentSuffix: z.string().max(200).default(""),
  javascript: z.boolean().default(true),
  domStorage: z.boolean().default(true),
  database: z.boolean().default(true),
  builtInZoom: z.boolean().default(true),
  displayZoomControls: z.boolean().default(false),
  pullToRefresh: z.boolean().default(true),
  topProgressBar: z.boolean().default(true),
  centerLoader: z.boolean().default(false),
  fileUpload: z.boolean().default(true),
  downloads: z.boolean().default(true),
  geolocation: z.boolean().default(false),
  cameraMicrophone: z.boolean().default(false),
  notifications: z.boolean().default(false),
  backNavigation: z.boolean().default(true),
  confirmExit: z.boolean().default(true),
  mixedContent: z.boolean().default(false),
  clearCacheOnExit: z.boolean().default(false),
  multipleWindows: z.boolean().default(true),
  autoRetryNetworkRecovery: z.boolean().default(true),
});

export const Web2ApkConfigSchema = z.object({
  project: ProjectSchema,
  app: AppSchema,
  content: ContentSchema,
  webview: WebviewSchema,
});

export type Web2ApkConfig = z.infer<typeof Web2ApkConfigSchema>;

export const DEFAULT_WEBVIEW = WebviewSchema.parse({});

export function defaultConfig(projectName: string): Web2ApkConfig {
  return Web2ApkConfigSchema.parse({
    project: { name: projectName },
    app: {
      name: "My Website",
      packageName: "com.example.mywebsite",
      versionName: "1.0.0",
      versionCode: 1,
      icon: "",
    },
    content: {
      type: "url",
      url: "https://example.com",
      assetPath: "www/index.html",
      rawHtml: "",
    },
    webview: { ...DEFAULT_WEBVIEW, userAgentSuffix: "Web2APK/1.0.0" },
  });
}

export function parseConfig(data: unknown): Web2ApkConfig {
  return Web2ApkConfigSchema.parse(data);
}
