import type { ArtifactRef } from "../types";

type ArtifactListProps = {
  artifacts: ArtifactRef[];
  selectedArtifactPath?: string;
  onSelectArtifact: (artifact: ArtifactRef) => void;
};

function isDocPath(path: string) {
  const lower = path.toLowerCase();
  return (
    lower.includes("/docs/") ||
    lower.endsWith(".md") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".txt")
  );
}

function formatArtifactPath(path: string) {
  const workspaceIndex = path.indexOf("/workspace/");
  if (workspaceIndex >= 0) {
    return path.slice(workspaceIndex + 1);
  }

  const artifactsIndex = path.indexOf("/artifacts/");
  if (artifactsIndex >= 0) {
    return path.slice(artifactsIndex + 1);
  }

  return path;
}

export function ArtifactList(props: ArtifactListProps) {
  const generatedCode = props.artifacts
    .filter((artifact) => artifact.kind === "workspace_file" && !isDocPath(artifact.path))
    .sort((left, right) => left.path.localeCompare(right.path));
  const generatedDocs = props.artifacts
    .filter((artifact) => isDocPath(artifact.path))
    .sort((left, right) => left.path.localeCompare(right.path));
  const systemArtifacts = props.artifacts
    .filter(
      (artifact) =>
        !(artifact.kind === "workspace_file" && !isDocPath(artifact.path)) &&
        !isDocPath(artifact.path)
    )
    .sort((left, right) => left.path.localeCompare(right.path));

  const sections = [
    { title: "System Artifacts", items: systemArtifacts },
    { title: "Generated Code", items: generatedCode },
    { title: "Generated Docs", items: generatedDocs }
  ].filter((section) => section.items.length > 0);

  return (
    <section>
      <h2>Artifacts</h2>
      {sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((artifact) => (
              <li
                key={`${artifact.kind}-${artifact.path}`}
                title={artifact.path}
                onClick={() => props.onSelectArtifact(artifact)}
              >
                <button
                  type="button"
                  aria-current={
                    props.selectedArtifactPath === artifact.path ? "true" : undefined
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onSelectArtifact(artifact);
                  }}
                >
                  <strong>{artifact.kind}</strong>: {formatArtifactPath(artifact.path)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
