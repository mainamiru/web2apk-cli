export interface CliCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ValidatePayload {
  success: boolean;
  project?: string;
  checks?: CliCheck[];
}

export interface DoctorPayload {
  success: boolean;
  checks?: CliCheck[];
}

export interface BuildPayload {
  success: boolean;
  project?: string;
  type?: string;
  variant?: string;
  output?: string;
  sizeBytes?: number;
  elapsedSeconds?: number;
  warnings?: string[];
  error?: string;
}

export interface ErrorPayload {
  success: boolean;
  error?: string;
}

export type CliPayload =
  ValidatePayload | DoctorPayload | BuildPayload | ErrorPayload;

export type BuildTarget = "debug" | "release" | "aab";

export interface CliInfo {
  command: string;
  found: boolean;
  version: string;
  error?: string;
}

export interface Project {
  dir: string;
  configPath: string;
  folderName: string;
  appName?: string;
}
