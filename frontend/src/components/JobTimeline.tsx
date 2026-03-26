type JobTimelineProps = {
  stage: string;
};

function describeStage(stage: string) {
  if (stage === "idle") {
    return {
      label: "Idle",
      guidance: "Waiting for your first .docx brief."
    };
  }
  if (stage === "queued") {
    return {
      label: "Queued",
      guidance: "The backend accepted the job and the local worker will claim it next."
    };
  }
  if (stage === "planning") {
    return {
      label: "Planning",
      guidance: "The advisor is reading the brief and defining delivery scope."
    };
  }
  if (stage === "implementation" || stage === "drafting") {
    return {
      label: "Generating",
      guidance: "The pipeline is producing code, repository docs, and the thesis first draft."
    };
  }
  if (stage === "review") {
    return {
      label: "Review",
      guidance: "Reviewer agents and local checks are evaluating the generated deliverables."
    };
  }
  if (stage === "blocked") {
    return {
      label: "Blocked",
      guidance: "Manual repair is required before this job can be delivered."
    };
  }
  if (stage === "done" || stage === "completed") {
    return {
      label: "Completed",
      guidance: "Generation finished. Review the artifacts and export the workspace when ready."
    };
  }
  return {
    label: stage || "Unknown",
    guidance: "The selected job is still moving through the local pipeline."
  };
}

export function JobTimeline(props: JobTimelineProps) {
  const stage = describeStage(props.stage);

  return (
    <section>
      <h2>Job Timeline</h2>
      <p>Current stage: {props.stage}</p>
      <p>Pipeline status: {stage.label}</p>
      <p>{stage.guidance}</p>
    </section>
  );
}
