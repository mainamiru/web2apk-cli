import path from "node:path";
import fs from "fs-extra";
import type { Web2ApkConfig } from "../schemas/web2apk-config.js";
import { IconGenerator } from "./icon.js";
import { projectDir } from "../utils/paths.js";

// ---------- XML helpers (no extra deps; safe per-resource replacement) ----------

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setStringResource(
  xml: string,
  name: string,
  value: string,
  useCdata: boolean,
): string {
  const safeValue = useCdata
    ? value.replaceAll("]]>", "]]]]><![CDATA[>")
    : value;
  const inner = useCdata
    ? `<![CDATA[${safeValue}]]>`
    : escapeXmlText(safeValue);
  // NOTE: self-closing tags MUST be checked first. The pair pattern below would
  // otherwise match `<string ... />` as an opening tag and swallow everything
  // up to the NEXT `</string>`, deleting intervening resources.
  const selfClosing = new RegExp(`<string\\s+name="${name}"[^>]*\\/>`);
  if (selfClosing.test(xml)) {
    // Preserve existing attributes (e.g. translatable="false")
    return xml.replace(
      selfClosing,
      (match) => `${match.slice(0, -2).trimEnd()}>${inner}</string>`,
    );
  }
  const re = new RegExp(
    `(<string\\s+name="${name}"[^>]*>)([\\s\\S]*?)(</string\\s*>)`,
  );
  const m = re.exec(xml);
  if (m) {
    // Function replacer: values may contain `$` (e.g. JS in raw HTML) which
    // String.replace would otherwise interpret as `$&`, `$'`, etc.
    return xml.replace(re, () => `${m[1]}${inner}${m[3]}`);
  }
  throw new Error(`String resource not found in web2apk_config.xml: ${name}`);
}

function setBoolResource(xml: string, name: string, value: boolean): string {
  const re = new RegExp(
    `(<bool\\s+name="${name}"[^>]*>)([\\s\\S]*?)(</bool\\s*>)`,
  );
  const m = re.exec(xml);
  if (!m)
    throw new Error(`Bool resource not found in web2apk_config.xml: ${name}`);
  return xml.replace(re, () => `${m[1]}${value ? "true" : "false"}${m[3]}`);
}

