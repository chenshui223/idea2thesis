import type { JobSnapshot, PersistedSettings, RuntimeConfig, SettingsResponse } from "./types";

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch("/settings");
  if (!response.ok) {
    throw new Error("failed to load settings");
  }
  return response.json();
}

export async function saveSettings(
  settings: PersistedSettings
): Promise<SettingsResponse> {
  const response = await fetch("/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });
  if (!response.ok) {
    throw new Error("failed to save settings");
  }
  return response.json();
}

export async function uploadBrief(
  file: File,
  config: RuntimeConfig
): Promise<JobSnapshot> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("config", JSON.stringify(config));
  const response = await fetch("/jobs", {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("failed to create job");
  }
  return response.json();
}

export async function fetchJob(jobId: string): Promise<JobSnapshot> {
  const response = await fetch(`/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error("failed to fetch job");
  }
  return response.json();
}
