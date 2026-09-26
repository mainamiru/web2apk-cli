export function isWindows(): boolean {
  return process.platform === "win32";
}

export function gradleWrapper(projectPath: string): {
  command: string;
  args: string[];
  label: string;
} {
  if (isWindows()) {
    return {
      command: "cmd.exe",
      args: ["/c", "gradlew.bat"],
      label: "gradlew.bat",
    };
  }
  return { command: "sh", args: ["./gradlew"], label: "./gradlew" };
}

/** Build execa-compatible invocation: { file, args } */
export function gradleInvocation(
  projectPath: string,
  gradleArgs: string[],
): { file: string; args: string[] } {
  if (isWindows()) {
    return {
      file: "cmd.exe",
      args: ["/c", "gradlew.bat", ...gradleArgs],
    };
  }
  return { file: "./gradlew", args: gradleArgs };
}
