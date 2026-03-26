import type { AgentStatus } from "../types";

type AgentBoardProps = {
  agents: AgentStatus[];
};

function describeAgentOutcome(status: string) {
  if (status === "failed") {
    return "Failed";
  }
  if (status === "blocked") {
    return "Needs Repair";
  }
  if (status === "running") {
    return "In Progress";
  }
  if (status === "pending") {
    return "Queued";
  }
  return "Completed";
}

export function AgentBoard(props: AgentBoardProps) {
  const completedCount = props.agents.filter((agent) => agent.status === "done").length;
  const repairCount = props.agents.filter((agent) => agent.status === "blocked").length;
  const failedCount = props.agents.filter((agent) => agent.status === "failed").length;

  return (
    <section>
      <h2>Agent Status</h2>
      <p>Completed agents: {completedCount}</p>
      <p>Needs repair: {repairCount}</p>
      <p>Failed agents: {failedCount}</p>
      <ul>
        {props.agents.map((agent) => (
          <li key={agent.role}>
            <strong>{agent.role}</strong>
            {" - "}
            {describeAgentOutcome(agent.status)}
            {": "}
            {agent.summary || agent.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
