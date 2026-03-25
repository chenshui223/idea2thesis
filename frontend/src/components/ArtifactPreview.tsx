type ArtifactPreviewProps = {
  title: string;
  fileName: string;
  artifactKind: string;
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
  const previewStatus = props.errorMessage
    ? "error"
    : props.content
      ? (props.truncated ? "truncated" : "complete")
      : "idle";
  const previewLabel = props.fileName
    ? (
        props.fileName.endsWith(".py") ||
        props.fileName.endsWith(".ts") ||
        props.fileName.endsWith(".tsx") ||
        props.fileName.endsWith(".js") ||
        props.fileName.endsWith(".json")
      )
      ? "Code Preview"
      : "Document Preview"
    : "Artifact Preview";
  const isCodePreview = previewLabel === "Code Preview";

  return (
    <section>
      <h2>Artifact Preview</h2>
      <p>{previewLabel}</p>
      <p>{props.title || "Select an artifact to preview."}</p>
      {props.fileName ? <p>File: {props.fileName}</p> : null}
      {props.artifactKind ? <p>Artifact type: {props.artifactKind}</p> : null}
      <p>Preview status: {previewStatus}</p>
      <button
        type="button"
        disabled={!props.canActOnArtifact || props.actionBusy}
        onClick={props.onDownload}
      >
        Download Artifact
      </button>
      <button
        type="button"
        disabled={!props.canActOnArtifact || props.actionBusy}
        onClick={props.onOpenInFolder}
      >
        Open In Folder
      </button>
      <button type="button" onClick={props.onClear}>
        Clear Preview
      </button>
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
      {props.actionErrorMessage ? <p>{props.actionErrorMessage}</p> : null}
      {props.content ? (
        isCodePreview ? <pre>{props.content}</pre> : <article>{props.content}</article>
      ) : null}
      {props.truncated ? <p>Preview truncated.</p> : null}
    </section>
  );
}
