type JobTimelineProps = {
  stage: string;
};

export function JobTimeline(props: JobTimelineProps) {
  return (
    <section>
      <h2>Job Timeline</h2>
      <p>Current stage: {props.stage}</p>
    </section>
  );
}
