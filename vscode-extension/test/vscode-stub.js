const configValues = {};
const commands = {};
const messages = [];
const terminals = [];
const statusItems = [];

const output = {
  name: "Web2APK",
  text: "",
  append(value) {
    output.text += value;
  },
  appendLine(value) {
    output.text += `${value}\n`;
  },
  clear() {
    output.text = "";
  },
  show() {},
  dispose() {},
};

const stub = {
  __commands: commands,
  __messages: messages,
  __terminals: terminals,
  __statusItems: statusItems,
  __output: output,
  __executed: [],
  __openedDocs: [],
  __findFiles: [],
  __setConfig(key, value) {
    configValues[key] = value;
  },
  __setFindFiles(uris) {
    stub.__findFiles = uris;
  },

  workspace: {
    getConfiguration: (section) => ({
      get: (key, defaultValue) => {
        const full = `${section}.${key}`;
        return full in configValues ? configValues[full] : defaultValue;
      },
    }),
    findFiles: async () => stub.__findFiles,
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose() {} }),
      onDidDelete: () => ({ dispose() {} }),
      dispose() {},
    }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
    onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
    openTextDocument: async (file) => {
      stub.__openedDocs.push(file);
      return { uri: { fsPath: file }, fileName: file };
    },
    workspaceFolders: [],
  },

  window: {
    createOutputChannel: () => output,
    createStatusBarItem: (id) => {
      const item = {
        id,
        text: "",
        tooltip: "",
        command: "",
        show() {},
        dispose() {},
      };
      statusItems.push(item);
      return item;
    },
    createTerminal: (options) => {
      const terminal = {
        options,
        sent: [],
        exitStatus: undefined,
        show() {},
        sendText(text) {
          terminal.sent.push(text);
        },
        dispose() {},
      };
      terminals.push(terminal);
      return terminal;
    },
    showErrorMessage: async (text, ...actions) => {
      messages.push({ type: "error", text, actions });
      return undefined;
    },
    showWarningMessage: async (text, ...actions) => {
      messages.push({ type: "warning", text, actions });
      return undefined;
    },
    showInformationMessage: async (text, ...actions) => {
      messages.push({ type: "info", text, actions });
      return undefined;
    },
    showQuickPick: async (items) => items[0],
    showInputBox: async () => undefined,
    showWorkspaceFolderPick: async () => undefined,
    showTextDocument: async () => undefined,
    withProgress: (_options, task) =>
      task(
        { report() {} },
        { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) },
      ),
    activeTextEditor: undefined,
  },

  commands: {
    registerCommand: (id, handler) => {
      commands[id] = handler;
      return { dispose() {} };
    },
    executeCommand: async (id, ...args) => {
      stub.__executed.push({ id, args });
      const handler = commands[id];
      return handler ? handler(...args) : undefined;
    },
  },

  StatusBarAlignment: { Left: 1, Right: 2 },
  ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
  EventEmitter: class {
    constructor() {
      this.listeners = [];
    }
    get event() {
      return (listener) => {
        this.listeners.push(listener);
        return { dispose() {} };
      };
    }
    fire(...args) {
      for (const listener of this.listeners) listener(...args);
    }
    dispose() {}
  },
  Disposable: class {
    constructor(fn) {
      this.fn = fn;
    }
    dispose() {
      if (typeof this.fn === "function") this.fn();
    }
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p, scheme: "file" }),
  },
  env: {},
  version: "1.95.0",
};

module.exports = stub;
