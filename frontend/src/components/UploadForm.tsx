import { useLocale } from "../i18n";

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
  const { locale } = useLocale();
  const isZh = locale === "zh";

  return (
    <section className="upload-panel">
      <h2>{isZh ? "设计书上传" : "Brief Upload"}</h2>
      <p className="section-summary">
        {isZh
          ? "你可以先用示例设计书走通标准流程，也可以直接上传真实的 Word 版毕业设计书。"
          : "Start with the sample brief for a known-good path, or upload a real thesis design brief in Word format."}
      </p>
      <label className="field">
        {isZh ? "设计书（.docx）" : "Design Brief (.docx)"}
        <input
          aria-label={isZh ? "设计书（.docx）" : "Design Brief (.docx)"}
          type="file"
          accept=".docx"
          disabled={props.disabled}
          onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="button-row">
        <button type="button" disabled={props.disabled} onClick={props.onSubmit}>
          {props.loading
            ? isZh
              ? "生成中..."
              : "Generating..."
            : isZh
              ? "生成项目"
              : "Generate Project"}
        </button>
        <button
          type="button"
          disabled={props.sampleBriefBusy}
          onClick={props.onDownloadSampleBrief}
        >
          {props.sampleBriefBusy
            ? isZh
              ? "正在准备示例设计书..."
              : "Preparing Sample Brief..."
            : isZh
              ? "下载示例设计书"
              : "Download Sample Brief"}
        </button>
      </div>
      {props.errorMessage ? <p className="message error">{props.errorMessage}</p> : null}
      {props.sampleBriefErrorMessage ? (
        <p className="message error">{props.sampleBriefErrorMessage}</p>
      ) : null}
    </section>
  );
}
