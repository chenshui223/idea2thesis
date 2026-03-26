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

export function ValidationReportViewer(props: ValidationReportViewerProps) {
  const summary = buildValidationSummary(
    props.validationState,
    props.disposition
  );

  return (
    <section>
      <h2>Validation Report</h2>
      <p>Validation summary: {summary}</p>
      <p>Validation state: {props.validationState}</p>
      <p>Final disposition: {props.disposition}</p>
    </section>
  );
}
