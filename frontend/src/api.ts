import type { JobSnapshot, SettingsSummary } from "./types";

export async function fetchSettings(): Promise<SettingsSummary> {
  const response = await fetch("/settings");
  if (!response.ok) {
    throw new Error("failed to load settings");
  }
  return response.json();
}

export async function uploadBrief(file: File): Promise<JobSnapshot> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/jobs", {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("failed to create job");
  }
  return response.json();
}
