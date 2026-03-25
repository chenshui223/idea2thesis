import type { AgentRole, AgentSettings } from "../types";

const AGENT_LABELS: Record<AgentRole, string> = {
  advisor: "Advisor",
  coder: "Coder",
  writer: "Writer",
  requirements_reviewer: "Requirements Reviewer",
  engineering_reviewer: "Engineering Reviewer",
  delivery_reviewer: "Delivery Reviewer",
  code_eval: "Code Eval",
  doc_check: "Doc Check"
};

type AgentConfigPanelProps = {
  agents: Record<AgentRole, AgentSettings>;
  onAgentChange: (
    role: AgentRole,
    patch: Partial<AgentSettings>
  ) => void;
};

export function AgentConfigPanel(props: AgentConfigPanelProps) {
  return (
    <section>
      <h2>Agent Overrides</h2>
      {Object.entries(props.agents).map(([role, settings]) => {
        const typedRole = role as AgentRole;
        const label = AGENT_LABELS[typedRole];
        return (
          <fieldset key={role}>
            <legend>{label}</legend>
            <label>
              <input
                type="checkbox"
                checked={settings.useGlobal}
                onChange={(event) =>
                  props.onAgentChange(typedRole, {
                    useGlobal: event.target.checked
                  })
                }
              />
              Use global settings
            </label>
            <label>
              {label} API Key
              <input
                aria-label={`${label} API Key`}
                value={settings.apiKey}
                disabled={settings.useGlobal}
                onChange={(event) =>
                  props.onAgentChange(typedRole, {
                    apiKey: event.target.value
                  })
                }
              />
            </label>
            <label>
              {label} Base URL
              <input
                aria-label={`${label} Base URL`}
                value={settings.baseUrl}
                disabled={settings.useGlobal}
                onChange={(event) =>
                  props.onAgentChange(typedRole, {
                    baseUrl: event.target.value
                  })
                }
              />
            </label>
            <label>
              {label} Model
              <input
                aria-label={`${label} Model`}
                value={settings.model}
                disabled={settings.useGlobal}
                onChange={(event) =>
                  props.onAgentChange(typedRole, {
                    model: event.target.value
                  })
                }
              />
            </label>
          </fieldset>
        );
      })}
    </section>
  );
}
