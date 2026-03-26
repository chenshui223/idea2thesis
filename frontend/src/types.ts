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
  thesisCover: {
    school: string;
    department: string;
    major: string;
    studentName: string;
    studentId: string;
    advisor: string;
  };
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
    thesis_cover: {
      school: string;
      department: string;
      major: string;
      student_name: string;
      student_id: string;
      advisor: string;
    };
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

export type HistoryListItem = {
  job_id: string;
  brief_title: string;
  source_job_id: string | null;
  status: string;
  stage: string;
  final_disposition: string;
  created_at: string;
  updated_at: string;
};

export type HistoryListResponse = {
  schema_version: string;
  items: HistoryListItem[];
  total: number;
};

export type RuntimePresetAgent = {
  useGlobal: boolean;
  base_url: string;
  model: string;
};

export type RuntimePreset = {
  schema_version: string;
  global: {
    base_url: string;
    model: string;
  };
  agents: Record<string, RuntimePresetAgent>;
};

export type JobDetail = JobSnapshot & {
  source_job_id: string | null;
  brief_title: string;
  workspace_path: string;
  input_file_path: string;
  error_message: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  runtime_preset: RuntimePreset;
};

export type JobEvent = {
  schema_version?: string;
  id: number;
  timestamp: string;
  kind: string;
  message: string;
  payload: Record<string, unknown>;
};

export type JobEventsResponse = {
  schema_version: string;
  items: JobEvent[];
};

export type JobListQuery = {
  search: string;
  status: string;
  sort: string;
};
