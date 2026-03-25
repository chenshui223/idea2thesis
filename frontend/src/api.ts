import type {
  ArtifactRef,
  HistoryListResponse,
  JobDetail,
  JobEventsResponse,
  JobSnapshot,
  HistoryListItem,
  JobEvent,
  PersistedSettings,
  RuntimeConfig,
  RuntimePreset,
  SettingsResponse
} from "./types";

export type ArtifactContent = {
  path: string;
  content: string;
  truncated: boolean;
};

export type OpenArtifactResponse = {
  ok: boolean;
  path: string;
};

function normalizeRuntimePreset(input: any): RuntimePreset {
  if (input?.global) {
    return {
      schema_version: input.schema_version ?? "v1alpha1",
      global: {
        base_url: input.global.base_url ?? "",
        model: input.global.model ?? ""
      },
      agents: Object.fromEntries(
        Object.entries(input.agents ?? {}).map(([role, agent]: [string, any]) => [
          role,
          {
            useGlobal: Boolean(agent?.useGlobal ?? agent?.use_global ?? true),
            base_url: agent?.base_url ?? "",
            model: agent?.model ?? ""
          }
        ])
      )
    };
  }

  return {
    schema_version: input?.schema_version ?? "v1alpha1",
    global: {
      base_url: input?.base_url ?? "",
      model: input?.model ?? ""
    },
    agents: Object.fromEntries(
      Object.entries(input?.agents ?? {}).map(([role, agent]: [string, any]) => [
        role,
        {
          useGlobal: Boolean(agent?.useGlobal ?? agent?.use_global ?? true),
          base_url: agent?.base_url ?? "",
          model: agent?.model ?? ""
        }
      ])
    )
  };
}

function normalizeHistoryItem(item: any): HistoryListItem {
  return {
    job_id: item.job_id,
    brief_title: item.brief_title ?? item.title ?? "",
    status: item.status ?? "pending",
    stage: item.stage ?? "",
    final_disposition: item.final_disposition ?? item.status ?? "pending",
    created_at: item.created_at ?? item.updated_at ?? "",
    updated_at: item.updated_at ?? item.created_at ?? ""
  };
}

function normalizeJobDetail(detail: any): JobDetail {
  return {
    schema_version: detail.schema_version ?? "v1alpha1",
    job_id: detail.job_id,
    brief_title: detail.brief_title ?? detail.title ?? "",
    source_job_id: detail.source_job_id ?? null,
    workspace_path: detail.workspace_path ?? "",
    input_file_path: detail.input_file_path ?? "",
    error_message: detail.error_message ?? "",
    deleted_at: detail.deleted_at ?? null,
    status: detail.status ?? "pending",
    stage: detail.stage ?? "",
    created_at: detail.created_at ?? detail.updated_at ?? "",
    updated_at: detail.updated_at ?? detail.created_at ?? "",
    started_at: detail.started_at ?? null,
    finished_at: detail.finished_at ?? null,
    validation_state: detail.validation_state ?? "pending",
    final_disposition: detail.final_disposition ?? detail.status ?? "pending",
    agents: detail.agents ?? [],
    artifacts: detail.artifacts ?? [],
    runtime_preset: normalizeRuntimePreset(detail.runtime_preset ?? {})
  };
}

function normalizeJobEvent(event: any): JobEvent {
  return {
    id: Number(event.id ?? 0),
    timestamp: event.timestamp ?? "",
    kind: event.kind ?? event.type ?? "",
    message: event.message ?? "",
    payload: event.payload ?? {}
  };
}

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

export async function fetchJob(jobId: string): Promise<JobDetail> {
  return fetchJobDetail(jobId);
}

export async function fetchJobs(params: {
  search?: string;
  status?: string;
  sort?: string;
} = {}): Promise<HistoryListResponse> {
  const url = new URL("/jobs", window.location.origin);
  if (params.search) {
    url.searchParams.set("query", params.search);
  }
  if (params.status && params.status !== "all") {
    url.searchParams.set("status", params.status);
  }
  if (params.sort) url.searchParams.set("sort", params.sort);
  const response = await fetch(`/jobs${url.search}`);
  if (!response.ok) {
    throw new Error("failed to fetch job history");
  }
  const body = await response.json();
  return {
    schema_version: body.schema_version ?? "v1alpha1",
    items: (body.items ?? []).map(normalizeHistoryItem),
    total: Number(body.total ?? 0)
  };
}

export async function fetchJobDetail(jobId: string): Promise<JobDetail> {
  const response = await fetch(`/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error("failed to fetch job");
  }
  return normalizeJobDetail(await response.json());
}

export async function fetchJobEvents(jobId: string): Promise<JobEventsResponse> {
  const response = await fetch(`/jobs/${jobId}/events`);
  if (!response.ok) {
    throw new Error("failed to fetch job events");
  }
  const body = await response.json();
  return {
    schema_version: body.schema_version ?? "v1alpha1",
    items: (body.items ?? []).map(normalizeJobEvent)
  };
}

export async function rerunJob(
  jobId: string,
  config: RuntimeConfig
): Promise<JobDetail> {
  const formData = new FormData();
  formData.append("config", JSON.stringify(config));
  const response = await fetch(`/jobs/${jobId}/rerun`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("failed to rerun job");
  }
  return normalizeJobDetail(await response.json());
}

export async function deleteJob(jobId: string): Promise<JobDetail> {
  const response = await fetch(`/jobs/${jobId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error("failed to delete job");
  }
  return normalizeJobDetail(await response.json());
}

export async function fetchArtifactContent(
  jobId: string,
  artifact: ArtifactRef
): Promise<ArtifactContent> {
  const url = new URL(`/jobs/${jobId}/artifacts/content`, window.location.origin);
  url.searchParams.set("path", artifact.path);
  const response = await fetch(`/jobs/${jobId}/artifacts/content${url.search}`);
  if (!response.ok) {
    throw new Error("failed to fetch artifact content");
  }
  return response.json();
}

export async function downloadArtifact(
  jobId: string,
  artifact: ArtifactRef
): Promise<Blob> {
  const url = new URL(`/jobs/${jobId}/artifacts/download`, window.location.origin);
  url.searchParams.set("path", artifact.path);
  const response = await fetch(`/jobs/${jobId}/artifacts/download${url.search}`);
  if (!response.ok) {
    throw new Error("failed to download artifact");
  }
  return response.blob();
}

export async function openArtifactInFolder(
  jobId: string,
  artifact: ArtifactRef
): Promise<OpenArtifactResponse> {
  const url = new URL(`/jobs/${jobId}/artifacts/open`, window.location.origin);
  url.searchParams.set("path", artifact.path);
  const response = await fetch(`/jobs/${jobId}/artifacts/open${url.search}`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("failed to open artifact in folder");
  }
  return response.json();
}
