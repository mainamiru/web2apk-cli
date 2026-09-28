const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  outfile: "dist/extension.js",
  external: ["vscode"],
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("[esbuild] watching for changes...");
    return;
  }
  const result = await esbuild.build(options);
  if (result.errors.length) process.exit(1);
  console.log(`[esbuild] built dist/extension.js${production ? " (production)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
