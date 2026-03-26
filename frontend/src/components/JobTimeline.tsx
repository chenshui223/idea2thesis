type JobTimelineProps = {
  stage: string;
};

function describeStage(stage: string) {
  if (stage === "idle") {
    return {
      current: "Idle",
      label: "Idle",
      guidance: "Waiting for your first .docx brief."
    };
  }
  if (stage === "queued") {
    return {
      current: "Queued",
      label: "Queued",
      guidance: "The backend accepted the job and the local worker will claim it next."
    };
  }
  if (stage === "advisor_running") {
    return {
      current: "Advisor Planning",
      label: "Planning project scope",
      guidance: "The advisor agent is analyzing the brief and defining the delivery scope."
    };
  }
  if (stage === "coder_running") {
    return {
      current: "Code Generation",
      label: "Generating the runnable scaffold",
      guidance: "The coder agent is generating the runnable scaffold and implementation plan."
    };
  }
  if (stage === "writer_running") {
    return {
      current: "Document Drafting",
      label: "Drafting thesis and project documents",
      guidance: "The writer agent is drafting the thesis first draft and repository documents."
    };
  }
  if (stage === "advisor") {
    return {
      current: "Advisor",
      label: "Planning the delivery scope",
      guidance: "The advisor agent is analyzing the brief and defining the delivery scope."
    };
  }
  if (stage === "coder") {
    return {
      current: "Coder",
      label: "Generating the runnable scaffold",
      guidance: "The coder agent is generating the runnable scaffold and implementation plan."
    };
  }
  if (stage === "writer") {
    return {
      current: "Writer",
      label: "Writing the thesis draft",
      guidance: "The writer agent is drafting the thesis first draft and repository documents."
    };
  }
  if (stage === "review_running") {
    return {
      current: "Review",
      label: "Review",
      guidance: "Reviewer agents are checking brief alignment, engineering quality, and delivery readiness."
    };
  }
  if (
    ["requirements_reviewer", "engineering_reviewer", "delivery_reviewer"].includes(stage)
  ) {
    return {
      current: "Reviewer Checks",
      label: "Reviewing the deliverables",
      guidance: "Reviewer agents are checking brief alignment, engineering quality, and delivery readiness."
    };
  }
  if (stage === "verification_running") {
    return {
      current: "Local Verification",
      label: "Verifying deliverables",
      guidance: "The generated workspace and thesis draft are being checked before final delivery."
    };
  }
  if (stage === "code_eval" || stage === "doc_check") {
    return {
      current: "Local Verification",
      label: "Verifying deliverables",
      guidance: "The generated workspace and thesis draft are being checked before final delivery."
    };
  }
  if (stage === "planning") {
    return {
      current: "Planning",
      label: "Planning",
      guidance: "The advisor is reading the brief and defining delivery scope."
    };
  }
  if (stage === "implementation" || stage === "drafting") {
    return {
      current: "Generating",
      label: "Generating",
      guidance: "The pipeline is producing code, repository docs, and the thesis first draft."
    };
  }
  if (stage === "review") {
    return {
      current: "Review",
      label: "Review",
      guidance: "Reviewer agents and local checks are evaluating the generated deliverables."
    };
  }
  if (stage === "blocked") {
    return {
      current: "Blocked",
      label: "Blocked",
      guidance: "Manual repair is required before this job can be delivered."
    };
  }
  if (stage === "done" || stage === "completed") {
    return {
      current: "Completed",
      label: "Completed",
      guidance: "Generation finished. Review the artifacts and export the workspace when ready."
    };
  }
  return {
    current: stage || "Unknown",
    label: stage || "Unknown",
    guidance: "The selected job is still moving through the local pipeline."
  };
}

export function JobTimeline(props: JobTimelineProps) {
  const stage = describeStage(props.stage);

  return (
    <section>
      <h2>Job Timeline</h2>
      <p>Current stage: {stage.current}</p>
      <p>Pipeline status: {stage.label}</p>
      <p>{stage.guidance}</p>
    </section>
  );
}
