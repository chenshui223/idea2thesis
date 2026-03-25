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
              <td>{item.brief_title}</td>
              <td>{item.status}</td>
              <td>{item.stage}</td>
              <td>{item.updated_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
