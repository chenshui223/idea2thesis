type ValidationReportViewerProps = {
  validationState: string;
  disposition: string;
};

function buildValidationSummary(validationState: string, disposition: string) {
  if (validationState === "completed" && disposition === "completed") {
    return "Validation completed and the deliverable is ready.";
  }

  if (validationState === "blocked" || disposition === "blocked") {
    return "Validation is blocked and manual repair is required.";
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

  if (disposition === "failed" || validationState === "failed") {
    return "Open the latest verification artifacts and fix the generated code before rerunning.";
  }

  if (validationState === "running") {
    return "Wait for the worker to finish the current stage. The selected job refreshes automatically.";
  }

  return "Keep this page open. The worker will pick up the queued job automatically.";
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

  return (
    <section>
      <h2>Validation Report</h2>
      <p>Validation summary: {summary}</p>
      <p>Recommended action: {recommendedAction}</p>
      <p>Validation state: {props.validationState}</p>
      <p>Final disposition: {props.disposition}</p>
    </section>
  );
}
