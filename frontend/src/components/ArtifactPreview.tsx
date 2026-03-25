type ArtifactPreviewProps = {
  title: string;
  content: string;
  truncated: boolean;
  errorMessage: string;
};

export function ArtifactPreview(props: ArtifactPreviewProps) {
  return (
    <section>
      <h2>Artifact Preview</h2>
      <p>{props.title || "Select an artifact to preview."}</p>
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
      {props.content ? <pre>{props.content}</pre> : null}
      {props.truncated ? <p>Preview truncated.</p> : null}
    </section>
  );
}
