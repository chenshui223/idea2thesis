import { formatEventKind, useLocale } from "../i18n";
import type { JobEvent } from "../types";

type JobEventTimelineProps = {
  events: JobEvent[];
};

export function JobEventTimeline(props: JobEventTimelineProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const latestEvent =
    props.events.length > 0 ? props.events[props.events.length - 1] : null;

  return (
    <section>
      <h2>{isZh ? "任务事件" : "Job Events"}</h2>
      <p>{isZh ? `事件数量：${props.events.length}` : `Event count: ${props.events.length}`}</p>
      <p>
        {isZh ? "最新事件：" : "Latest event: "}
        {latestEvent ? formatEventKind(locale, latestEvent.kind) : isZh ? "无" : "none"}
      </p>
      {props.events.length === 0 ? (
        <p>{isZh ? "当前任务还没有记录任何事件。" : "No events recorded for this job yet."}</p>
      ) : (
        <ul>
          {props.events.map((event) => (
            <li key={event.id}>
              <p>{event.timestamp}</p>
              <p>{formatEventKind(locale, event.kind)}</p>
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
