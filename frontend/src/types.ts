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

export const AGENT_ROLES = [
  "advisor",
  "coder",
  "writer",
  "requirements_reviewer",
  "engineering_reviewer",
  "delivery_reviewer",
  "code_eval",
  "doc_check"
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export type GlobalSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AgentSettings = {
  useGlobal: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type RuntimeConfig = {
  schema_version: string;
  global: {
    api_key: string;
    base_url: string;
    model: string;
  };
  agents: Record<
    string,
    {
      use_global: boolean;
      api_key: string;
      base_url: string;
      model: string;
    }
  >;
};

export type PersistedSettings = {
  schema_version: string;
  global: {
    base_url: string;
    model: string;
  };
  agents: Record<
    string,
    {
      use_global: boolean;
      base_url: string;
      model: string;
    }
  >;
};

export type SettingsResponse = PersistedSettings & {
  api_key_configured: boolean;
};
