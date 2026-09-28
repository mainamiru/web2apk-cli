import * as path from "node:path";
import * as vscode from "vscode";
import { activate } from "../src/extension";

interface Stub {
  __commands: Record<string, (resource?: vscode.Uri) => unknown>;
  __messages: { type: string; text: string }[];
  __terminals: { options?: unknown; sent: string[] }[];
  __statusItems: { text: string; tooltip: string; command: string }[];
  __output: { text: string; clear(): void };
  __executed: { id: string; args: unknown[] }[];
  __openedDocs: string[];
  __setFindFiles(uris: { fsPath: string; path: string; scheme: string }[]): void;
  __findFiles: { fsPath: string; path: string; scheme: string }[];
}

const REQUIRED_COMMANDS = [
  "web2apk.create",
  "web2apk.validate",
  "web2apk.build",
  "web2apk.clean",
  "web2apk.doctor",
  "web2apk.openConfig",
  "web2apk.installCli",
  "web2apk.showOutput",
  "web2apk.statusMenu",
];

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const projectDir = process.argv[2];

async function main(): Promise<void> {
  const stub = vscode as unknown as Stub;
  const configPath = path.join(projectDir, "web2apk.config.json");
  stub.__setFindFiles([
    { fsPath: configPath, path: configPath.replace(/\\/g, "/"), scheme: "file" },
  ]);
  (vscode.workspace as unknown as { workspaceFolders: unknown[] }).workspaceFolders =
    [{ uri: { fsPath: projectDir, path: projectDir } }];

  const context = {
    subscriptions: [] as { dispose(): void }[],
    workspaceState: {
      get: async () => undefined,
      update: async () => undefined,
    },
    globalState: {
      get: async () => undefined,
      update: async () => undefined,
    },
  } as unknown as vscode.ExtensionContext;

  activate(context);
  await sleep(4000);

  // ---------- activation ----------
  check(
    "activate registers every command",
    REQUIRED_COMMANDS.every((id) => id in stub.__commands),
    REQUIRED_COMMANDS.filter((id) => !(id in stub.__commands)).join(","),
  );
  const status = stub.__statusItems[0];
  check("status bar item is shown", Boolean(status), status?.text ?? "");
  check(
    "status bar shows the discovered project",
    status?.text.includes("Web2APK: TestApp") === true,
    status?.text ?? "",
  );
  check(
    "status bar tooltip lists project and CLI",
    Boolean(status?.tooltip.includes(projectDir)) &&
      Boolean(/CLI: .*\(\d+\.\d+\.\d+\)/.test(status?.tooltip ?? "")),
    status?.tooltip.replace(/\n/g, " | ") ?? "",
  );
  check(
    "status bar click opens the command menu",
    status?.command === "web2apk.statusMenu",
    status?.command ?? "",
  );
  const oldVersionWarning = stub.__messages.find(
    (message) =>
      message.type === "warning" && message.text.includes("older than"),
  );
  check(
    "current CLI produces no outdated-version warning",
    !oldVersionWarning,
    oldVersionWarning?.text ?? "",
  );
  check(
    "project discovery called setContext",
    stub.__executed.some((call) => call.id === "setContext"),
  );

  // ---------- validate ----------
  stub.__output.clear();
  await stub.__commands["web2apk.validate"]();
  check(
    "validate streams check results to the output channel",
    stub.__output.text.includes("✓") &&
      stub.__output.text.includes("Configuration file exists"),
    stub.__output.text.split("\n")[1]?.trim() ?? "",
  );
  check(
    "validate reports success in a notification",
    stub.__messages.some(
      (message) =>
        message.type === "info" && message.text.includes("checks passed"),
    ),
  );

  // ---------- doctor ----------
  stub.__output.clear();
  await stub.__commands["web2apk.doctor"]();
  check(
    "doctor writes its checks to the output channel",
    stub.__output.text.includes("Java") &&
      stub.__output.text.includes("Android"),
    stub.__output.text.split("\n")[1]?.trim() ?? "",
  );

  // ---------- build ----------
  stub.__output.clear();
  const messagesBefore = stub.__messages.length;
  await stub.__commands["web2apk.build"]();
  const buildMessages = stub.__messages.slice(messagesBefore);
  check(
    "build runs through the progress UI",
    stub.__output.text.includes("build --debug --json"),
    stub.__output.text.split("\n")[1]?.trim() ?? "",
  );
  check(
    "build streams Gradle output",
    stub.__output.text.includes("Task"),
    `${stub.__output.text.length} chars`,
  );
  const success = buildMessages.find(
    (message) =>
      message.type === "info" && message.text.includes("APK built"),
  );
  check(
    "build reports the artifact and its size",
    Boolean(success),
    success?.text ?? JSON.stringify(buildMessages),
  );
  check(
    "status bar reflects the successful build",
    status?.text.includes("build ok") === true,
    status?.text ?? "",
  );

  // ---------- terminal-backed commands ----------
  const terminalsBefore = stub.__terminals.length;
  await stub.__commands["web2apk.clean"]();
  const cleanTerminal = stub.__terminals[terminalsBefore];
  check(
    "clean runs in the integrated terminal",
    Boolean(cleanTerminal?.sent.some((text) => text.includes("clean"))) &&
      cleanTerminal.sent[0]?.includes(projectDir),
    cleanTerminal?.sent[0] ?? "",
  );

  stub.__commands["web2apk.installCli"]();
  await sleep(50);
  const install = stub.__terminals[stub.__terminals.length - 1];
  check(
    "install CLI runs npm in the terminal",
    Boolean(
      install?.sent.some((text) =>
        text.includes("npm i -g @mainamiru/web2apk-cli"),
      ),
    ),
    install?.sent[install.sent.length - 1] ?? "",
  );

  await stub.__commands["web2apk.openConfig"]();
  check(
    "openConfig opens the config document",
    stub.__openedDocs.includes(configPath),
    stub.__openedDocs.join(", ") || "nothing opened",
  );

  await stub.__commands["web2apk.showOutput"]();
  check(
    "showOutput does not throw",
    true,
  );

  console.log(
    failures === 0 ? "\nALL ACTIVATION TESTS PASSED" : `\n${failures} TEST(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("ACTIVATION TEST RUNNER CRASHED:", error);
  process.exit(1);
});
