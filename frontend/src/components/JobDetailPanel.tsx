import {
  formatStageValue,
  formatStatusValue,
  useLocale
} from "../i18n";
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

function buildRepairGuidance(
  locale: "zh" | "en",
  job: JobDetail
): RepairGuidance | null {
  if (job.status === "blocked") {
    return {
      summary:
        locale === "zh"
          ? "当前任务已阻塞，交付前需要人工修复。"
          : "This job is blocked and needs manual repair before delivery.",
      instruction:
        locale === "zh"
          ? "请先检查已生成产物、修复报告中的问题，再重新运行任务。"
          : "Review the generated artifacts, fix the reported issues, and rerun the job.",
      issue: job.error_message || null
    };
  }

  if (job.status === "failed") {
    return {
      summary:
        locale === "zh"
          ? "当前任务在产出可交付结果前已经失败。"
          : "This job failed before it could produce a deliverable result.",
      instruction:
        locale === "zh"
          ? "请检查失败详情，确认运行时配置或生成代码无误后重新运行。"
          : "Inspect the failure details, verify runtime settings or generated code, and rerun the job.",
      issue: job.error_message || null
    };
  }

  if (job.status === "interrupted") {
    return {
      summary:
        locale === "zh"
          ? "当前任务在流程完成前被中断。"
          : "This job was interrupted before the workflow finished.",
      instruction:
        locale === "zh"
          ? "请先确认最后完成的阶段和本地环境状态，再重新运行任务。"
          : "Check the last completed stage, confirm the environment is ready, and rerun the job.",
      issue: job.error_message || null
    };
  }

  return null;
}

export function JobDetailPanel(props: JobDetailPanelProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const job = props.job;
  const canDelete =
    job &&
    ["completed", "failed", "blocked", "interrupted"].includes(job.status);
  const repairGuidance = job ? buildRepairGuidance(locale, job) : null;
  const showDeleteHint = Boolean(job) && !canDelete;

  return (
    <section>
      <h2>{isZh ? "任务详情" : "Job Detail"}</h2>
      {job ? (
        <>
          <p>{isZh ? `当前任务：${job.job_id}` : `Current job: ${job.job_id}`}</p>
          <p>{isZh ? `标题：${job.brief_title}` : `Title: ${job.brief_title}`}</p>
          <p>{isZh ? `状态：${formatStatusValue(locale, job.status)}` : `Status: ${job.status}`}</p>
          <p>{isZh ? `阶段：${formatStageValue(locale, job.stage)}` : `Stage: ${job.stage}`}</p>
          <p>
            {isZh
              ? `最终结论：${formatStatusValue(locale, job.final_disposition)}`
              : `Final disposition: ${job.final_disposition}`}
          </p>
          <p>
            {isZh
              ? `校验状态：${formatStatusValue(locale, job.validation_state)}`
              : `Validation state: ${job.validation_state}`}
          </p>
          <p>{isZh ? `创建时间：${job.created_at}` : `Created at: ${job.created_at}`}</p>
          <p>{isZh ? `更新时间：${job.updated_at}` : `Updated at: ${job.updated_at}`}</p>
          {job.started_at ? (
            <p>{isZh ? `开始时间：${job.started_at}` : `Started at: ${job.started_at}`}</p>
          ) : null}
          {job.finished_at ? (
            <p>{isZh ? `结束时间：${job.finished_at}` : `Finished at: ${job.finished_at}`}</p>
          ) : null}
          {repairGuidance ? (
            <section aria-label="repair-guidance">
              <h3>{isZh ? "下一步建议" : "Recommended Next Steps"}</h3>
              <p>{repairGuidance.summary}</p>
              <p>{repairGuidance.instruction}</p>
              {repairGuidance.issue ? (
                <p>
                  {isZh
                    ? `报告问题：${repairGuidance.issue}`
                    : `Reported issue: ${repairGuidance.issue}`}
                </p>
              ) : null}
            </section>
          ) : null}
          {job.deleted_at ? (
            <p>{isZh ? `删除时间：${job.deleted_at}` : `Deleted at: ${job.deleted_at}`}</p>
          ) : null}
          <p>{isZh ? `工作区：${job.workspace_path}` : `Workspace: ${job.workspace_path}`}</p>
          <p>{isZh ? `输入文件：${job.input_file_path}` : `Input file: ${job.input_file_path}`}</p>
          <p>
            {isZh
              ? `来源任务：${job.source_job_id ?? "无"}`
              : `Source job: ${job.source_job_id ?? "none"}`}
          </p>
          <p>
            {isZh
              ? `运行预设模型：${job.runtime_preset.global.model}`
              : `Runtime preset model: ${job.runtime_preset.global.model}`}
          </p>
          <p>
            {isZh
              ? `运行预设 Base URL：${job.runtime_preset.global.base_url}`
              : `Runtime preset base URL: ${job.runtime_preset.global.base_url}`}
          </p>
          {props.workspaceArchiveError ? <p>{props.workspaceArchiveError}</p> : null}
          <button
            type="button"
            onClick={props.onDownloadWorkspaceArchive}
            disabled={props.workspaceArchiveBusy}
          >
            {isZh ? "下载工作区 ZIP" : "Download Workspace ZIP"}
          </button>
          <button type="button" onClick={props.onRerun}>
            {isZh ? "重新运行" : "Rerun"}
          </button>
          <button type="button" onClick={props.onDelete} disabled={!canDelete}>
            {isZh ? "删除" : "Delete"}
          </button>
          <section aria-label="job-actions-guidance">
            {showDeleteHint ? (
              <p>
                {isZh
                  ? "任务进入终态后才允许删除。"
                  : "Delete becomes available after the job reaches a terminal status."}
              </p>
            ) : null}
            <p>
              {isZh
                ? "重新运行会复用同一份设计书和非敏感运行配置。开始前请重新输入新的 API Key。"
                : "Rerun reuses the same brief and non-sensitive runtime settings. Enter fresh API keys before starting."}
            </p>
          </section>
        </>
      ) : (
        <p>{isZh ? "尚未选择任务。" : "No job selected."}</p>
      )}
    </section>
  );
}
