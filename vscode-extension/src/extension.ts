import * as path from "node:path";
import * as vscode from "vscode";
import {
  CLI_PACKAGE,
  MIN_CLI_VERSION,
  errText,
  firstLine,
  formatBytes,
  isValidProjectName,
} from "./util";
import { compareVersions, invalidateCli, probeCli } from "./cli";
import { ProjectStore } from "./projects";
import { runInTerminal, runJson, type RunResult } from "./runner";
import { StatusProvider } from "./statusBar";
import type {
  BuildPayload,
  BuildTarget,
  CliInfo,
  DoctorPayload,
  ValidatePayload,
} from "./types";

interface StatusAction extends vscode.QuickPickItem {
  command: string;
  argument?: unknown;
}

interface BuildChoice {
  target: BuildTarget;
  label: string;
  description: string;
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Web2APK");
  const status = new StatusProvider();
  const projects = new ProjectStore(context);
  context.subscriptions.push(output, status, projects);

  let cli: CliInfo | undefined;
  let busy = false;
  let warnedOldVersion = false;

  const config = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration("web2apk");

  const notifyOnSuccess = (): boolean =>
    config().get<boolean>("notifyOnSuccess", true);

  function showOutput(): void {
    output.show(true);
  }

  function idleStatus(): void {
    if (busy) return;
    if (cli && !cli.found) {
      status.update("noCli", "Web2APK: CLI not found");
      return;
    }
    const project = projects.projects[0];
    status.update(
      "idle",
      project ? `Web2APK: ${project.appName ?? project.folderName}` : "Web2APK",
    );
  }

  function beginBusy(label: string): void {
    busy = true;
    status.update("busy", `Web2APK: ${label}`);
  }

  function endBusy(kind: "success" | "error", label: string): void {
    busy = false;
    status.update(kind, label);
    if (kind === "success") {
      setTimeout(() => {
        if (!busy) idleStatus();
      }, 8000);
    }
  }

  function settleIdle(): void {
    busy = false;
    idleStatus();
  }

  projects.onDidChange(() => {
    status.setProject(projects.projects[0]);
    if (!busy) idleStatus();
  });

