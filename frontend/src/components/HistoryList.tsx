import type { HistoryListItem, JobListQuery } from "../types";

type HistoryListProps = {
  items: HistoryListItem[];
  total: number;
  query: JobListQuery;
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  onQueryChange: (patch: Partial<JobListQuery>) => void;
};

const STATUS_OPTIONS = ["all", "pending", "running", "completed", "failed", "blocked", "deleted"];
const SORT_OPTIONS = ["updated_desc", "created_desc", "created_asc"];

function describeHistorySignal(status: string) {
  if (status === "completed") {
    return "Ready";
  }
  if (status === "failed" || status === "blocked") {
    return "Repair Needed";
  }
  if (status === "deleted") {
    return "Archived";
  }
  return "In Progress";
}

export function HistoryList(props: HistoryListProps) {
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
      <h2>History List</h2>
      <label>
        Search jobs
        <input
          aria-label="Search jobs"
          value={props.query.search}
          onChange={(event) => props.onQueryChange({ search: event.target.value })}
        />
      </label>
      <label>
        Status filter
        <select
          aria-label="Status filter"
          value={props.query.status}
          onChange={(event) => props.onQueryChange({ status: event.target.value })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select
          aria-label="Sort jobs"
          value={props.query.sort}
          onChange={(event) => props.onQueryChange({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <p>Total jobs: {props.total}</p>
      <section aria-label="history-overview">
        <p>Visible jobs: {filteredItems.length}</p>
        <p>Active jobs: {activeCount}</p>
        <p>Needs repair: {repairCount}</p>
        <p>Deleted jobs: {deletedCount}</p>
      </section>
      {props.total === 0 ? (
        <section>
          <h3>No jobs yet.</h3>
          <p>Start with a sample brief or upload your own .docx design brief.</p>
          <p>1. Download Sample Brief</p>
          <p>2. Enter API Key, Base URL, and Model</p>
          <p>3. Click Generate Project</p>
        </section>
      ) : filteredItems.length === 0 ? (
        <p>No jobs match the current search or status filter.</p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Updated</th>
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
              </td>
              <td>
                <strong>{item.status}</strong>
                <div>{describeHistorySignal(item.status)}</div>
              </td>
              <td>{item.stage}</td>
              <td>{item.updated_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
