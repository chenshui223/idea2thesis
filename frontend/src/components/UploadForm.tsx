type UploadFormProps = {
  disabled: boolean;
  loading: boolean;
  errorMessage: string;
  sampleBriefBusy: boolean;
  sampleBriefErrorMessage: string;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
  onDownloadSampleBrief: () => void;
};

export function UploadForm(props: UploadFormProps) {
  return (
    <section className="upload-panel">
      <h2>Brief Upload</h2>
      <p className="section-summary">
        Start with the sample brief for a known-good path, or upload a real thesis design brief in Word format.
      </p>
      <label className="field">
        Design Brief (.docx)
        <input
          aria-label="Design Brief (.docx)"
          type="file"
          accept=".docx"
          disabled={props.disabled}
          onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="button-row">
        <button type="button" disabled={props.disabled} onClick={props.onSubmit}>
          {props.loading ? "Generating..." : "Generate Project"}
        </button>
        <button
          type="button"
          disabled={props.sampleBriefBusy}
          onClick={props.onDownloadSampleBrief}
        >
          {props.sampleBriefBusy ? "Preparing Sample Brief..." : "Download Sample Brief"}
        </button>
      </div>
      {props.errorMessage ? <p className="message error">{props.errorMessage}</p> : null}
      {props.sampleBriefErrorMessage ? (
        <p className="message error">{props.sampleBriefErrorMessage}</p>
      ) : null}
    </section>
  );
}
