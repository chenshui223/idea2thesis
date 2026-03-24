type UploadFormProps = {
  disabled: boolean;
  loading: boolean;
  errorMessage: string;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
};

export function UploadForm(props: UploadFormProps) {
  return (
    <section>
      <h2>Brief Upload</h2>
      <label>
        Design Brief (.docx)
        <input
          aria-label="Design Brief (.docx)"
          type="file"
          accept=".docx"
          disabled={props.disabled}
          onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <button type="button" disabled={props.disabled} onClick={props.onSubmit}>
        {props.loading ? "Generating..." : "Generate Project"}
      </button>
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
    </section>
  );
}
