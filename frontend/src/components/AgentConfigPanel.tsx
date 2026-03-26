import { formatAgentRole, useLocale } from "../i18n";
import type { AgentRole, AgentSettings } from "../types";

type AgentConfigPanelProps = {
  agents: Record<AgentRole, AgentSettings>;
  onAgentChange: (
    role: AgentRole,
    patch: Partial<AgentSettings>
  ) => void;
};

export function AgentConfigPanel(props: AgentConfigPanelProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  return (
    <section>
      <h2>{isZh ? "Agent 单独覆盖" : "Agent Overrides"}</h2>
      {Object.entries(props.agents).map(([role, settings]) => {
        const typedRole = role as AgentRole;
        const label = formatAgentRole(locale, typedRole);
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
              {isZh ? "使用全局设置" : "Use global settings"}
            </label>
            <label>
              {isZh ? `${label} API Key` : `${label} API Key`}
              <input
                aria-label={isZh ? `${label} API Key` : `${label} API Key`}
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
              {isZh ? `${label} Base URL` : `${label} Base URL`}
              <input
                aria-label={isZh ? `${label} Base URL` : `${label} Base URL`}
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
              {isZh ? `${label} 模型` : `${label} Model`}
              <input
                aria-label={isZh ? `${label} 模型` : `${label} Model`}
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
