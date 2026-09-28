import * as fs from "node:fs";
import * as path from "node:path";
import { compareVersions, probeCli } from "../src/cli";
import { parseCliJson, quoteForShell, runJson } from "../src/runner";
import { MIN_CLI_VERSION } from "../src/util";

interface Channel {
  text: string;
  append(value: string): void;
  appendLine(value: string): void;
}

function makeChannel(): Channel {
  const channel: Channel = {
    text: "",
    append(value: string) {
      channel.text += value;
    },
    appendLine(value: string) {
      channel.text += `${value}\n`;
    },
  };
  return channel;
}

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const project = process.argv[2];
const cliJs = process.argv[3];
const emptyDir = process.argv[4];
const schemaPath = process.argv[5];

async function main(): Promise<void> {
  // ---------- CLI discovery ----------
  const info = await probeCli();
  check("probeCli finds the CLI on PATH", info.found, info.error ?? "");
  check(
    "probeCli parses a semver version",
    /^\d+\.\d+\.\d+/.test(info.version),
    info.version,
  );
  const cached = await probeCli();
  check("probeCli caches its result", cached === info);
  const forced = await probeCli(true);
  check("probeCli can re-probe", forced.found && forced.version === info.version);
  check(
    "compareVersions orders versions",
    compareVersions("1.2.3", "1.10.0") < 0 &&
      compareVersions("2.0.0", "1.9.9") > 0 &&
      compareVersions("1.0.1", "1.0.1") === 0,
  );
  check(
    "compareVersions against MIN_CLI_VERSION",
    compareVersions(MIN_CLI_VERSION, "1.0.1") === 0,
    MIN_CLI_VERSION,
  );

  async function run(
    args: string[],
    cwd: string,
  ): Promise<{ channel: Channel; result: Awaited<ReturnType<typeof runJson>> }> {
    const channel = makeChannel();
    const result = await runJson({
      command: "node",
      args: [cliJs, ...args],
      cwd,
      output: channel,
      timeoutMs: 300000,
    });
    return { channel, result };
  }

  // ---------- validate ----------
  const v = await run(["validate", "--json"], project);
  const vp = v.result.payload as { success?: boolean; checks?: unknown[] } | null;
  check("validate returns a JSON payload", Boolean(vp), `code=${v.result.code}`);
  check("validate payload has checks", Array.isArray(vp?.checks));
  check("validate succeeded", vp?.success === true);
  check(
    "validate streamed into the output channel",
    v.channel.text.includes("validate"),
    `${v.channel.text.length} chars`,
  );

  // ---------- doctor (pretty printed JSON) ----------
  const d = await run(["doctor", "--json"], project);
  const dp = d.result.payload as { success?: boolean; checks?: unknown[] } | null;
  check(
    "doctor pretty-printed JSON parsed",
    Array.isArray(dp?.checks),
    `checks=${dp?.checks?.length ?? 0}`,
  );

  // ---------- build (JSON buried after Gradle output) ----------
  const b = await run(["build", "--debug", "--json"], project);
  const bp = b.result.payload as
    | { success?: boolean; output?: string; sizeBytes?: number; error?: string }
    | null;
  check("build JSON extracted after Gradle output", Boolean(bp), `code=${b.result.code}`);
  check("build succeeded", bp?.success === true, bp?.error ?? "");
  check(
    "build output points at an apk",
    typeof bp?.output === "string" && bp.output.endsWith(".apk"),
    bp?.output ?? "",
  );
  check(
    "build reports a size",
    typeof bp?.sizeBytes === "number" && bp.sizeBytes > 0,
    String(bp?.sizeBytes),
  );

  // ---------- failure path ----------
  const e = await run(["validate", "--json"], emptyDir);
  const ep = e.result.payload as { success?: boolean; error?: string } | null;
  check("failure still yields a JSON payload", Boolean(ep));
  check("failure payload.success is false", ep?.success === false);
  check("failure exits with code 1", e.result.code === 1, String(e.result.code));

  // ---------- parseCliJson units ----------
  const banner = "  _   _ _   _ ____\n  | | | | \\ | |  _ \\\n";
  const single = '{"success":true,"project":"t1","type":"apk"}';
  check(
    "parse: single-line JSON behind a banner",
    (parseCliJson<{ project: string }>(`${banner}${single}`)?.project ?? "") === "t1",
  );
  check(
    "parse: pretty JSON behind noise",
    parseCliJson<{ success: boolean }>(`noise\n${JSON.stringify({ success: true, checks: [{ label: "a" }] }, null, 2)}`)
      ?.success === true,
  );
  check(
    "parse: nested object without success is skipped",
    parseCliJson<{ success: boolean }>(
      `prefix {"checks":[{"label":"x"}]}\n{"success":true,"checks":[{"label":"x"}]}`,
    )?.success === true,
  );
  check(
    "parse: Gradle noise around JSON",
    parseCliJson<{ success: boolean }>(`> Task :app:assembleDebug\n${single}\nBUILD SUCCESSFUL`)
      ?.success === true,
  );
  check("parse: no JSON returns null", parseCliJson("fatal: nothing here") === null);
  check("parse: empty input returns null", parseCliJson("") === null);
  check(
    "quoteForShell quotes values with spaces",
    quoteForShell("a b") === '"a b"',
    quoteForShell("a b"),
  );

  // ---------- schema vs a real config ----------
  const config = JSON.parse(
    fs.readFileSync(path.join(project, "web2apk.config.json"), "utf-8"),
  ) as Record<string, unknown>;
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as {
    required?: string[];
    properties?: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
  };
  const schemaProps = schema.properties ?? {};
  const unknownTop = Object.keys(config).filter((key) => !(key in schemaProps));
  check(
    "config has no top-level keys outside the schema",
    unknownTop.length === 0,
    unknownTop.join(","),
  );
  check(
    "schema-required sections are present",
    (schema.required ?? []).every((key) => key in config),
    (schema.required ?? []).join(","),
  );
  for (const [section, value] of Object.entries(config)) {
    const definition = schemaProps[section];
    if (!definition?.properties) continue;
    const unknown = Object.keys(value as Record<string, unknown>).filter(
      (key) => !(key in definition.properties!),
    );
    check(
      `config section "${section}" matches the schema`,
      unknown.length === 0,
      unknown.join(","),
    );
  }

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("TEST RUNNER CRASHED:", error);
  process.exit(1);
});
