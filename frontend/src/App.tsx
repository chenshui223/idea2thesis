import { useEffect, useRef, useState } from "react";

import {
  deleteJob,
  downloadArtifact,
  downloadSampleBriefTemplate,
  downloadWorkspaceArchive,
  fetchArtifactContent,
  fetchJobDetail,
  fetchJobEvents,
  fetchJobs,
  fetchSettings,
  openArtifactInFolder,
  rerunJob,
  saveSettings,
  uploadBrief
} from "./api";
import { AgentBoard } from "./components/AgentBoard";
import { AgentConfigPanel } from "./components/AgentConfigPanel";
import { ArtifactList } from "./components/ArtifactList";
import { ArtifactPreview } from "./components/ArtifactPreview";
import { HistoryList } from "./components/HistoryList";
import { JobDetailPanel } from "./components/JobDetailPanel";
import { JobEventTimeline } from "./components/JobEventTimeline";
import { JobTimeline } from "./components/JobTimeline";
import { QuickStartPanel } from "./components/QuickStartPanel";
import { SettingsForm } from "./components/SettingsForm";
import { UploadForm } from "./components/UploadForm";
import { ValidationReportViewer } from "./components/ValidationReportViewer";
import {
  AGENT_ROLES,
  type AgentRole,
  type AgentSettings,
  type ArtifactRef,
  type GlobalSettings,
  type HistoryListItem,
  type JobDetail,
  type JobEvent,
  type JobListQuery,
  type JobSnapshot,
  type PersistedSettings,
  type RuntimeConfig,
  type SettingsResponse
} from "./types";

const emptySnapshot: JobSnapshot = {
  schema_version: "v1alpha1",
  job_id: "",
  stage: "idle",
  status: "pending",
  agents: [],
  artifacts: [],
  validation_state: "pending",
  final_disposition: "pending"
};

const SETTINGS_CACHE_KEY = "idea2thesis.settings.cache";
const HISTORY_QUERY_KEY = "idea2thesis.history.query";
const HISTORY_SELECTED_JOB_KEY = "idea2thesis.history.selectedJobId";
const DEFAULT_THESIS_COVER: GlobalSettings["thesisCover"] = {
  school: "待填写学校",
  department: "待填写学院",
  major: "计算机软件相关专业",
  studentName: "待填写",
  studentId: "待填写",
  advisor: "待填写"
};

function buildDefaultAgentSettings(): Record<AgentRole, AgentSettings> {
  return Object.fromEntries(
    AGENT_ROLES.map((role) => [
      role,
      {
        useGlobal: true,
        apiKey: "",
        baseUrl: "",
        model: ""
      }
    ])
  ) as Record<AgentRole, AgentSettings>;
}

function readCachedSettings(): PersistedSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSettings) : null;
  } catch {
    return null;
  }
}

function readCachedHistoryQuery(): JobListQuery | null {
  try {
    const raw = window.localStorage.getItem(HISTORY_QUERY_KEY);
    return raw ? (JSON.parse(raw) as JobListQuery) : null;
  } catch {
    return null;
  }
}

