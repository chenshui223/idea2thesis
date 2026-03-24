import { useState } from "react";

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
  const [snapshot] = useState<JobSnapshot>(emptySnapshot);

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
        onFileChange={setSelectedFile}
        onSubmit={() => {
          void selectedFile;
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
