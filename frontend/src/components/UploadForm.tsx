type UploadFormProps = {
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
          onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <button type="button" onClick={props.onSubmit}>
        Generate Project
      </button>
    </section>
  );
}