  async function ensureCli(): Promise<CliInfo | undefined> {
    const info = await probeCli();
    cli = info;
    status.setCli(info);
    if (!info.found) {
      const choice = await vscode.window.showErrorMessage(
        `Web2APK: CLI not found (tried "${info.command}"). ${info.error ?? ""}`.trim(),
        "Install CLI",
        "Settings",
        "Retry",
      );
      if (choice === "Install CLI") {
        void vscode.commands.executeCommand("web2apk.installCli");
      } else if (choice === "Settings") {
        void vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "web2apk.cliPath",
        );
      } else if (choice === "Retry") {
        return ensureCli();
      }
      return undefined;
    }
    if (
      !warnedOldVersion &&
      compareVersions(info.version, MIN_CLI_VERSION) < 0
    ) {
      warnedOldVersion = true;
      const choice = await vscode.window.showWarningMessage(
        `Web2APK: CLI ${info.version} is older than ${MIN_CLI_VERSION} — "web2apk config" and the icon pipeline need ${MIN_CLI_VERSION}.`,
        "Update CLI",
      );
      if (choice === "Update CLI") {
        void vscode.commands.executeCommand("web2apk.installCli");
      }
    }
    return info;
  }

  function reportFailure(title: string, reason: string): void {
    void vscode.window
      .showErrorMessage(`Web2APK: ${title} — ${reason}`, "Show Output")
      .then((choice) => {
        if (choice) showOutput();
      });
  }

  function reportChecks(
    checks: { label: string; ok: boolean; detail?: string }[],
  ): void {
    for (const check of checks) {
      const suffix =
        check.ok || !check.detail ? "" : ` — ${firstLine(check.detail)}`;
      output.appendLine(`${check.ok ? "✓" : "✗"} ${check.label}${suffix}`);
    }
  }

  async function pickBuildTarget(): Promise<BuildTarget | undefined> {
    const preferred = config().get<BuildTarget>("defaultBuildTarget", "debug");
    const choices: BuildChoice[] = [
      {
        target: "debug",
        label: "$(bug) Debug APK",
        description: "assembleDebug — runs on any device",
      },
      {
        target: "release",
        label: "$(shield) Release APK",
        description: "assembleRelease — needs signing config",
      },
      {
        target: "aab",
        label: "$(package) Release AAB",
        description: "bundleRelease — upload to Google Play",
      },
    ];
    const ordered = [
      ...choices.filter((choice) => choice.target === preferred),
      ...choices.filter((choice) => choice.target !== preferred),
    ];
    const picked = await vscode.window.showQuickPick(ordered, {
      title: "Web2APK build target",
      placeHolder: `Default: ${preferred}`,
    });
    return picked?.target;
  }

  // ---------------------------------------------------------------- commands

  async function createCommand(): Promise<void> {
    const info = await ensureCli();
    if (!info) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      void vscode.window.showErrorMessage(
        "Web2APK: open a folder first — projects are created inside a workspace folder.",
      );
      return;
    }
    let folder = folders[0];
    if (folders.length > 1) {
      const picked = await vscode.window.showWorkspaceFolderPick({
        placeHolder: "Select the folder that will contain the new project",
      });
      if (!picked) return;
      folder = picked;
    }
    const name = await vscode.window.showInputBox({
      title: "New Web2APK project",
      prompt: `The project folder is created in ${folder.uri.fsPath}`,
      placeHolder: "my-app",
      validateInput: (value) => {
        const candidate = value.trim();
        if (!candidate) return "Project name is required";
        if (!isValidProjectName(candidate)) {
          return 'Use letters, numbers, "-" and "_" (max 64 characters)';
        }
        return undefined;
      },
    });
    if (!name) return;
    const projectName = name.trim();
    runInTerminal({
      command: info.command,
      args: ["create", projectName],
      cwd: folder.uri.fsPath,
    });
    output.appendLine(`\n[create] ${projectName} in ${folder.uri.fsPath}`);
    setTimeout(() => void projects.refresh(), 3000);
  }

  async function validateCommand(resource?: vscode.Uri): Promise<void> {
    const project = await projects.pickProject(resource);
    if (!project) return;
    const info = await ensureCli();
    if (!info) return;

    beginBusy("validating");
    output.appendLine(`\n[validate] ${project.dir}`);
    try {
      const result = await runJson({
        command: info.command,
        args: ["validate", "--json"],
        cwd: project.dir,
        output,
      });
      const payload = result.payload as ValidatePayload | null;
      if (result.cancelled) {
        settleIdle();
        return;
      }
      if (payload?.checks) reportChecks(payload.checks);
      const checks = payload?.checks ?? [];
      const failed = checks.filter((check) => !check.ok);
      if (payload?.success) {
        endBusy("success", "Web2APK: validated");
        void vscode.window.showInformationMessage(
          `Web2APK: ${checks.length} checks passed — project is ready to build.`,
        );
      } else if (payload) {
        endBusy("error", "Web2APK: validation failed");
        void vscode.window
          .showErrorMessage(
            `Web2APK: validation failed (${failed.length} of ${checks.length} checks): ${failed
              .map((check) => check.label)
              .join(", ")}`,
            "Show Output",
          )
          .then((choice) => {
            if (choice) showOutput();
          });
      } else {
        endBusy("error", "Web2APK: validation failed");
        reportFailure("validation failed", `exit code ${result.code ?? "?"}`);
      }
    } catch (error) {
      endBusy("error", "Web2APK: validation failed");
      reportFailure("validation failed", errText(error));
    }
  }

  async function buildCommand(resource?: vscode.Uri): Promise<void> {
    const project = await projects.pickProject(resource);
    if (!project) return;
    const info = await ensureCli();
    if (!info) return;
    const target = await pickBuildTarget();
    if (!target) return;

    beginBusy(`building ${target}`);
    const flag = target === "aab" ? "--aab" : `--${target}`;
    output.appendLine(`\n[build ${target}] ${project.dir}`);

    let result: RunResult | undefined;
    try {
      result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Web2APK: building ${target} (${project.appName ?? project.folderName})`,
          cancellable: true,
        },
        (_progress, token) =>
          runJson({
            command: info.command,
            args: ["build", flag, "--json"],
            cwd: project.dir,
            output,
            token,
          }),
      );
    } catch (error) {
      endBusy("error", "Web2APK: build failed");
      reportFailure("build failed", errText(error));
      return;
    }

    if (result.cancelled) {
      settleIdle();
      void vscode.window.showInformationMessage("Web2APK: build cancelled.");
      return;
    }

    const payload = result.payload as BuildPayload | null;
    if (payload?.success && payload.output) {
      const artifact = payload.output;
      endBusy("success", "Web2APK: build ok");
      const kind = (payload.type ?? "build").toUpperCase();
      const size =
        typeof payload.sizeBytes === "number"
          ? formatBytes(payload.sizeBytes)
          : "";
      const took =
        typeof payload.elapsedSeconds === "number"
          ? ` in ${payload.elapsedSeconds.toFixed(1)}s`
          : "";
      if (payload.warnings?.length) {
        void vscode.window
          .showWarningMessage(
            `Web2APK: build succeeded with ${payload.warnings.length} warning(s) — ${firstLine(payload.warnings[0] ?? "")}`,
            "Show Output",
          )
          .then((choice) => {
            if (choice) showOutput();
          });
      }
      if (notifyOnSuccess()) {
        const summary = `${kind} built${size ? ` (${size})` : ""}${took}: ${path.basename(artifact)}`;
        void vscode.window
          .showInformationMessage(
            `Web2APK: ${summary}`,
            "Reveal",
            "Show Output",
          )
          .then((choice) => {
            if (choice === "Reveal") {
              void vscode.commands.executeCommand(
                "revealFileInOS",
                vscode.Uri.file(artifact),
              );
            } else if (choice === "Show Output") {
              showOutput();
            }
          });
      }
      return;
    }

    endBusy("error", "Web2APK: build failed");
    reportFailure(
      "build failed",
      payload?.error
        ? firstLine(payload.error)
        : `exit code ${result.code ?? "?"}`,
    );
  }

  async function cleanCommand(resource?: vscode.Uri): Promise<void> {
    const project = await projects.pickProject(resource);
    if (!project) return;
    const info = await ensureCli();
    if (!info) return;
    runInTerminal({ command: info.command, args: ["clean"], cwd: project.dir });
    output.appendLine(`\n[clean] ${project.dir}`);
  }

  async function doctorCommand(): Promise<void> {
    const info = await ensureCli();
    if (!info) return;
    const folders = vscode.workspace.workspaceFolders;
    const cwd = folders?.[0]?.uri.fsPath;

    beginBusy("checking environment");
    output.appendLine("\n[doctor]");
    try {
      const result = await runJson({
        command: info.command,
        args: ["doctor", "--json"],
        cwd: cwd ?? process.cwd(),
        output,
        timeoutMs: 120000,
      });
      const payload = result.payload as DoctorPayload | null;
      if (payload?.checks) reportChecks(payload.checks);
      const checks = payload?.checks ?? [];
      const failed = checks.filter((check) => !check.ok);
      if (payload?.success) {
        endBusy("success", "Web2APK: environment ready");
        void vscode.window.showInformationMessage(
          "Web2APK: environment is ready to build.",
        );
      } else if (payload) {
        endBusy("error", "Web2APK: environment issues");
        void vscode.window
          .showErrorMessage(
            `Web2APK: ${failed.length} environment check(s) failed: ${failed
              .map((check) => check.label)
              .join(", ")}`,
            "Show Output",
          )
          .then((choice) => {
            if (choice) showOutput();
          });
      } else {
        endBusy("error", "Web2APK: environment check failed");
        reportFailure(
          "environment check failed",
          `exit code ${result.code ?? "?"}`,
        );
      }
    } catch (error) {
      endBusy("error", "Web2APK: environment check failed");
      reportFailure("environment check failed", errText(error));
    }
  }

  async function openConfigCommand(resource?: vscode.Uri): Promise<void> {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (!resource && active && active.path.endsWith("/web2apk.config.json")) {
      void vscode.window.showTextDocument(active, { preview: false });
      return;
    }
    const project = await projects.pickProject(resource);
    if (!project) return;
    try {
      const document = await vscode.workspace.openTextDocument(
        project.configPath,
      );
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
      reportFailure("could not open the config", errText(error));
    }
  }

  function installCliCommand(): void {
    const folders = vscode.workspace.workspaceFolders;
    runInTerminal({
      command: "npm",
      args: ["i", "-g", CLI_PACKAGE],
      cwd: folders?.[0]?.uri.fsPath,
    });
    output.appendLine(`\n[install] npm i -g ${CLI_PACKAGE}`);
    invalidateCli();
    setTimeout(() => {
      invalidateCli();
      void probeCli(true).then((info) => {
        cli = info;
        status.setCli(info);
        if (!busy) idleStatus();
      });
    }, 10000);
  }

  async function statusMenuCommand(): Promise<void> {
    const actions: StatusAction[] = [
      {
        label: "$(package) Build APK/AAB",
        description: "build --debug | --release | --aab",
        command: "web2apk.build",
      },
      {
        label: "$(checklist) Validate project",
        description: "validate --json",
        command: "web2apk.validate",
      },
      {
        label: "$(gear) Open web2apk.config.json",
        command: "web2apk.openConfig",
      },
      {
        label: "$(clear-all) Clean build",
        description: "gradle clean",
        command: "web2apk.clean",
      },
      {
        label: "$(heart) Check environment",
        description: "doctor --json",
        command: "web2apk.doctor",
      },
      {
        label: "$(new-folder) Create project",
        command: "web2apk.create",
      },
      {
        label: "$(output) Show output",
        command: "web2apk.showOutput",
      },
      {
        label: "$(cloud-download) Install / update CLI",
        description: CLI_PACKAGE,
        command: "web2apk.installCli",
      },
      {
        label: "$(settings-gear) Settings",
        command: "workbench.action.openSettings",
        argument: "web2apk",
      },
    ];
    const picked = await vscode.window.showQuickPick(actions, {
      title: "Web2APK",
      placeHolder: projects.projects[0]
        ? `Project: ${projects.projects[0].dir}`
        : "No project found in this workspace",
    });
    if (picked) {
      void vscode.commands.executeCommand(picked.command, picked.argument);
    }
  }

  // ------------------------------------------------------------ registration

  context.subscriptions.push(
    vscode.commands.registerCommand("web2apk.create", () => createCommand()),
    vscode.commands.registerCommand(
      "web2apk.validate",
      (resource?: vscode.Uri) => validateCommand(resource),
    ),
    vscode.commands.registerCommand("web2apk.build", (resource?: vscode.Uri) =>
      buildCommand(resource),
    ),
    vscode.commands.registerCommand("web2apk.clean", (resource?: vscode.Uri) =>
      cleanCommand(resource),
    ),
    vscode.commands.registerCommand("web2apk.doctor", () => doctorCommand()),
    vscode.commands.registerCommand(
      "web2apk.openConfig",
      (resource?: vscode.Uri) => openConfigCommand(resource),
    ),
    vscode.commands.registerCommand("web2apk.installCli", () =>
      installCliCommand(),
    ),
    vscode.commands.registerCommand("web2apk.showOutput", () => showOutput()),
    vscode.commands.registerCommand("web2apk.statusMenu", () =>
      statusMenuCommand(),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("web2apk.cliPath")) {
        invalidateCli();
        void probeCli(true).then((info) => {
          cli = info;
          status.setCli(info);
          if (!busy) idleStatus();
        });
      }
    }),
  );

  void probeCli().then((info) => {
    cli = info;
    status.setCli(info);
    if (!busy) idleStatus();
  });
}

export function deactivate(): void {
  // nothing to clean up — subscriptions handle disposal
}
