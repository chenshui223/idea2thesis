import type { ArtifactRef } from "../types";

type ArtifactListProps = {
  artifacts: ArtifactRef[];
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

export function ArtifactList(props: ArtifactListProps) {
  const systemArtifacts = props.artifacts
    .filter((artifact) => artifact.kind !== "workspace_file")
    .sort((left, right) => left.path.localeCompare(right.path));
  const generatedCode = props.artifacts
    .filter((artifact) => artifact.kind === "workspace_file" && !isDocPath(artifact.path))
    .sort((left, right) => left.path.localeCompare(right.path));
  const generatedDocs = props.artifacts
    .filter((artifact) => artifact.kind === "workspace_file" && isDocPath(artifact.path))
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
              <li key={`${artifact.kind}-${artifact.path}`}>
                <strong>{artifact.kind}</strong>: {artifact.path}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
