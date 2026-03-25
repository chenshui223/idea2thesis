import type { JobEvent } from "../types";

type JobEventTimelineProps = {
  events: JobEvent[];
};

export function JobEventTimeline(props: JobEventTimelineProps) {
  return (
    <section>
      <h2>Job Events</h2>
      <ul>
        {props.events.map((event) => (
          <li key={event.id}>
            {event.timestamp} {event.kind}: {event.message}
            {Object.keys(event.payload).length > 0
              ? ` (${JSON.stringify(event.payload)})`
              : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
