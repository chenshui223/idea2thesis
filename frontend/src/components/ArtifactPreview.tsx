import { useLocale } from "../i18n";

type ArtifactPreviewProps = {
  title: string;
  fileName: string;
  artifactKind: string;
  previewType: string;
  content: string;
  truncated: boolean;
  errorMessage: string;
  actionErrorMessage: string;
  canActOnArtifact: boolean;
  actionBusy: boolean;
  onClear: () => void;
  onDownload: () => void;
  onOpenInFolder: () => void;
};

export function ArtifactPreview(props: ArtifactPreviewProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const previewStatus = props.errorMessage
    ? (isZh ? "错误" : "error")
    : props.content
      ? (props.truncated ? (isZh ? "已截断" : "truncated") : isZh ? "完整" : "complete")
      : isZh
        ? "空闲"
        : "idle";
  const previewLabel = props.fileName
    ? props.previewType === "docx"
      ? (isZh ? "Word 预览" : "Word Preview")
      : (
        props.fileName.endsWith(".py") ||
        props.fileName.endsWith(".ts") ||
        props.fileName.endsWith(".tsx") ||
        props.fileName.endsWith(".js") ||
        props.fileName.endsWith(".json")
      )
        ? (isZh ? "代码预览" : "Code Preview")
        : isZh
          ? "文档预览"
          : "Document Preview"
    : isZh
      ? "产物预览"
      : "Artifact Preview";
  const isCodePreview = previewLabel === "Code Preview" || previewLabel === "代码预览";

  return (
    <section>
      <h2>{isZh ? "产物预览" : "Artifact Preview"}</h2>
      <p>{previewLabel}</p>
      <p>{props.title || (isZh ? "选择一个产物以查看预览。" : "Select an artifact to preview.")}</p>
      {props.fileName ? <p>{isZh ? `文件：${props.fileName}` : `File: ${props.fileName}`}</p> : null}
      {props.artifactKind ? (
        <p>{isZh ? `产物类型：${props.artifactKind}` : `Artifact type: ${props.artifactKind}`}</p>
      ) : null}
      <p>{isZh ? `预览状态：${previewStatus}` : `Preview status: ${previewStatus}`}</p>
      <button
        type="button"
        disabled={!props.canActOnArtifact || props.actionBusy}
        onClick={props.onDownload}
      >
        {isZh ? "下载产物" : "Download Artifact"}
      </button>
      <button
        type="button"
        disabled={!props.canActOnArtifact || props.actionBusy}
        onClick={props.onOpenInFolder}
      >
        {isZh ? "在文件夹中打开" : "Open In Folder"}
      </button>
      <button type="button" onClick={props.onClear}>
        {isZh ? "清空预览" : "Clear Preview"}
      </button>
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
      {props.actionErrorMessage ? <p>{props.actionErrorMessage}</p> : null}
      {props.content ? (
        isCodePreview ? <pre>{props.content}</pre> : <article>{props.content}</article>
      ) : null}
      {props.truncated ? <p>{isZh ? "预览内容已截断。" : "Preview truncated."}</p> : null}
    </section>
  );
}
