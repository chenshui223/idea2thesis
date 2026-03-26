import { useLocale } from "../i18n";

type QuickStartPanelProps = {
  selectedFileName: string;
};

export function QuickStartPanel(props: QuickStartPanelProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  return (
    <section className="quick-start-panel">
      <div className="quick-start-header">
        <p className="eyebrow">
          {isZh ? "本地单用户流程" : "local single-user workflow"}
        </p>
        <h2>{isZh ? "快速开始" : "Quick Start"}</h2>
        <p className="quick-start-summary">
          {isZh
            ? "填好一套 API 配置，选择一份 `.docx` 设计书，本地多 Agent 流水线就会自动生成代码、项目文档和论文初稿。"
            : "Fill in one API configuration, choose a `.docx` brief, and let the local multi-agent pipeline generate code, documents, and a thesis first draft."}
        </p>
      </div>
      <div className="quick-start-meta">
        <p>{isZh ? "API Key 不会被保存。" : "API Key is never saved."}</p>
        <p>
          {isZh
            ? "Base URL 和模型配置会在刷新后自动恢复。"
            : "Base URL and model are restored on reload."}
        </p>
        <p>
          {props.selectedFileName
            ? isZh
              ? `已选择设计书：${props.selectedFileName}`
              : `Selected brief: ${props.selectedFileName}`
            : isZh
              ? "暂未选择设计书。"
              : "No brief selected yet."}
        </p>
      </div>
      <ol className="quick-start-steps">
        <li>
          {isZh
            ? "先填写全局 API Key、Base URL 和模型。"
            : "Enter your global API Key, Base URL, and Model."}
        </li>
        <li>
          {isZh
            ? "下载示例设计书，或上传你自己的设计书。"
            : "Download the sample brief or upload your own design brief."}
        </li>
        <li>
          {isZh
            ? "点击“生成项目”，并在历史工作台查看进度。"
            : "Click Generate Project and monitor progress in History Workbench."}
        </li>
      </ol>
    </section>
  );
}
