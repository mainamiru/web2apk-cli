import * as vscode from "vscode";
import type { CliInfo, Project } from "./types";

type StatusKind = "idle" | "busy" | "success" | "error" | "noCli";

const ICONS: Record<StatusKind, string> = {
  idle: "$(package)",
  busy: "$(sync~spin)",
  success: "$(check)",
  error: "$(error)",
  noCli: "$(warning)",
};

export class StatusProvider implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private project?: Project;
  private cli?: CliInfo;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      "web2apk.status",
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.name = "Web2APK";
    this.item.command = "web2apk.statusMenu";
    this.update("idle", "Web2APK");
    this.item.show();
  }

  setProject(project?: Project): void {
    this.project = project;
  }

  setCli(cli?: CliInfo): void {
    this.cli = cli;
  }

  update(kind: StatusKind, label: string): void {
    this.item.text = `${ICONS[kind]} ${label}`;
    this.item.tooltip = this.tooltip(kind, label);
  }

  private tooltip(kind: StatusKind, label: string): string {
    const lines = ["Web2APK", "", label, ""];
    lines.push(
      this.project
        ? `Project: ${this.project.dir}`
        : "Project: none found in this workspace",
    );
    if (!this.cli) {
      lines.push("CLI: not checked yet");
    } else if (this.cli.found) {
      lines.push(`CLI: ${this.cli.command} (${this.cli.version})`);
    } else {
      lines.push(`CLI: not found (${this.cli.command})`);
    }
    if (kind === "noCli") {
      lines.push("", "Install: npm i -g @mainamiru/web2apk-cli");
    }
    lines.push("", "Click for commands");
    return lines.join("\n");
  }

  dispose(): void {
    this.item.dispose();
  }
}
