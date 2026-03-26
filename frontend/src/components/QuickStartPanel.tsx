type QuickStartPanelProps = {
  selectedFileName: string;
};

export function QuickStartPanel(props: QuickStartPanelProps) {
  return (
    <section className="quick-start-panel">
      <div className="quick-start-header">
        <p className="eyebrow">local single-user workflow</p>
        <h2>Quick Start</h2>
        <p className="quick-start-summary">
          Fill in one API configuration, choose a `.docx` brief, and let the local
          multi-agent pipeline generate code, documents, and a thesis first draft.
        </p>
      </div>
      <div className="quick-start-meta">
        <p>API Key is never saved.</p>
        <p>Base URL and model are restored on reload.</p>
        <p>{props.selectedFileName ? `Selected brief: ${props.selectedFileName}` : "No brief selected yet."}</p>
      </div>
      <ol className="quick-start-steps">
        <li>Enter your global API Key, Base URL, and Model.</li>
        <li>Download the sample brief or upload your own design brief.</li>
        <li>Click Generate Project and monitor progress in History Workbench.</li>
      </ol>
    </section>
  );
}
