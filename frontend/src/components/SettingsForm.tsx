import { useLocale } from "../i18n";

type ThesisCoverFormValue = {
  school: string;
  department: string;
  major: string;
  studentName: string;
  studentId: string;
  advisor: string;
};

type SettingsFormProps = {
  apiKey: string;
  baseUrl: string;
  model: string;
  thesisCover: ThesisCoverFormValue;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onThesisCoverChange: (patch: Partial<ThesisCoverFormValue>) => void;
  onResetThesisCover: () => void;
};

export function SettingsForm(props: SettingsFormProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  return (
    <section className="settings-panel">
      <h2>{isZh ? "模型设置" : "Model Settings"}</h2>
      <p className="section-summary">
        {isZh
          ? "默认整条流水线共用一套端点配置，只有在个别 Agent 需要不同模型或接口时再单独覆盖。"
          : "Use one shared endpoint for the full pipeline, then override individual agents only when needed."}
      </p>
      <label className="field">
        {isZh ? "API Key" : "API Key"}
        <input
          aria-label={isZh ? "API Key" : "API Key"}
          type="password"
          value={props.apiKey}
          onChange={(event) => props.onApiKeyChange(event.target.value)}
        />
      </label>
      <label className="field">
        {isZh ? "Base URL" : "Base URL"}
        <input
          aria-label={isZh ? "Base URL" : "Base URL"}
          value={props.baseUrl}
          onChange={(event) => props.onBaseUrlChange(event.target.value)}
        />
      </label>
      <label className="field">
        {isZh ? "模型" : "Model"}
        <input
          aria-label={isZh ? "模型" : "Model"}
          value={props.model}
          onChange={(event) => props.onModelChange(event.target.value)}
        />
      </label>
      <section aria-labelledby="thesis-cover-heading" className="thesis-cover-panel">
        <div className="section-header-row">
          <h3 id="thesis-cover-heading">{isZh ? "论文封面信息" : "Thesis Cover"}</h3>
          <button type="button" onClick={props.onResetThesisCover}>
            {isZh ? "重置封面信息" : "Reset Thesis Cover"}
          </button>
        </div>
        <div className="cover-grid">
        <label className="field">
          {isZh ? "学校" : "School"}
          <input
            aria-label={isZh ? "学校" : "School"}
            value={props.thesisCover.school}
            onChange={(event) =>
              props.onThesisCoverChange({ school: event.target.value })
            }
          />
        </label>
        <label className="field">
          {isZh ? "学院" : "Department"}
          <input
            aria-label={isZh ? "学院" : "Department"}
            value={props.thesisCover.department}
            onChange={(event) =>
              props.onThesisCoverChange({ department: event.target.value })
            }
          />
        </label>
        <label className="field">
          {isZh ? "专业" : "Major"}
          <input
            aria-label={isZh ? "专业" : "Major"}
            value={props.thesisCover.major}
            onChange={(event) =>
              props.onThesisCoverChange({ major: event.target.value })
            }
          />
        </label>
        <label className="field">
          {isZh ? "学生姓名" : "Student Name"}
          <input
            aria-label={isZh ? "学生姓名" : "Student Name"}
            value={props.thesisCover.studentName}
            onChange={(event) =>
              props.onThesisCoverChange({ studentName: event.target.value })
            }
          />
        </label>
        <label className="field">
          {isZh ? "学号" : "Student ID"}
          <input
            aria-label={isZh ? "学号" : "Student ID"}
            value={props.thesisCover.studentId}
            onChange={(event) =>
              props.onThesisCoverChange({ studentId: event.target.value })
            }
          />
        </label>
        <label className="field">
          {isZh ? "指导老师" : "Advisor"}
          <input
            aria-label={isZh ? "指导老师" : "Advisor"}
            value={props.thesisCover.advisor}
            onChange={(event) =>
              props.onThesisCoverChange({ advisor: event.target.value })
            }
          />
        </label>
        </div>
      </section>
    </section>
  );
}
