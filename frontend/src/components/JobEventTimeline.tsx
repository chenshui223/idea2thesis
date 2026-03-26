import type { JobEvent } from "../types";

type JobEventTimelineProps = {
  events: JobEvent[];
};

function formatEventLabel(kind: string) {
  return kind.replaceAll("_", " ");
}

export function JobEventTimeline(props: JobEventTimelineProps) {
  const latestEvent =
    props.events.length > 0 ? props.events[props.events.length - 1] : null;

  return (
    <section>
      <h2>Job Events</h2>
      <p>Event count: {props.events.length}</p>
      <p>
        Latest event: {latestEvent ? formatEventLabel(latestEvent.kind) : "none"}
      </p>
      {props.events.length === 0 ? (
        <p>No events recorded for this job yet.</p>
      ) : (
        <ul>
          {props.events.map((event) => (
            <li key={event.id}>
              <p>{event.timestamp}</p>
              <p>{event.kind}</p>
              <p>{event.message}</p>
              {Object.entries(event.payload).map(([key, value]) => (
                <p key={`${event.id}-${key}`}>
                  {key}: {String(value)}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