function readCachedSelectedJobId(): string {
  try {
    return window.localStorage.getItem(HISTORY_SELECTED_JOB_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistSelectedJobId(jobId: string) {
  try {
    if (!jobId) {
      window.localStorage.removeItem(HISTORY_SELECTED_JOB_KEY);
      return;
    }
    window.localStorage.setItem(HISTORY_SELECTED_JOB_KEY, jobId);
  } catch {
    return;
  }
}

function mergePersistedSettings(
  persisted: PersistedSettings | SettingsResponse | null
): {
  global: GlobalSettings;
  agents: Record<AgentRole, AgentSettings>;
} {
  const defaultAgents = buildDefaultAgentSettings();
  const mergedAgents = { ...defaultAgents };
  for (const role of AGENT_ROLES) {
    const persistedAgent = persisted?.agents[role];
    if (persistedAgent) {
      mergedAgents[role] = {
        useGlobal: persistedAgent.use_global,
        apiKey: "",
        baseUrl: persistedAgent.base_url,
        model: persistedAgent.model
      };
    }
  }

  return {
    global: {
      apiKey: "",
      baseUrl: persisted?.global.base_url ?? "https://api.openai.com/v1",
      model: persisted?.global.model ?? "gpt-4.1-mini",
      thesisCover: {
        school: persisted?.global.thesis_cover?.school ?? "",
        department: persisted?.global.thesis_cover?.department ?? "",
        major: persisted?.global.thesis_cover?.major ?? "",
        studentName: persisted?.global.thesis_cover?.student_name ?? "",
        studentId: persisted?.global.thesis_cover?.student_id ?? "",
        advisor: persisted?.global.thesis_cover?.advisor ?? ""
      }
    },
    agents: mergedAgents
  };
}

function toPersistedSettings(
  globalSettings: GlobalSettings,
  agentSettings: Record<AgentRole, AgentSettings>
): PersistedSettings {
  return {
    schema_version: "v1alpha1",
    global: {
      base_url: globalSettings.baseUrl,
      model: globalSettings.model,
      thesis_cover: {
        school: globalSettings.thesisCover.school,
        department: globalSettings.thesisCover.department,
        major: globalSettings.thesisCover.major,
        student_name: globalSettings.thesisCover.studentName,
        student_id: globalSettings.thesisCover.studentId,
        advisor: globalSettings.thesisCover.advisor
      }
    },
    agents: Object.fromEntries(
      AGENT_ROLES.map((role) => [
        role,
        {
          use_global: agentSettings[role].useGlobal,
          base_url: agentSettings[role].baseUrl,
          model: agentSettings[role].model
        }
      ])
    )
  };
}

function buildRuntimeConfig(
  globalSettings: GlobalSettings,
  agentSettings: Record<AgentRole, AgentSettings>
): RuntimeConfig {
  return {
    schema_version: "v1alpha1",
    global: {
      api_key: globalSettings.apiKey.trim(),
      base_url: globalSettings.baseUrl.trim(),
      model: globalSettings.model.trim()
    },
    agents: Object.fromEntries(
      AGENT_ROLES.map((role) => {
        const agent = agentSettings[role];
        return [
          role,
          {
            use_global: agent.useGlobal,
            api_key: agent.useGlobal
              ? ""
              : (agent.apiKey.trim() || globalSettings.apiKey.trim()),
            base_url: agent.useGlobal
              ? ""
              : (agent.baseUrl.trim() || globalSettings.baseUrl.trim()),
            model: agent.useGlobal
              ? ""
              : (agent.model.trim() || globalSettings.model.trim())
          }
        ];
      })
    )
  };
}

function buildRuntimePresetConfig(detail: JobDetail): RuntimeConfig {
  return {
    schema_version: "v1alpha1",
    global: {
      api_key: "",
      base_url: detail.runtime_preset.global.base_url,
      model: detail.runtime_preset.global.model
    },
    agents: Object.fromEntries(
      Object.entries(detail.runtime_preset.agents).map(([role, agent]) => [
        role,
        {
          use_global: agent.useGlobal,
          api_key: "",
          base_url: agent.base_url,
          model: agent.model
        }
      ])
    )
  };
}

function isTerminal(snapshot: JobSnapshot | JobDetail) {
  return ["completed", "failed", "blocked", "interrupted", "deleted"].includes(
    snapshot.final_disposition
  );
}

function isDeleted(detail: JobDetail) {
  return detail.status === "deleted" || Boolean(detail.deleted_at);
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function buildSelectedSnapshot(detail: JobDetail): JobSnapshot {
  return {
    schema_version: detail.schema_version,
    job_id: detail.job_id,
    stage: detail.stage,
    status: detail.status,
    agents: detail.agents ?? [],
    artifacts: detail.artifacts ?? [],
    validation_state: detail.validation_state,
    final_disposition: detail.final_disposition
  };
}

export default function App() {
  const cachedSettings = readCachedSettings();
  const initialSettings = mergePersistedSettings(cachedSettings);
  const cachedQuery = readCachedHistoryQuery();
  const cachedSelectedJobId = readCachedSelectedJobId();

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    initialSettings.global
  );
  const [agentSettings, setAgentSettings] = useState<Record<AgentRole, AgentSettings>>(
    initialSettings.agents
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<JobSnapshot>(emptySnapshot);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [selectedJobEvents, setSelectedJobEvents] = useState<JobEvent[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryListItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyQuery, setHistoryQuery] = useState<JobListQuery>(
    cachedQuery ?? { search: "", status: "all", sort: "updated_desc" }
  );
  const [persistedSelectedJobId, setPersistedSelectedJobId] = useState(
    cachedSelectedJobId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [sampleBriefBusy, setSampleBriefBusy] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sampleBriefError, setSampleBriefError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [rerunError, setRerunError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [workspaceArchiveError, setWorkspaceArchiveError] = useState("");
  const [workspaceArchiveBusy, setWorkspaceArchiveBusy] = useState(false);
  const [artifactPreviewTitle, setArtifactPreviewTitle] = useState("");
  const [artifactPreviewFileName, setArtifactPreviewFileName] = useState("");
  const [artifactPreviewKind, setArtifactPreviewKind] = useState("");
  const [artifactPreviewType, setArtifactPreviewType] = useState("text");
  const [artifactPreviewContent, setArtifactPreviewContent] = useState("");
  const [artifactPreviewTruncated, setArtifactPreviewTruncated] = useState(false);
  const [artifactPreviewError, setArtifactPreviewError] = useState("");
  const [selectedArtifactPath, setSelectedArtifactPath] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactRef | null>(null);
  const [artifactActionError, setArtifactActionError] = useState("");
  const [artifactActionBusy, setArtifactActionBusy] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const historyQueryRef = useRef(historyQuery);
  const selectedJobId = selectedJob?.job_id ?? snapshot.job_id;

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  };

  const syncSettingsFromRuntimePreset = (detail: JobDetail) => {
    const nextGlobalSettings: GlobalSettings = {
      apiKey: "",
      baseUrl: detail.runtime_preset.global.base_url,
      model: detail.runtime_preset.global.model,
      thesisCover: globalSettings.thesisCover
    };
    const nextAgentSettings = Object.fromEntries(
      AGENT_ROLES.map((role) => {
        const agent = detail.runtime_preset.agents[role];
        return [
          role,
          agent
            ? {
                useGlobal: agent.useGlobal,
                apiKey: "",
                baseUrl: agent.base_url,
                model: agent.model
              }
            : {
                useGlobal: true,
                apiKey: "",
                baseUrl: detail.runtime_preset.global.base_url,
                model: detail.runtime_preset.global.model
              }
        ];
      })
    ) as Record<AgentRole, AgentSettings>;

    setGlobalSettings(nextGlobalSettings);
    setAgentSettings(nextAgentSettings);
    window.localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify(toPersistedSettings(nextGlobalSettings, nextAgentSettings))
    );
  };

  const loadHistory = async (query: JobListQuery) => {
    setHistoryError("");
    try {
      const response = await fetchJobs(query);
      setHistoryItems(response.items);
      setHistoryTotal(response.total);
      window.localStorage.setItem(HISTORY_QUERY_KEY, JSON.stringify(query));
      return response.items;
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "failed to load history"
      );
      return null;
    }
  };

  const loadDetail = async (jobId: string) => {
    setDetailError("");
    try {
      const detail = await fetchJobDetail(jobId);
      handleClearArtifactPreview();
      setSelectedJob(detail);
      setSnapshot(buildSelectedSnapshot(detail));
      setPersistedSelectedJobId(detail.job_id);
      persistSelectedJobId(detail.job_id);
      return detail;
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "failed to load job detail"
      );
      return null;
    }
  };

  const loadEvents = async (jobId: string) => {
    setEventsError("");
    try {
      const response = await fetchJobEvents(jobId);
      setSelectedJobEvents(response.items);
    } catch (error) {
      setEventsError(
        error instanceof Error ? error.message : "failed to load job events"
      );
    }
  };

  const selectJob = async (jobId: string) => {
    stopPolling();
    const detail = await loadDetail(jobId);
    if (detail) {
      await loadEvents(jobId);
      if (!isTerminal(detail) && !isDeleted(detail)) {
        startPolling(jobId);
      }
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    setIsPolling(true);
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const nextDetail = await fetchJobDetail(jobId);
        const [eventsResponse, historyResponse] = await Promise.all([
          fetchJobEvents(jobId),
          fetchJobs(historyQueryRef.current)
        ]);
        setSelectedJob(nextDetail);
        setSnapshot(buildSelectedSnapshot(nextDetail));
        setSelectedJobEvents(eventsResponse.items);
        setHistoryItems(historyResponse.items);
        setHistoryTotal(historyResponse.total);
        if (isTerminal(nextDetail) || isDeleted(nextDetail)) {
          stopPolling();
        }
      } catch (error) {
        stopPolling();
        setDetailError(
          error instanceof Error ? error.message : "failed to refresh job"
        );
      }
    }, 2000);
  };

  const updatePersistedSettings = (
    nextGlobalSettings: GlobalSettings,
    nextAgentSettings: Record<AgentRole, AgentSettings>
  ) => {
    const persisted = toPersistedSettings(nextGlobalSettings, nextAgentSettings);
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(persisted));
    void saveSettings(persisted).catch(() => {
      return;
    });
  };

  const handleGlobalSettingsChange = (
    patch: Partial<GlobalSettings>,
    persist: boolean
  ) => {
    setGlobalSettings((current) => {
      const next = { ...current, ...patch };
      if (persist) {
        updatePersistedSettings(next, agentSettings);
      }
      return next;
    });
  };

  const handleAgentSettingsChange = (
    role: AgentRole,
    patch: Partial<AgentSettings>
  ) => {
    setAgentSettings((current) => {
      const next = {
        ...current,
        [role]: {
          ...current[role],
          ...patch
        }
      };
      if ("baseUrl" in patch || "model" in patch || "useGlobal" in patch) {
        updatePersistedSettings(globalSettings, next);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a .docx brief first.");
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".docx")) {
      setErrorMessage("Please select a .docx brief first.");
      return;
    }
    if (!globalSettings.baseUrl.trim() || !globalSettings.model.trim()) {
      setErrorMessage("Base URL and Model are required.");
      return;
    }

    const runtimeConfig = buildRuntimeConfig(globalSettings, agentSettings);
    const hasMissingEffectiveConfig = AGENT_ROLES.some((role) => {
      const agent = runtimeConfig.agents[role];
      const effectiveApiKey = agent.use_global
        ? runtimeConfig.global.api_key
        : agent.api_key;
      const effectiveBaseUrl = agent.use_global
        ? runtimeConfig.global.base_url
        : agent.base_url;
      const effectiveModel = agent.use_global
        ? runtimeConfig.global.model
        : agent.model;
      return !effectiveApiKey || !effectiveBaseUrl || !effectiveModel;
    });
    if (hasMissingEffectiveConfig) {
      setErrorMessage("API Key, Base URL, and Model are required for every agent.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const initialSnapshot = await uploadBrief(selectedFile, runtimeConfig);
      setSnapshot(initialSnapshot);
      setSelectedJob(null);
      setSelectedJobEvents([]);
      await loadHistory(historyQuery);
      if (isTerminal(initialSnapshot)) {
        stopPolling();
      } else {
        startPolling(initialSnapshot.job_id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "failed to create job"
      );
      stopPolling();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerun = async () => {
    if (!selectedJob) {
      return;
    }
    setRerunError("");
    try {
      const runtimeConfig = buildRuntimeConfig(globalSettings, agentSettings);
      const nextDetail = await rerunJob(selectedJob.job_id, runtimeConfig);
      syncSettingsFromRuntimePreset(nextDetail);
      setGlobalSettings((current) => ({ ...current, apiKey: "" }));
      setAgentSettings((current) =>
        Object.fromEntries(
          AGENT_ROLES.map((role) => [
            role,
            {
              ...current[role],
              apiKey: ""
            }
          ])
        ) as Record<AgentRole, AgentSettings>
      );
      setSelectedJob(nextDetail);
      setSnapshot(buildSelectedSnapshot(nextDetail));
      setPersistedSelectedJobId(nextDetail.job_id);
      persistSelectedJobId(nextDetail.job_id);
      await loadHistory(historyQuery);
      await loadEvents(nextDetail.job_id);
      if (nextDetail.status === "pending") {
        startPolling(nextDetail.job_id);
      } else {
        stopPolling();
      }
    } catch (error) {
      setRerunError(
        error instanceof Error ? error.message : "failed to rerun job"
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) {
      return;
    }
    setDeleteError("");
    try {
      const nextDetail = await deleteJob(selectedJob.job_id);
      setSelectedJob(nextDetail);
      setSnapshot(buildSelectedSnapshot(nextDetail));
      await loadHistory(historyQuery);
      await loadEvents(nextDetail.job_id);
      stopPolling();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "failed to delete job"
      );
    }
  };

  const selectedHistoryItem =
    historyItems.find((item) => item.job_id === selectedJobId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchSettings()
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const merged = mergePersistedSettings(settings);
        setGlobalSettings((current) => ({
          ...merged.global,
          apiKey: current.apiKey
        }));
        setAgentSettings((current) => {
          const nextSettings = { ...merged.agents };
          for (const role of AGENT_ROLES) {
            nextSettings[role] = {
              ...merged.agents[role],
              apiKey: current[role]?.apiKey ?? ""
            };
          }
          return nextSettings;
        });
        window.localStorage.setItem(
          SETTINGS_CACHE_KEY,
          JSON.stringify(toPersistedSettings(merged.global, merged.agents))
        );
      })
      .catch(() => {
        return;
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, []);

  useEffect(() => {
    historyQueryRef.current = historyQuery;
  }, [historyQuery]);

  useEffect(() => {
    let cancelled = false;
    void loadHistory(historyQuery).then(async (items) => {
      if (cancelled || !items) {
        return;
      }
      if (items.length === 0) {
        return;
      }
      const selectedId =
        selectedJobId && items.some((item) => item.job_id === selectedJobId)
          ? selectedJobId
          : persistedSelectedJobId &&
              items.some((item) => item.job_id === persistedSelectedJobId)
            ? persistedSelectedJobId
          : items[0].job_id;
      if (!selectedJobId || selectedId !== selectedJobId) {
        await selectJob(selectedId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [historyQuery.search, historyQuery.status, historyQuery.sort]);

  const currentJobId = selectedJob?.job_id ?? snapshot.job_id;

  useEffect(() => {
    const selectedId = selectedJob?.job_id ?? snapshot.job_id;
    if (!selectedId) {
      return;
    }
    const current = historyItems.find((item) => item.job_id === selectedId);
    if (!current) {
      return;
    }
    if (!selectedJob) {
      void selectJob(selectedId);
    }
  }, [historyItems]);

  const handleHistoryQueryChange = (patch: Partial<JobListQuery>) => {
    setHistoryQuery((current) => ({ ...current, ...patch }));
  };

  const handleClearArtifactPreview = () => {
    setSelectedArtifact(null);
    setSelectedArtifactPath("");
    setArtifactActionError("");
    setArtifactActionBusy(false);
    setArtifactPreviewTitle("");
    setArtifactPreviewFileName("");
    setArtifactPreviewKind("");
    setArtifactPreviewType("text");
    setArtifactPreviewContent("");
    setArtifactPreviewTruncated(false);
    setArtifactPreviewError("");
  };

  const handleSelectArtifact = async (artifact: ArtifactRef) => {
    if (!currentJobId) {
      return;
    }
    setSelectedArtifact(artifact);
    setSelectedArtifactPath(artifact.path);
    setArtifactActionError("");
    setArtifactPreviewTitle(artifact.path);
    setArtifactPreviewFileName(artifact.path.split("/").pop() ?? "");
    setArtifactPreviewKind(artifact.kind);
    setArtifactPreviewType("text");
    setArtifactPreviewContent("");
    setArtifactPreviewTruncated(false);
    setArtifactPreviewError("");
    try {
      const preview = await fetchArtifactContent(currentJobId, artifact);
      setArtifactPreviewTitle(preview.path);
      setArtifactPreviewType(preview.preview_type);
      setArtifactPreviewContent(preview.content);
      setArtifactPreviewTruncated(preview.truncated);
    } catch (error) {
      setArtifactPreviewError(
        error instanceof Error ? error.message : "failed to fetch artifact content"
      );
    }
  };

  const handleDownloadArtifact = async () => {
    if (!currentJobId || !selectedArtifact) {
      return;
    }
    setArtifactActionBusy(true);
    setArtifactActionError("");
    try {
      const blob = await downloadArtifact(currentJobId, selectedArtifact);
      triggerBlobDownload(
        blob,
        selectedArtifact.path.split("/").pop() ?? "artifact"
      );
    } catch (error) {
      setArtifactActionError(
        error instanceof Error ? error.message : "failed to download artifact"
      );
    } finally {
      setArtifactActionBusy(false);
    }
  };

  const handleDownloadWorkspaceArchive = async () => {
    if (!currentJobId) {
      return;
    }
    setWorkspaceArchiveBusy(true);
    setWorkspaceArchiveError("");
    try {
      const blob = await downloadWorkspaceArchive(currentJobId);
      triggerBlobDownload(blob, `${currentJobId}-workspace.zip`);
    } catch (error) {
      setWorkspaceArchiveError(
        error instanceof Error
          ? error.message
          : "failed to download workspace archive"
      );
    } finally {
      setWorkspaceArchiveBusy(false);
    }
  };

  const handleDownloadSampleBrief = async () => {
    setSampleBriefBusy(true);
    setSampleBriefError("");
    try {
      const blob = await downloadSampleBriefTemplate();
      triggerBlobDownload(blob, "sample-brief.docx");
    } catch (error) {
      setSampleBriefError(
        error instanceof Error
          ? error.message
          : "failed to download sample brief template"
      );
    } finally {
      setSampleBriefBusy(false);
    }
  };

  const handleOpenArtifactInFolder = async () => {
    if (!currentJobId || !selectedArtifact) {
      return;
    }
    setArtifactActionBusy(true);
    setArtifactActionError("");
    try {
      await openArtifactInFolder(currentJobId, selectedArtifact);
    } catch (error) {
      setArtifactActionError(
        error instanceof Error ? error.message : "failed to open artifact in folder"
      );
    } finally {
      setArtifactActionBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <a href="#generator-workspace" className="skip-link">
        Skip to generator workspace
      </a>
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">idea to thesis, locally</p>
          <h1>idea2thesis</h1>
          <p className="hero-summary">One-click thesis project generation</p>
          <p className="hero-detail">
            Turn a graduation design brief into a runnable repository, generated
            documentation, and a Word thesis draft with local verification evidence.
          </p>
        </div>
        <div className="hero-highlights" aria-label="product highlights">
          <p>Local single-user web app</p>
          <p>OpenAI-compatible API endpoints</p>
          <p>Global settings plus per-agent overrides</p>
          <p>Generated `.docx` thesis draft preview</p>
        </div>
      </header>

      <section className="setup-grid" id="generator-workspace">
        <div className="setup-column">
          <QuickStartPanel selectedFileName={selectedFile?.name ?? ""} />
          <UploadForm
            disabled={isSubmitting || isPolling}
            loading={isSubmitting || isPolling}
            errorMessage={errorMessage}
            sampleBriefBusy={sampleBriefBusy}
            sampleBriefErrorMessage={sampleBriefError}
            onFileChange={setSelectedFile}
            onDownloadSampleBrief={() => {
              void handleDownloadSampleBrief();
            }}
            onSubmit={() => {
              void handleSubmit();
            }}
          />
        </div>
        <div className="setup-column">
          <SettingsForm
            apiKey={globalSettings.apiKey}
            baseUrl={globalSettings.baseUrl}
            model={globalSettings.model}
            thesisCover={globalSettings.thesisCover}
            onApiKeyChange={(value) =>
              handleGlobalSettingsChange({ apiKey: value }, false)
            }
            onBaseUrlChange={(value) =>
              handleGlobalSettingsChange({ baseUrl: value }, true)
            }
            onModelChange={(value) =>
              handleGlobalSettingsChange({ model: value }, true)
            }
            onThesisCoverChange={(patch) =>
              handleGlobalSettingsChange(
                {
                  thesisCover: {
                    ...globalSettings.thesisCover,
                    ...patch
                  }
                },
                true
              )
            }
            onResetThesisCover={() =>
              handleGlobalSettingsChange(
                { thesisCover: { ...DEFAULT_THESIS_COVER } },
                true
              )
            }
          />
          <section className="advanced-settings-panel">
            <div className="section-header-row">
              <div>
                <p className="eyebrow">advanced runtime control</p>
                <h2>Agent Overrides</h2>
              </div>
              <button
                type="button"
                aria-expanded={showAdvancedSettings}
                onClick={() => setShowAdvancedSettings((value) => !value)}
              >
                Advanced Settings
              </button>
            </div>
            <p className="section-summary">
              Keep the default global configuration for normal use, then open per-agent
              overrides only when one role needs a different endpoint or model.
            </p>
            {showAdvancedSettings ? (
              <AgentConfigPanel
                agents={agentSettings}
                onAgentChange={handleAgentSettingsChange}
              />
            ) : (
              <p className="message">
                All agents are currently using the shared global configuration.
              </p>
            )}
          </section>
        </div>
      </section>

      <section className="workspace-panel">
        <h2>History Workbench</h2>
        {historyError ? <p>{historyError}</p> : null}
        {detailError ? <p>{detailError}</p> : null}
        {eventsError ? <p>{eventsError}</p> : null}
        {rerunError ? <p>{rerunError}</p> : null}
        {deleteError ? <p>{deleteError}</p> : null}
        <div className="history-grid">
          <HistoryList
            items={historyItems}
            total={historyTotal}
            query={historyQuery}
            selectedJobId={currentJobId}
            onSelectJob={(jobId) => {
              void selectJob(jobId);
            }}
            onQueryChange={handleHistoryQueryChange}
          />
          <JobDetailPanel
            job={selectedJob}
            selectedHistoryItem={selectedHistoryItem}
            workspaceArchiveBusy={workspaceArchiveBusy}
            workspaceArchiveError={workspaceArchiveError}
            onDownloadWorkspaceArchive={() => {
              void handleDownloadWorkspaceArchive();
            }}
            onRerun={() => {
              void handleRerun();
            }}
            onDelete={() => {
              void handleDelete();
            }}
          />
        </div>
        <JobEventTimeline events={selectedJobEvents} />
      </section>

      <section className="monitor-grid">
        <JobTimeline stage={snapshot.stage} />
        <AgentBoard agents={snapshot.agents} />
        <ValidationReportViewer
          validationState={snapshot.validation_state}
          disposition={snapshot.final_disposition}
          artifacts={snapshot.artifacts}
        />
      </section>

      <section className="artifact-grid">
        <ArtifactList
          artifacts={snapshot.artifacts}
          selectedArtifactPath={selectedArtifactPath}
          onSelectArtifact={(artifact) => {
            void handleSelectArtifact(artifact);
          }}
        />
        <ArtifactPreview
          title={artifactPreviewTitle}
          fileName={artifactPreviewFileName}
          artifactKind={artifactPreviewKind}
          previewType={artifactPreviewType}
          content={artifactPreviewContent}
          truncated={artifactPreviewTruncated}
          errorMessage={artifactPreviewError}
          actionErrorMessage={artifactActionError}
          canActOnArtifact={Boolean(selectedArtifact)}
          actionBusy={artifactActionBusy}
          onClear={handleClearArtifactPreview}
          onDownload={() => {
            void handleDownloadArtifact();
          }}
          onOpenInFolder={() => {
            void handleOpenArtifactInFolder();
          }}
        />
      </section>
    </main>
  );
}