function updateGradleProperty(
  content: string,
  key: string,
  value: string,
): string {
  const re = new RegExp(`^${key.replace(/\./g, "\\.")}\\s*=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(content)) return content.replace(re, () => line);
  // Append inside Web2APK block if present, else append at end
  return `${content.trimEnd()}\n${line}\n`;
}

export class AndroidConfigurator {
  static configXmlPath(projectName?: string): string {
    return path.join(
      projectDir(projectName),
      "app",
      "src",
      "main",
      "res",
      "values",
      "web2apk_config.xml",
    );
  }

  static stringsXmlPath(projectName?: string): string {
    return path.join(
      projectDir(projectName),
      "app",
      "src",
      "main",
      "res",
      "values",
      "strings.xml",
    );
  }

  static gradlePropertiesPath(projectName?: string): string {
    return path.join(projectDir(projectName), "gradle.properties");
  }

  /**
   * Inject web2apk.config.json into the Android project (resources, gradle
   * properties, content assets, launcher icons).
   * `projectName` is the directory key: pass "" to target the current working
   * directory; it defaults to `config.project.name`.
   */
  static async apply(
    config: Web2ApkConfig,
    projectName: string = config.project.name,
  ): Promise<{ warnings: string[] }> {
    const { app, content, webview } = config;
    const warnings: string[] = [];

    // 1. web2apk_config.xml — single engine for all runtime flags
    const xmlPath = this.configXmlPath(projectName);
    let xml = await fs.readFile(xmlPath, "utf-8");

    xml = setStringResource(xml, "web2apk_content_type", content.type, false);
    xml = setStringResource(
      xml,
      "web2apk_default_url",
      content.type === "url" ? content.url : "https://example.com",
      false,
    );
    xml = setStringResource(
      xml,
      "web2apk_asset_path",
      content.assetPath || "www/index.html",
      false,
    );
    // raw HTML may contain <>&"' — must use CDATA so it survives
    xml = setStringResource(
      xml,
      "web2apk_raw_html",
      content.rawHtml || "",
      true,
    );
    xml = setStringResource(
      xml,
      "web2apk_allowed_hosts",
      webview.allowedHosts.join(","),
      false,
    );
    xml = setStringResource(
      xml,
      "web2apk_user_agent_suffix",
      webview.userAgentSuffix || "",
      false,
    );

    const boolMap: Array<[string, boolean]> = [
      ["web2apk_enable_javascript", webview.javascript],
      ["web2apk_enable_dom_storage", webview.domStorage],
      ["web2apk_enable_database", webview.database],
      ["web2apk_enable_built_in_zoom", webview.builtInZoom],
      ["web2apk_display_zoom_controls", webview.displayZoomControls],
      ["web2apk_enable_pull_to_refresh", webview.pullToRefresh],
      ["web2apk_enable_top_progress_bar", webview.topProgressBar],
      ["web2apk_enable_center_loader", webview.centerLoader],
      ["web2apk_enable_file_upload", webview.fileUpload],
      ["web2apk_enable_downloads", webview.downloads],
      ["web2apk_enable_geolocation", webview.geolocation],
      ["web2apk_enable_camera_microphone", webview.cameraMicrophone],
      ["web2apk_enable_notifications", webview.notifications],
      ["web2apk_enable_back_navigation", webview.backNavigation],
      ["web2apk_confirm_exit_on_back", webview.confirmExit],
      ["web2apk_allow_mixed_content", webview.mixedContent],
      ["web2apk_clear_cache_on_exit", webview.clearCacheOnExit],
      ["web2apk_support_multiple_windows", webview.multipleWindows],
      [
        "web2apk_auto_retry_on_network_recovery",
        webview.autoRetryNetworkRecovery,
      ],
    ];
    for (const [name, val] of boolMap) xml = setBoolResource(xml, name, val);

    // progress indicator style derived: both bars -> "both", top bar -> "bar", center -> "spinner"
    const style =
      webview.topProgressBar && webview.centerLoader
        ? "both"
        : webview.centerLoader
          ? "spinner"
          : "bar";
    xml = setStringResource(
      xml,
      "web2apk_progress_indicator_style",
      style,
      false,
    );

    await fs.writeFile(xmlPath, xml, "utf-8");

    // 2. App name via strings.xml (never hard-code in Kotlin)
    const stringsPath = this.stringsXmlPath(projectName);
    let strings = await fs.readFile(stringsPath, "utf-8");
    strings = setStringResource(strings, "app_name", app.name, false);
    await fs.writeFile(stringsPath, strings, "utf-8");

    // 3. Package / version / BuildConfig fallback via gradle.properties
    // The template's app/build.gradle.kts reads web2apk.* properties for
    // applicationId, versionCode/Name, appName, websiteUrl, contentType, assetPath.
    // Namespace (com.example) is the Kotlin R namespace — leave untouched.
    const propsPath = this.gradlePropertiesPath(projectName);
    let props = await fs.readFile(propsPath, "utf-8");
    props = updateGradleProperty(
      props,
      "web2apk.applicationId",
      app.packageName,
    );
    props = updateGradleProperty(props, "web2apk.appName", app.name);
    props = updateGradleProperty(
      props,
      "web2apk.versionCode",
      String(app.versionCode),
    );
    props = updateGradleProperty(props, "web2apk.versionName", app.versionName);
    props = updateGradleProperty(
      props,
      "web2apk.websiteUrl",
      content.type === "url" ? content.url : "https://example.com",
    );
    props = updateGradleProperty(props, "web2apk.contentType", content.type);
    props = updateGradleProperty(
      props,
      "web2apk.assetPath",
      content.assetPath || "www/index.html",
    );
    await fs.writeFile(propsPath, props, "utf-8");

    // 4. Content assets
    await this.applyContentAssets(projectName, config);

    // 5. Launcher icons — regenerated on every injection when a source is set
    if (config.app.icon) {
      const source = await IconGenerator.resolveSource(
        projectName,
        config.app.icon,
      );
      if (!source) {
        throw new Error(
          `Icon source not found: "${config.app.icon}"\n\nExpected: ${path.join(
            projectDir(projectName),
            config.app.icon,
          )}\nSet a new one with: web2apk config --icon <path>`,
        );
      }
      const result = await IconGenerator.generate(projectName, source);
      warnings.push(...result.warnings);
    }

    return { warnings };
  }

  private static async applyContentAssets(
    projectName: string,
    config: Web2ApkConfig,
  ): Promise<void> {
    const assetsBase = path.join(
      projectDir(projectName),
      "app",
      "src",
      "main",
      "assets",
    );
    if (config.content.type === "asset") {
      // If user gave a file path via assetPath that exists on disk, copy it in.
      // Otherwise ensure a placeholder index exists so the build doesn't break.
      const candidate = path.resolve(config.content.assetPath);
      const destRel = config.content.assetPath.includes(".")
        ? config.content.assetPath
        : "www/index.html";
      const dest = path.join(assetsBase, destRel);
      if (await fs.pathExists(candidate)) {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          await fs.copy(candidate, path.join(assetsBase, "www"));
        } else {
          await fs.ensureDir(path.dirname(dest));
          await fs.copy(candidate, dest);
        }
      } else {
        await fs.ensureDir(path.join(assetsBase, "www"));
        const indexFile = path.join(assetsBase, "www", "index.html");
        if (!(await fs.pathExists(indexFile))) {
          await fs.writeFile(
            indexFile,
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Replace with your web assets</h1></body></html>',
            "utf-8",
          );
        }
      }
    }
  }
}
