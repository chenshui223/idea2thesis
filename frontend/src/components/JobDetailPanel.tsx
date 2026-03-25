import type { JobDetail, HistoryListItem } from "../types";

type JobDetailPanelProps = {
  job: JobDetail | null;
  selectedHistoryItem: HistoryListItem | null;
  onRerun: () => void;
  onDelete: () => void;
};

export function JobDetailPanel(props: JobDetailPanelProps) {
  const job = props.job;
  const canDelete =
    job &&
    ["completed", "failed", "blocked", "interrupted"].includes(job.status);

  return (
    <section>
      <h2>Job Detail</h2>
      {job ? (
        <>
          <p>Current job: {job.job_id}</p>
          <p>Title: {job.brief_title}</p>
          <p>Status: {job.status}</p>
          <p>Stage: {job.stage}</p>
          <p>Final disposition: {job.final_disposition}</p>
          <p>Validation state: {job.validation_state}</p>
          {job.deleted_at ? <p>Deleted at: {job.deleted_at}</p> : null}
          <p>Workspace: {job.workspace_path}</p>
          <p>Input file: {job.input_file_path}</p>
          <p>Source job: {job.source_job_id ?? "none"}</p>
          <p>Runtime preset model: {job.runtime_preset.global.model}</p>
          <p>Runtime preset base URL: {job.runtime_preset.global.base_url}</p>
          <button type="button" onClick={props.onRerun}>
            Rerun
          </button>
          <button type="button" onClick={props.onDelete} disabled={!canDelete}>
            Delete
          </button>
        </>
      ) : (
        <p>No job selected.</p>
      )}
    </section>
  );
}
