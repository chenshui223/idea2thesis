type ArtifactPreviewProps = {
  title: string;
  fileName: string;
  artifactKind: string;
  content: string;
  truncated: boolean;
  errorMessage: string;
};

export function ArtifactPreview(props: ArtifactPreviewProps) {
  const previewStatus = props.errorMessage
    ? "error"
    : props.content
      ? (props.truncated ? "truncated" : "complete")
      : "idle";

  return (
    <section>
      <h2>Artifact Preview</h2>
      <p>{props.title || "Select an artifact to preview."}</p>
      {props.fileName ? <p>File: {props.fileName}</p> : null}
      {props.artifactKind ? <p>Artifact type: {props.artifactKind}</p> : null}
      <p>Preview status: {previewStatus}</p>
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
      {props.content ? <pre>{props.content}</pre> : null}
      {props.truncated ? <p>Preview truncated.</p> : null}
    </section>
  );
}
