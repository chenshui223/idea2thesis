export type AgentStatus = {
  role: string;
  status: string;
  summary: string;
};

export type ArtifactRef = {
  kind: string;
  path: string;
};

export type JobSnapshot = {
  schema_version: string;
  job_id: string;
  stage: string;
  status: string;
  agents: AgentStatus[];
  artifacts: ArtifactRef[];
  validation_state: string;
  final_disposition: string;
};

export type SettingsSummary = {
  base_url: string;
  model: string;
  api_key_configured: boolean;
  organization?: string | null;
};
