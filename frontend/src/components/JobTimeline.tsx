import { useLocale } from "../i18n";

type JobTimelineProps = {
  stage: string;
};

function describeStage(locale: "zh" | "en", stage: string) {
  if (stage === "idle") {
    return {
      current: locale === "zh" ? "空闲" : "Idle",
      label: locale === "zh" ? "空闲" : "Idle",
      guidance:
        locale === "zh"
          ? "等待你上传第一份 .docx 设计书。"
          : "Waiting for your first .docx brief."
    };
  }
  if (stage === "queued") {
    return {
      current: locale === "zh" ? "排队中" : "Queued",
      label: locale === "zh" ? "排队中" : "Queued",
      guidance:
        locale === "zh"
          ? "后端已经接收任务，本地 worker 会在下一步接管。"
          : "The backend accepted the job and the local worker will claim it next."
    };
  }
  if (stage === "advisor_running") {
    return {
      current: locale === "zh" ? "导师规划中" : "Advisor Planning",
      label: locale === "zh" ? "规划项目范围" : "Planning project scope",
      guidance:
        locale === "zh"
          ? "导师 Agent 正在分析设计书并定义交付范围。"
          : "The advisor agent is analyzing the brief and defining the delivery scope."
    };
  }
  if (stage === "coder_running") {
    return {
      current: locale === "zh" ? "代码生成中" : "Code Generation",
      label: locale === "zh" ? "生成可运行骨架" : "Generating the runnable scaffold",
      guidance:
        locale === "zh"
          ? "Coder Agent 正在生成可运行项目骨架和实现方案。"
          : "The coder agent is generating the runnable scaffold and implementation plan."
    };
  }
  if (stage === "writer_running") {
    return {
      current: locale === "zh" ? "文档撰写中" : "Document Drafting",
      label: locale === "zh" ? "撰写论文与项目文档" : "Drafting thesis and project documents",
      guidance:
        locale === "zh"
          ? "Writer Agent 正在撰写论文初稿和仓库文档。"
          : "The writer agent is drafting the thesis first draft and repository documents."
    };
  }
  if (stage === "advisor") {
    return {
      current: locale === "zh" ? "导师规划" : "Advisor",
      label: locale === "zh" ? "规划交付范围" : "Planning the delivery scope",
      guidance:
        locale === "zh"
          ? "导师 Agent 正在分析设计书并定义交付范围。"
          : "The advisor agent is analyzing the brief and defining the delivery scope."
    };
  }
  if (stage === "coder") {
    return {
      current: locale === "zh" ? "代码生成" : "Coder",
      label: locale === "zh" ? "生成可运行骨架" : "Generating the runnable scaffold",
      guidance:
        locale === "zh"
          ? "Coder Agent 正在生成可运行项目骨架和实现方案。"
          : "The coder agent is generating the runnable scaffold and implementation plan."
    };
  }
  if (stage === "writer") {
    return {
      current: locale === "zh" ? "文档撰写" : "Writer",
      label: locale === "zh" ? "撰写论文初稿" : "Writing the thesis draft",
      guidance:
        locale === "zh"
          ? "Writer Agent 正在撰写论文初稿和仓库文档。"
          : "The writer agent is drafting the thesis first draft and repository documents."
    };
  }
  if (stage === "review_running") {
    return {
      current: locale === "zh" ? "审评中" : "Review",
      label: locale === "zh" ? "审评中" : "Review",
      guidance:
        locale === "zh"
          ? "审评老师 Agent 正在检查设计书对齐度、工程质量和交付就绪度。"
          : "Reviewer agents are checking brief alignment, engineering quality, and delivery readiness."
    };
  }
  if (
    ["requirements_reviewer", "engineering_reviewer", "delivery_reviewer"].includes(stage)
  ) {
    return {
      current: locale === "zh" ? "老师审评" : "Reviewer Checks",
      label: locale === "zh" ? "审评交付物" : "Reviewing the deliverables",
      guidance:
        locale === "zh"
          ? "审评老师 Agent 正在检查设计书对齐度、工程质量和交付就绪度。"
          : "Reviewer agents are checking brief alignment, engineering quality, and delivery readiness."
    };
  }
  if (stage === "verification_running") {
    return {
      current: locale === "zh" ? "本地校验中" : "Local Verification",
      label: locale === "zh" ? "校验交付物" : "Verifying deliverables",
      guidance:
        locale === "zh"
          ? "生成出的工作区和论文初稿正在进行最终交付前校验。"
          : "The generated workspace and thesis draft are being checked before final delivery."
    };
  }
  if (stage === "code_eval" || stage === "doc_check") {
    return {
      current: locale === "zh" ? "本地校验" : "Local Verification",
      label: locale === "zh" ? "校验交付物" : "Verifying deliverables",
      guidance:
        locale === "zh"
          ? "生成出的工作区和论文初稿正在进行最终交付前校验。"
          : "The generated workspace and thesis draft are being checked before final delivery."
    };
  }
  if (stage === "planning") {
    return {
      current: locale === "zh" ? "规划中" : "Planning",
      label: locale === "zh" ? "规划中" : "Planning",
      guidance:
        locale === "zh"
          ? "导师 Agent 正在阅读设计书并定义交付范围。"
          : "The advisor is reading the brief and defining delivery scope."
    };
  }
  if (stage === "implementation" || stage === "drafting") {
    return {
      current: locale === "zh" ? "生成中" : "Generating",
      label: locale === "zh" ? "生成中" : "Generating",
      guidance:
        locale === "zh"
          ? "流水线正在生成代码、仓库文档和论文初稿。"
          : "The pipeline is producing code, repository docs, and the thesis first draft."
    };
  }
  if (stage === "review") {
    return {
      current: locale === "zh" ? "审评中" : "Review",
      label: locale === "zh" ? "审评中" : "Review",
      guidance:
        locale === "zh"
          ? "审评老师 Agent 和本地校验正在评估当前交付物。"
          : "Reviewer agents and local checks are evaluating the generated deliverables."
    };
  }
  if (stage === "blocked") {
    return {
      current: locale === "zh" ? "阻塞" : "Blocked",
      label: locale === "zh" ? "阻塞" : "Blocked",
      guidance:
        locale === "zh"
          ? "任务交付前需要先进行人工修复。"
          : "Manual repair is required before this job can be delivered."
    };
  }
  if (stage === "done" || stage === "completed") {
    return {
      current: locale === "zh" ? "已完成" : "Completed",
      label: locale === "zh" ? "已完成" : "Completed",
      guidance:
        locale === "zh"
          ? "生成已经完成。确认产物无误后即可导出工作区。"
          : "Generation finished. Review the artifacts and export the workspace when ready."
    };
  }
  return {
    current: stage || (locale === "zh" ? "未知" : "Unknown"),
    label: stage || (locale === "zh" ? "未知" : "Unknown"),
    guidance:
      locale === "zh"
        ? "当前选中的任务仍在本地流水线中推进。"
        : "The selected job is still moving through the local pipeline."
  };
}

export function JobTimeline(props: JobTimelineProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const stage = describeStage(locale, props.stage);

  return (
    <section>
      <h2>{isZh ? "任务时间线" : "Job Timeline"}</h2>
      <p>{isZh ? `当前阶段：${stage.current}` : `Current stage: ${stage.current}`}</p>
      <p>{isZh ? `流水线状态：${stage.label}` : `Pipeline status: ${stage.label}`}</p>
      <p>{stage.guidance}</p>
    </section>
  );
}
