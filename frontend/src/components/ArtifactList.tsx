import type { ArtifactRef } from "../types";

type ArtifactListProps = {
  artifacts: ArtifactRef[];
};

export function ArtifactList(props: ArtifactListProps) {
  return (
    <section>
      <h2>Artifacts</h2>
      <ul>
        {props.artifacts.map((artifact) => (
          <li key={`${artifact.kind}-${artifact.path}`}>
            {artifact.kind}: {artifact.path}
          </li>
        ))}
      </ul>
    </section>
  );
}
