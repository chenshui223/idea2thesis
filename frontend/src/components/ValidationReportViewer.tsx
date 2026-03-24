type ValidationReportViewerProps = {
  validationState: string;
  disposition: string;
};

export function ValidationReportViewer(props: ValidationReportViewerProps) {
  return (
    <section>
      <h2>Validation Report</h2>
      <p>Validation state: {props.validationState}</p>
      <p>Final disposition: {props.disposition}</p>
    </section>
  );
}
