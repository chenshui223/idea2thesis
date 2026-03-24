import { useEffect, useRef, useState } from "react";

import { fetchJob, uploadBrief } from "./api";
import { AgentBoard } from "./components/AgentBoard";
import { ArtifactList } from "./components/ArtifactList";
import { JobTimeline } from "./components/JobTimeline";
import { SettingsForm } from "./components/SettingsForm";
import { UploadForm } from "./components/UploadForm";
import { ValidationReportViewer } from "./components/ValidationReportViewer";
import type { JobSnapshot } from "./types";

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

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<JobSnapshot>(emptySnapshot);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
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
    return () => {
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

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a .docx brief first.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const initialSnapshot = await uploadBrief(selectedFile);
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
        apiKey={apiKey}
        baseUrl={baseUrl}
        model={model}
        onApiKeyChange={setApiKey}
        onBaseUrlChange={setBaseUrl}
        onModelChange={setModel}
      />
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
