import { formatStatusValue, useLocale } from "../i18n";
import type { ArtifactRef } from "../types";

type ValidationReportViewerProps = {
  validationState: string;
  disposition: string;
  artifacts: ArtifactRef[];
};

function buildValidationSummary(
  locale: "zh" | "en",
  validationState: string,
  disposition: string
) {
  if (validationState === "completed" && disposition === "completed") {
    return locale === "zh"
      ? "校验已经完成，当前交付物可以进入交付。"
      : "Validation completed and the deliverable is ready.";
  }

  if (validationState === "blocked" || disposition === "blocked") {
    return locale === "zh"
      ? "校验已阻塞，需要先进行人工修复。"
      : "Validation is blocked and manual repair is required.";
  }

  if (validationState === "interrupted" || disposition === "interrupted") {
    return locale === "zh"
      ? "校验在交付物完成验证前被中断。"
      : "Validation was interrupted before the deliverable could be verified.";
  }

  if (disposition === "failed") {
    return locale === "zh"
      ? "校验结束，但最终交付结果失败。"
      : "Validation finished with a failed delivery outcome.";
  }

  if (validationState === "running") {
    return locale === "zh"
      ? "当前选中任务仍在进行校验。"
      : "Validation is still running for the selected job.";
  }

  return locale === "zh"
    ? "当前选中任务的校验尚未结束。"
    : "Validation has not finished yet for the selected job.";
}

function buildRecommendedAction(
  locale: "zh" | "en",
  validationState: string,
  disposition: string
) {
  if (validationState === "completed" && disposition === "completed") {
    return locale === "zh"
      ? "检查产物、预览 Word 初稿，并在确认后导出工作区 ZIP。"
      : "Review artifacts, preview the Word draft, and export the workspace ZIP.";
  }

  if (validationState === "blocked" || disposition === "blocked") {
    return locale === "zh"
      ? "先检查审评结果并修复生成文件，再使用新的 API Key 重新运行。"
      : "Inspect reviewer output, repair the generated files, and rerun with a fresh API key.";
  }

  if (validationState === "interrupted" || disposition === "interrupted") {
    return locale === "zh"
      ? "确认本地 worker 可用后，再使用新的 API Key 重新运行任务。"
      : "Confirm the local worker is available, then rerun the job with a fresh API key.";
  }

  if (disposition === "failed" || validationState === "failed") {
    return locale === "zh"
      ? "请打开最新校验产物，修复生成代码后再重新运行。"
      : "Open the latest verification artifacts and fix the generated code before rerunning.";
  }

  if (validationState === "running") {
    return locale === "zh"
      ? "等待 worker 完成当前阶段，页面会自动刷新选中任务。"
      : "Wait for the worker to finish the current stage. The selected job refreshes automatically.";
  }

  return locale === "zh"
    ? "保持当前页面开启，后台 worker 会自动拾取排队中的任务。"
    : "Keep this page open. The worker will pick up the queued job automatically.";
}

function buildConfidenceSummary(
  locale: "zh" | "en",
  validationState: string,
  disposition: string
) {
  if (validationState === "completed" && disposition === "completed") {
    return locale === "zh" ? "可交付" : "Ready to deliver";
  }
  if (validationState === "blocked" || disposition === "blocked") {
    return locale === "zh" ? "交付受阻" : "Delivery blocked";
  }
  if (validationState === "interrupted" || disposition === "interrupted") {
    return locale === "zh" ? "交付已中断" : "Delivery interrupted";
  }
  if (validationState === "failed" || disposition === "failed") {
    return locale === "zh" ? "交付未通过校验" : "Delivery failed validation";
  }
  if (validationState === "running") {
    return locale === "zh" ? "仍在收集证据" : "Evidence still being collected";
  }
  return locale === "zh" ? "等待证据" : "Evidence pending";
}

function buildEvidenceList(locale: "zh" | "en", artifacts: ArtifactRef[]) {
  const labels: string[] = [];
  const kinds = new Set(artifacts.map((artifact) => artifact.kind));

  if (kinds.has("job_manifest")) {
    labels.push(locale === "zh" ? "任务清单" : "Job manifest");
  }
  if (kinds.has("code_eval")) {
    labels.push(locale === "zh" ? "代码校验产物" : "Code verification artifact");
  }
  if (kinds.has("doc_check")) {
    labels.push(locale === "zh" ? "文档检查产物" : "Document check artifact");
  }
  if (kinds.has("thesis_draft_docx")) {
    labels.push(locale === "zh" ? "Word 论文初稿" : "Word thesis draft");
  }

  return labels;
}

export function ValidationReportViewer(props: ValidationReportViewerProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const summary = buildValidationSummary(
    locale,
    props.validationState,
    props.disposition
  );
  const recommendedAction = buildRecommendedAction(
    locale,
    props.validationState,
    props.disposition
  );
  const confidenceSummary = buildConfidenceSummary(
    locale,
    props.validationState,
    props.disposition
  );
  const evidenceList = buildEvidenceList(locale, props.artifacts);

  return (
    <section>
      <h2>{isZh ? "校验报告" : "Validation Report"}</h2>
      <p>{isZh ? `校验摘要：${summary}` : `Validation summary: ${summary}`}</p>
      <h3>{isZh ? "交付置信度" : "Delivery Confidence"}</h3>
      <p>{isZh ? `置信度摘要：${confidenceSummary}` : `Confidence summary: ${confidenceSummary}`}</p>
      <p>{isZh ? `证据数量：${evidenceList.length}` : `Evidence count: ${evidenceList.length}`}</p>
      {evidenceList.length > 0 ? (
        <ul>
          {evidenceList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{isZh ? "暂未记录任何交付证据。" : "No delivery evidence recorded yet."}</p>
      )}
      <p>{isZh ? `建议操作：${recommendedAction}` : `Recommended action: ${recommendedAction}`}</p>
      <p>
        {isZh
          ? `校验状态：${formatStatusValue(locale, props.validationState)}`
          : `Validation state: ${props.validationState}`}
      </p>
      <p>
        {isZh
          ? `最终结论：${formatStatusValue(locale, props.disposition)}`
          : `Final disposition: ${props.disposition}`}
      </p>
    </section>
  );
}
