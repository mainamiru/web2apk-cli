const esbuild = require("esbuild");

const entries = ["test/run.ts", "test/activate.ts"];

Promise.all(
  entries.map((entry) =>
    esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: entry.replace(/\.ts$/, ".cjs"),
      alias: { vscode: "./test/vscode-stub.js" },
      logLevel: "warning",
    }),
  ),
)
  .then(() => console.log("[tests] bundled test/run.cjs and test/activate.cjs"))
  .catch(() => process.exit(1));
