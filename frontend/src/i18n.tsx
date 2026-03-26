import { createContext, useContext, type ReactNode } from "react";

import type { AgentRole } from "./types";

export type Locale = "zh" | "en";

export const LOCALE_CACHE_KEY = "idea2thesis.locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider(props: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider
      value={{ locale: props.locale, setLocale: props.setLocale }}
    >
      {props.children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export function readCachedLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(LOCALE_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed === "zh" || parsed === "en" ? parsed : null;
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_CACHE_KEY, JSON.stringify(locale));
  } catch {
    return;
  }
}

export function formatAgentRole(locale: Locale, role: AgentRole | string) {
  const labels: Record<string, { zh: string; en: string }> = {
    advisor: { zh: "课设导师", en: "Advisor" },
    coder: { zh: "Coder", en: "Coder" },
    writer: { zh: "Writer", en: "Writer" },
    requirements_reviewer: { zh: "需求审评老师", en: "Requirements Reviewer" },
    engineering_reviewer: { zh: "工程审评老师", en: "Engineering Reviewer" },
    delivery_reviewer: { zh: "交付审评老师", en: "Delivery Reviewer" },
    code_eval: { zh: "代码评测 Agent", en: "Code Eval" },
    doc_check: { zh: "文档检查 Agent", en: "Doc Check" }
  };
  const label = labels[role];
  if (!label) {
    return role;
  }
  return locale === "zh" ? label.zh : label.en;
}

export function formatStatusValue(locale: Locale, status: string) {
  const labels: Record<string, { zh: string; en: string }> = {
    all: { zh: "全部", en: "all" },
    pending: { zh: "待处理", en: "pending" },
    running: { zh: "运行中", en: "running" },
    completed: { zh: "已完成", en: "completed" },
    failed: { zh: "失败", en: "failed" },
    blocked: { zh: "阻塞", en: "blocked" },
    interrupted: { zh: "中断", en: "interrupted" },
    deleted: { zh: "已删除", en: "deleted" },
    done: { zh: "已完成", en: "done" },
    idle: { zh: "空闲", en: "idle" }
  };
  const label = labels[status];
  if (!label) {
    return status;
  }
  return locale === "zh" ? label.zh : label.en;
}

export function formatSortValue(locale: Locale, sort: string) {
  const labels: Record<string, { zh: string; en: string }> = {
    updated_desc: { zh: "最近更新优先", en: "updated_desc" },
    created_desc: { zh: "最新创建优先", en: "created_desc" },
    created_asc: { zh: "最早创建优先", en: "created_asc" }
  };
  const label = labels[sort];
  if (!label) {
    return sort;
  }
  return locale === "zh" ? label.zh : label.en;
}

export function formatStageValue(locale: Locale, stage: string) {
  const labels: Record<string, { zh: string; en: string }> = {
    idle: { zh: "空闲", en: "Idle" },
    queued: { zh: "排队中", en: "Queued" },
    advisor_running: { zh: "导师规划中", en: "Advisor Planning" },
    coder_running: { zh: "代码生成中", en: "Code Generation" },
    writer_running: { zh: "文档撰写中", en: "Document Drafting" },
    advisor: { zh: "导师规划", en: "Advisor" },
    coder: { zh: "代码生成", en: "Coder" },
    writer: { zh: "文档撰写", en: "Writer" },
    review_running: { zh: "审评中", en: "Review" },
    requirements_reviewer: { zh: "需求审评", en: "Requirements Review" },
    engineering_reviewer: { zh: "工程审评", en: "Engineering Review" },
    delivery_reviewer: { zh: "交付审评", en: "Delivery Review" },
    verification_running: { zh: "本地校验中", en: "Local Verification" },
    code_eval: { zh: "代码评测", en: "Code Evaluation" },
    doc_check: { zh: "文档检查", en: "Document Check" },
    planning: { zh: "规划阶段", en: "Planning" },
    implementation: { zh: "实现阶段", en: "Implementation" },
    drafting: { zh: "撰写阶段", en: "Drafting" },
    review: { zh: "审评阶段", en: "Review" },
    blocked: { zh: "阻塞", en: "Blocked" },
    done: { zh: "已完成", en: "Completed" },
    completed: { zh: "已完成", en: "Completed" }
  };
  const label = labels[stage];
  if (!label) {
    return stage || (locale === "zh" ? "未知" : "Unknown");
  }
  return locale === "zh" ? label.zh : label.en;
}

export function formatEventKind(locale: Locale, kind: string) {
  const known = formatStageValue(locale, kind);
  if (known !== kind) {
    return known;
  }
  return locale === "zh" ? kind.replaceAll("_", " / ") : kind.replaceAll("_", " ");
}
