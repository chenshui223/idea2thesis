import {
  formatSortValue,
  formatStageValue,
  formatStatusValue,
  useLocale
} from "../i18n";
import type { HistoryListItem, JobListQuery } from "../types";

type HistoryListProps = {
  items: HistoryListItem[];
  total: number;
  query: JobListQuery;
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  onQueryChange: (patch: Partial<JobListQuery>) => void;
};

const STATUS_OPTIONS = [
  "all",
  "pending",
  "running",
  "completed",
  "failed",
  "blocked",
  "interrupted",
  "deleted"
];
const SORT_OPTIONS = ["updated_desc", "created_desc", "created_asc"];

function describeHistorySignal(locale: "zh" | "en", status: string) {
  if (status === "completed") {
    return locale === "zh" ? "可交付" : "Ready";
  }
  if (status === "failed" || status === "blocked") {
    return locale === "zh" ? "需要修复" : "Repair Needed";
  }
  if (status === "interrupted") {
    return locale === "zh" ? "已中断" : "Interrupted";
  }
  if (status === "deleted") {
    return locale === "zh" ? "已归档" : "Archived";
  }
  return locale === "zh" ? "进行中" : "In Progress";
}

function describeDeliverySignal(
  locale: "zh" | "en",
  status: string,
  finalDisposition: string
) {
  if (status === "deleted") {
    return locale === "zh" ? "已归档" : "Archived";
  }
  if (finalDisposition === "completed") {
    return locale === "zh" ? "可直接交付" : "Ready to deliver";
  }
  if (finalDisposition === "blocked" || finalDisposition === "failed") {
    return locale === "zh" ? "需要修复后再交付" : "Repair required";
  }
  if (status === "interrupted" || finalDisposition === "interrupted") {
    return locale === "zh" ? "需要重新运行" : "Rerun required";
  }
  return locale === "zh" ? "等待校验证据" : "Evidence pending";
}

export function HistoryList(props: HistoryListProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const hasActiveFilters =
    props.query.search.trim().length > 0 || props.query.status !== "all";
  const filteredItems = props.items.filter((item) => {
    const matchesSearch = props.query.search
      ? `${item.brief_title} ${item.job_id} ${item.status} ${item.stage}`
          .toLowerCase()
          .includes(props.query.search.toLowerCase())
      : true;
    const matchesStatus =
      props.query.status === "all" ? true : item.status === props.query.status;
    return matchesSearch && matchesStatus;
  });
  const activeCount = filteredItems.filter((item) =>
    ["pending", "running"].includes(item.status)
  ).length;
  const repairCount = filteredItems.filter((item) =>
    ["failed", "blocked"].includes(item.status)
  ).length;
  const deletedCount = filteredItems.filter((item) => item.status === "deleted").length;

  return (
    <section>
      <h2>{isZh ? "历史记录" : "History List"}</h2>
      <label>
        {isZh ? "搜索任务" : "Search jobs"}
        <input
          aria-label={isZh ? "搜索任务" : "Search jobs"}
          value={props.query.search}
          onChange={(event) => props.onQueryChange({ search: event.target.value })}
        />
      </label>
      <label>
        {isZh ? "状态筛选" : "Status filter"}
        <select
          aria-label={isZh ? "状态筛选" : "Status filter"}
          value={props.query.status}
          onChange={(event) => props.onQueryChange({ status: event.target.value })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatStatusValue(locale, option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {isZh ? "排序" : "Sort"}
        <select
          aria-label={isZh ? "排序" : "Sort jobs"}
          value={props.query.sort}
          onChange={(event) => props.onQueryChange({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatSortValue(locale, option)}
            </option>
          ))}
        </select>
      </label>
      <p>{isZh ? `任务总数：${props.total}` : `Total jobs: ${props.total}`}</p>
      <section aria-label={isZh ? "历史概览" : "history-overview"}>
        <p>{isZh ? `当前可见：${filteredItems.length}` : `Visible jobs: ${filteredItems.length}`}</p>
        <p>{isZh ? `运行中任务：${activeCount}` : `Active jobs: ${activeCount}`}</p>
        <p>{isZh ? `待修复：${repairCount}` : `Needs repair: ${repairCount}`}</p>
        <p>{isZh ? `已删除任务：${deletedCount}` : `Deleted jobs: ${deletedCount}`}</p>
      </section>
      {props.total === 0 && !hasActiveFilters ? (
        <section>
          <h3>{isZh ? "还没有任务。" : "No jobs yet."}</h3>
          <p>
            {isZh
              ? "先下载示例设计书，或上传你自己的 .docx 设计书。"
              : "Start with a sample brief or upload your own .docx design brief."}
          </p>
          <p>{isZh ? "1. 下载示例设计书" : "1. Download Sample Brief"}</p>
          <p>{isZh ? "2. 填写 API Key、Base URL 和模型" : "2. Enter API Key, Base URL, and Model"}</p>
          <p>{isZh ? "3. 点击生成项目" : "3. Click Generate Project"}</p>
        </section>
      ) : filteredItems.length === 0 ? (
        <section>
          <p>
            {isZh
              ? "当前搜索词或状态筛选下没有匹配任务。"
              : "No jobs match the current search or status filter."}
          </p>
          {props.query.search.trim() ? (
            <p>
              {isZh
                ? `当前搜索词：“${props.query.search.trim()}”`
                : `Current search: "${props.query.search.trim()}"`}
            </p>
          ) : null}
          {props.query.status !== "all" ? (
            <p>
              {isZh
                ? `当前状态筛选：${formatStatusValue(locale, props.query.status)}`
                : `Current status filter: ${props.query.status}`}
            </p>
          ) : null}
        </section>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>{isZh ? "标题" : "Title"}</th>
            <th>{isZh ? "状态" : "Status"}</th>
            <th>{isZh ? "阶段" : "Stage"}</th>
            <th>{isZh ? "更新时间" : "Updated"}</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr
              key={item.job_id}
              role="row"
              aria-selected={props.selectedJobId === item.job_id}
              onClick={() => props.onSelectJob(item.job_id)}
            >
              <td>
                <div>{item.brief_title}</div>
                <div>{item.job_id}</div>
                {item.source_job_id ? (
                  <div>
                    {isZh
                      ? `由 ${item.source_job_id} 重新运行`
                      : `Rerun from ${item.source_job_id}`}
                  </div>
                ) : null}
              </td>
              <td>
                <strong>{formatStatusValue(locale, item.status)}</strong>
                <div>{describeHistorySignal(locale, item.status)}</div>
                <div>{describeDeliverySignal(locale, item.status, item.final_disposition)}</div>
              </td>
              <td>{formatStageValue(locale, item.stage)}</td>
              <td>{item.updated_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
