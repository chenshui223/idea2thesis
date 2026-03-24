import type { AgentStatus } from "../types";

type AgentBoardProps = {
  agents: AgentStatus[];
};

export function AgentBoard(props: AgentBoardProps) {
  return (
    <section>
      <h2>Agent Status</h2>
      <ul>
        {props.agents.map((agent) => (
          <li key={agent.role}>
            {agent.role}: {agent.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
