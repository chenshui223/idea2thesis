import { formatAgentRole, useLocale } from "../i18n";
import type { AgentStatus } from "../types";

type AgentBoardProps = {
  agents: AgentStatus[];
};

function describeAgentOutcome(locale: "zh" | "en", status: string) {
  if (status === "failed") {
    return locale === "zh" ? "失败" : "Failed";
  }
  if (status === "blocked") {
    return locale === "zh" ? "待修复" : "Needs Repair";
  }
  if (status === "running") {
    return locale === "zh" ? "进行中" : "In Progress";
  }
  if (status === "pending") {
    return locale === "zh" ? "排队中" : "Queued";
  }
  return locale === "zh" ? "已完成" : "Completed";
}

export function AgentBoard(props: AgentBoardProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const completedCount = props.agents.filter((agent) => agent.status === "done").length;
  const repairCount = props.agents.filter((agent) => agent.status === "blocked").length;
  const failedCount = props.agents.filter((agent) => agent.status === "failed").length;

  return (
    <section>
      <h2>{isZh ? "Agent 状态" : "Agent Status"}</h2>
      <p>{isZh ? `已完成 Agent：${completedCount}` : `Completed agents: ${completedCount}`}</p>
      <p>{isZh ? `待修复：${repairCount}` : `Needs repair: ${repairCount}`}</p>
      <p>{isZh ? `失败 Agent：${failedCount}` : `Failed agents: ${failedCount}`}</p>
      <ul>
        {props.agents.map((agent) => (
          <li key={agent.role}>
            <strong>{formatAgentRole(locale, agent.role)}</strong>
            {" - "}
            {describeAgentOutcome(locale, agent.status)}
            {": "}
            {agent.summary || agent.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
