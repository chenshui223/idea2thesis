import { useEffect, useRef, useState } from "react";

import { fetchJob, fetchSettings, saveSettings, uploadBrief } from "./api";
import { AgentBoard } from "./components/AgentBoard";
import { AgentConfigPanel } from "./components/AgentConfigPanel";
import { ArtifactList } from "./components/ArtifactList";
import { JobTimeline } from "./components/JobTimeline";
import { SettingsForm } from "./components/SettingsForm";
import { UploadForm } from "./components/UploadForm";
import { ValidationReportViewer } from "./components/ValidationReportViewer";
import {
  AGENT_ROLES,
  type AgentRole,
  type AgentSettings,
  type GlobalSettings,
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
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedSettings;
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
      model: persisted?.global.model ?? "gpt-4.1-mini"
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
      model: globalSettings.model
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

export default function App() {
  const cachedSettings = readCachedSettings();
  const initialSettings = mergePersistedSettings(cachedSettings);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    initialSettings.global
  );
  const [agentSettings, setAgentSettings] = useState<
    Record<AgentRole, AgentSettings>
  >(initialSettings.agents);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<JobSnapshot>(emptySnapshot);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const pollTimerRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  };

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

  const isTerminal = (jobSnapshot: JobSnapshot) =>
    ["completed", "failed", "blocked"].includes(jobSnapshot.final_disposition);

  const startPolling = (jobId: string) => {
    stopPolling();
    setIsPolling(true);
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const nextSnapshot = await fetchJob(jobId);
        setSnapshot(nextSnapshot);
        if (isTerminal(nextSnapshot)) {
          stopPolling();
        }
      } catch (error) {
        stopPolling();
        setErrorMessage(
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

  return (
    <main>
      <h1>idea2thesis</h1>
      <p>One-click thesis project generation</p>
      <SettingsForm
        apiKey={globalSettings.apiKey}
        baseUrl={globalSettings.baseUrl}
        model={globalSettings.model}
        onApiKeyChange={(value) =>
          handleGlobalSettingsChange({ apiKey: value }, false)
        }
        onBaseUrlChange={(value) =>
          handleGlobalSettingsChange({ baseUrl: value }, true)
        }
        onModelChange={(value) =>
          handleGlobalSettingsChange({ model: value }, true)
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
      <JobTimeline stage={snapshot.stage} />
      <AgentBoard agents={snapshot.agents} />
      <ArtifactList artifacts={snapshot.artifacts} />
      <ValidationReportViewer
        validationState={snapshot.validation_state}
        disposition={snapshot.final_disposition}
      />
    </main>
  );
}
