import type { JobDetail, HistoryListItem } from "../types";

type JobDetailPanelProps = {
  job: JobDetail | null;
  selectedHistoryItem: HistoryListItem | null;
  onRerun: () => void;
  onDelete: () => void;
  onDownloadWorkspaceArchive: () => void;
  workspaceArchiveBusy: boolean;
  workspaceArchiveError: string;
};

type RepairGuidance = {
  summary: string;
  instruction: string;
  issue: string | null;
};

function buildRepairGuidance(job: JobDetail): RepairGuidance | null {
  if (job.status === "blocked") {
    return {
      summary: "This job is blocked and needs manual repair before delivery.",
      instruction:
        "Review the generated artifacts, fix the reported issues, and rerun the job.",
      issue: job.error_message || null
    };
  }

  if (job.status === "failed") {
    return {
      summary: "This job failed before it could produce a deliverable result.",
      instruction:
        "Inspect the failure details, verify runtime settings or generated code, and rerun the job.",
      issue: job.error_message || null
    };
  }

  if (job.status === "interrupted") {
    return {
      summary: "This job was interrupted before the workflow finished.",
      instruction:
        "Check the last completed stage, confirm the environment is ready, and rerun the job.",
      issue: job.error_message || null
    };
  }

  return null;
}

export function JobDetailPanel(props: JobDetailPanelProps) {
  const job = props.job;
  const canDelete =
    job &&
    ["completed", "failed", "blocked", "interrupted"].includes(job.status);
  const repairGuidance = job ? buildRepairGuidance(job) : null;

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
          <p>Created at: {job.created_at}</p>
          <p>Updated at: {job.updated_at}</p>
          {job.started_at ? <p>Started at: {job.started_at}</p> : null}
          {job.finished_at ? <p>Finished at: {job.finished_at}</p> : null}
          {repairGuidance ? (
            <section aria-label="repair-guidance">
              <h3>Recommended Next Steps</h3>
              <p>{repairGuidance.summary}</p>
              <p>{repairGuidance.instruction}</p>
              {repairGuidance.issue ? (
                <p>Reported issue: {repairGuidance.issue}</p>
              ) : null}
            </section>
          ) : null}
          {job.deleted_at ? <p>Deleted at: {job.deleted_at}</p> : null}
          <p>Workspace: {job.workspace_path}</p>
          <p>Input file: {job.input_file_path}</p>
          <p>Source job: {job.source_job_id ?? "none"}</p>
          <p>Runtime preset model: {job.runtime_preset.global.model}</p>
          <p>Runtime preset base URL: {job.runtime_preset.global.base_url}</p>
          {props.workspaceArchiveError ? <p>{props.workspaceArchiveError}</p> : null}
          <button
            type="button"
            onClick={props.onDownloadWorkspaceArchive}
            disabled={props.workspaceArchiveBusy}
          >
            Download Workspace ZIP
          </button>
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
