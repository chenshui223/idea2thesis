import type { ArtifactRef } from "../types";

type ValidationReportViewerProps = {
  validationState: string;
  disposition: string;
  artifacts: ArtifactRef[];
};

function buildValidationSummary(validationState: string, disposition: string) {
  if (validationState === "completed" && disposition === "completed") {
    return "Validation completed and the deliverable is ready.";
  }

  if (validationState === "blocked" || disposition === "blocked") {
    return "Validation is blocked and manual repair is required.";
  }

  if (validationState === "interrupted" || disposition === "interrupted") {
    return "Validation was interrupted before the deliverable could be verified.";
  }

  if (disposition === "failed") {
    return "Validation finished with a failed delivery outcome.";
  }

  if (validationState === "running") {
    return "Validation is still running for the selected job.";
  }

  return "Validation has not finished yet for the selected job.";
}

function buildRecommendedAction(validationState: string, disposition: string) {
  if (validationState === "completed" && disposition === "completed") {
    return "Review artifacts, preview the Word draft, and export the workspace ZIP.";
  }

  if (validationState === "blocked" || disposition === "blocked") {
    return "Inspect reviewer output, repair the generated files, and rerun with a fresh API key.";
  }

  if (validationState === "interrupted" || disposition === "interrupted") {
    return "Confirm the local worker is available, then rerun the job with a fresh API key.";
  }

  if (disposition === "failed" || validationState === "failed") {
    return "Open the latest verification artifacts and fix the generated code before rerunning.";
  }

  if (validationState === "running") {
    return "Wait for the worker to finish the current stage. The selected job refreshes automatically.";
  }

  return "Keep this page open. The worker will pick up the queued job automatically.";
}

function buildConfidenceSummary(validationState: string, disposition: string) {
  if (validationState === "completed" && disposition === "completed") {
    return "Ready to deliver";
  }
  if (validationState === "blocked" || disposition === "blocked") {
    return "Delivery blocked";
  }
  if (validationState === "interrupted" || disposition === "interrupted") {
    return "Delivery interrupted";
  }
  if (validationState === "failed" || disposition === "failed") {
    return "Delivery failed validation";
  }
  if (validationState === "running") {
    return "Evidence still being collected";
  }
  return "Evidence pending";
}

function buildEvidenceList(artifacts: ArtifactRef[]) {
  const labels: string[] = [];
  const kinds = new Set(artifacts.map((artifact) => artifact.kind));

  if (kinds.has("job_manifest")) {
    labels.push("Job manifest");
  }
  if (kinds.has("code_eval")) {
    labels.push("Code verification artifact");
  }
  if (kinds.has("doc_check")) {
    labels.push("Document check artifact");
  }
  if (kinds.has("thesis_draft_docx")) {
    labels.push("Word thesis draft");
  }

  return labels;
}

export function ValidationReportViewer(props: ValidationReportViewerProps) {
  const summary = buildValidationSummary(
    props.validationState,
    props.disposition
  );
  const recommendedAction = buildRecommendedAction(
    props.validationState,
    props.disposition
  );
  const confidenceSummary = buildConfidenceSummary(
    props.validationState,
    props.disposition
  );
  const evidenceList = buildEvidenceList(props.artifacts);

  return (
    <section>
      <h2>Validation Report</h2>
      <p>Validation summary: {summary}</p>
      <h3>Delivery Confidence</h3>
      <p>Confidence summary: {confidenceSummary}</p>
      <p>Evidence count: {evidenceList.length}</p>
      {evidenceList.length > 0 ? (
        <ul>
          {evidenceList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No delivery evidence recorded yet.</p>
      )}
      <p>Recommended action: {recommendedAction}</p>
      <p>Validation state: {props.validationState}</p>
      <p>Final disposition: {props.disposition}</p>
    </section>
  );
}
