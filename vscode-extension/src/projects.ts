import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Project } from "./types";

const CONFIG_GLOB = "**/web2apk.config.json";
const CONFIG_EXCLUDE =
  "**/{node_modules,build,dist,out,.git,.gradle,gradle,coverage}/**";

interface ProjectPick extends vscode.QuickPickItem {
  project: Project;
}

export class ProjectStore implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private readonly context: vscode.ExtensionContext;
  private readonly disposables: vscode.Disposable[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private cache: Project[] | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("web2apk.autoDetect")) {
          this.applyWatcherSetting();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this.refresh();
      }),
    );
    this.applyWatcherSetting();
    void this.refresh();
  }

  get projects(): Project[] {
    return this.cache ?? [];
  }

  async refresh(): Promise<Project[]> {
    const uris = await vscode.workspace.findFiles(
      CONFIG_GLOB,
      CONFIG_EXCLUDE,
      100,
    );
    const found: Project[] = [];
    for (const uri of uris) {
      const dir = path.dirname(uri.fsPath);
      found.push({
        dir,
        configPath: uri.fsPath,
        folderName: path.basename(dir),
        appName: await readAppName(uri.fsPath),
      });
    }
    found.sort((a, b) => a.dir.localeCompare(b.dir));
    this.cache = found;
    await vscode.commands.executeCommand(
      "setContext",
      "web2apk.hasProject",
      found.length > 0,
    );
    this.emitter.fire();
    return found;
  }

  async pickProject(resource?: vscode.Uri): Promise<Project | undefined> {
    if (resource) {
      const project = await this.projectForResource(resource);
      if (project) return project;
      void vscode.window.showWarningMessage(
        "Web2APK: no web2apk.config.json found at that location.",
      );
      return undefined;
    }

    const projects = this.cache ?? (await this.refresh());
    if (projects.length === 0) {
      const choice = await vscode.window.showWarningMessage(
        "Web2APK: no web2apk project found in this workspace.",
        "Create Project",
      );
      if (choice === "Create Project") {
        void vscode.commands.executeCommand("web2apk.create");
      }
      return undefined;
    }
    if (projects.length === 1) return projects[0];

    const remembered = await this.context.workspaceState.get<string>(
      "web2apk.lastProject",
    );
    const picks: ProjectPick[] = projects.map((project) => ({
      label: `$(folder) ${project.appName ?? project.folderName}`,
      description: project.appName ? project.folderName : "",
      detail: project.dir,
      project,
    }));
    const picked = await vscode.window.showQuickPick(picks, {
      title: "Select Web2APK project",
      placeHolder: remembered
        ? `Last used: ${remembered}`
        : "Multiple projects found in this workspace",
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return undefined;
    await this.context.workspaceState.update(
      "web2apk.lastProject",
      picked.project.dir,
    );
    return picked.project;
  }

  private async projectForResource(
    resource: vscode.Uri,
  ): Promise<Project | undefined> {
    // The clicked resource may be the config file, a project folder, a folder
    // inside the project, or any file in it — walk up until we find the config.
    let dir = resource.fsPath;
    for (let depth = 0; depth < 12; depth += 1) {
      if (path.basename(dir) === "web2apk.config.json" && (await exists(dir))) {
        dir = path.dirname(dir);
        break;
      }
      const config = path.join(dir, "web2apk.config.json");
      if (await exists(config)) {
        return {
          dir,
          configPath: config,
          folderName: path.basename(dir),
          appName: await readAppName(config),
        };
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  private applyWatcherSetting(): void {
    const enabled = vscode.workspace
      .getConfiguration("web2apk")
      .get<boolean>("autoDetect", true);
    if (enabled && !this.watcher) {
      const watcher = vscode.workspace.createFileSystemWatcher(CONFIG_GLOB);
      watcher.onDidCreate(() => {
        void this.refresh();
      });
      watcher.onDidDelete(() => {
        void this.refresh();
      });
      this.watcher = watcher;
    } else if (!enabled && this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
  }

  dispose(): void {
    this.watcher?.dispose();
    for (const disposable of this.disposables) disposable.dispose();
    this.emitter.dispose();
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readAppName(configPath: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const app = (parsed as { app?: { name?: unknown } }).app;
      if (app && typeof app.name === "string" && app.name.trim()) {
        return app.name.trim();
      }
    }
  } catch {
    // unreadable or invalid JSON — the file still marks a project
  }
  return undefined;
}
