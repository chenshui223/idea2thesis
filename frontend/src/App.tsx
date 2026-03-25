import { useEffect, useRef, useState } from "react";

import {
  deleteJob,
  downloadArtifact,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [rerunError, setRerunError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [artifactPreviewTitle, setArtifactPreviewTitle] = useState("");
  const [artifactPreviewFileName, setArtifactPreviewFileName] = useState("");
  const [artifactPreviewKind, setArtifactPreviewKind] = useState("");
  const [artifactPreviewContent, setArtifactPreviewContent] = useState("");
  const [artifactPreviewTruncated, setArtifactPreviewTruncated] = useState(false);
  const [artifactPreviewError, setArtifactPreviewError] = useState("");
  const [selectedArtifactPath, setSelectedArtifactPath] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactRef | null>(null);
  const [artifactActionError, setArtifactActionError] = useState("");
  const [artifactActionBusy, setArtifactActionBusy] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
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
        setSelectedJob(nextDetail);
        setSnapshot(buildSelectedSnapshot(nextDetail));
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
    let cancelled = false;
    void loadHistory(historyQuery).then(async (items) => {
      if (cancelled || !items || items.length === 0) {
        return;
      }
      const selectedId =
        selectedJobId && items.some((item) => item.job_id === selectedJobId)
          ? selectedJobId
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
    setArtifactPreviewContent("");
    setArtifactPreviewTruncated(false);
    setArtifactPreviewError("");
    try {
      const preview = await fetchArtifactContent(currentJobId, artifact);
      setArtifactPreviewTitle(preview.path);
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
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = selectedArtifact.path.split("/").pop() ?? "artifact";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setArtifactActionError(
        error instanceof Error ? error.message : "failed to download artifact"
      );
    } finally {
      setArtifactActionBusy(false);
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
    <main>
      <h1>idea2thesis</h1>
      <p>One-click thesis project generation</p>
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
      <button
        type="button"
        aria-expanded={showAdvancedSettings}
        onClick={() => setShowAdvancedSettings((value) => !value)}
      >
        Advanced Settings
      </button>
      {showAdvancedSettings ? (
        <AgentConfigPanel
          agents={agentSettings}
          onAgentChange={handleAgentSettingsChange}
        />
      ) : null}
      <UploadForm
        disabled={isSubmitting || isPolling}
        loading={isSubmitting || isPolling}
        errorMessage={errorMessage}
        onFileChange={setSelectedFile}
        onSubmit={() => {
          void handleSubmit();
        }}
      />
      <section>
        <h2>History Workbench</h2>
        {historyError ? <p>{historyError}</p> : null}
        {detailError ? <p>{detailError}</p> : null}
        {eventsError ? <p>{eventsError}</p> : null}
        {rerunError ? <p>{rerunError}</p> : null}
        {deleteError ? <p>{deleteError}</p> : null}
        <div>
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
      <JobTimeline stage={snapshot.stage} />
      <AgentBoard agents={snapshot.agents} />
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
      <ValidationReportViewer
        validationState={snapshot.validation_state}
        disposition={snapshot.final_disposition}
      />
    </main>
  );
}
