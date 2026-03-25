import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadArtifact,
  downloadSampleBriefTemplate,
  downloadWorkspaceArchive,
  fetchJob,
  fetchSettings,
  openArtifactInFolder,
  saveSettings,
  uploadBrief
} from "./api";
import type { PersistedSettings, RuntimeConfig } from "./types";

describe("api helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploadBrief posts multipart form data with file field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: "job-1" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["demo"], "brief.docx");
    const runtimeConfig: RuntimeConfig = {
      schema_version: "v1alpha1",
      global: {
        api_key: "runtime-key",
        base_url: "https://example.com/v1",
        model: "gpt-test"
      },
      agents: {}
    };

    await uploadBrief(file, runtimeConfig);

    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = fetchMock.mock.calls[0];
    const formData = options.body as FormData;
    expect(formData.get("file")).toBe(file);
    expect(formData.get("config")).toBe(JSON.stringify(runtimeConfig));
  });

  it("fetchJob requests the matching job id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: "job-1" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchJob("job-1");

    expect(fetchMock).toHaveBeenCalledWith("/jobs/job-1");
  });

  it("fetchSettings loads backend settings payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        global: {
          base_url: "https://example.com/v1",
          model: "gpt-test",
          thesis_cover: {
            school: "示例大学",
            department: "计算机学院",
            major: "软件工程",
            student_name: "张三",
            student_id: "20240001",
            advisor: "李老师"
          }
        },
        agents: {},
        api_key_configured: false
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const settings = await fetchSettings();

    expect(fetchMock).toHaveBeenCalledWith("/settings");
    expect(settings.global.model).toBe("gpt-test");
  });

  it("saveSettings sends only non-sensitive settings to backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        global: {
          base_url: "https://example.com/v1",
          model: "gpt-test",
          thesis_cover: {
            school: "示例大学",
            department: "计算机学院",
            major: "软件工程",
            student_name: "张三",
            student_id: "20240001",
            advisor: "李老师"
          }
        },
        agents: {},
        api_key_configured: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const settings: PersistedSettings = {
      schema_version: "v1alpha1",
      global: {
        base_url: "https://example.com/v1",
        model: "gpt-test",
        thesis_cover: {
          school: "示例大学",
          department: "计算机学院",
          major: "软件工程",
          student_name: "张三",
          student_id: "20240001",
          advisor: "李老师"
        }
      },
      agents: {}
    };

    await saveSettings(settings);

    expect(fetchMock).toHaveBeenCalledWith(
      "/settings",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })
    );
  });

  it("downloadArtifact fetches the download endpoint and returns a blob", async () => {
    const blob = new Blob(["artifact body"], { type: "text/plain" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadArtifact("job-1", {
      kind: "workspace_file",
      path: "/jobs/job-1/workspace/docs/report.md"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs/job-1/artifacts/download?path=%2Fjobs%2Fjob-1%2Fworkspace%2Fdocs%2Freport.md"
    );
    expect(result).toBe(blob);
  });

  it("openArtifactInFolder posts the artifact path to backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, path: "/jobs/job-1/workspace/docs/report.md" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await openArtifactInFolder("job-1", {
      kind: "workspace_file",
      path: "/jobs/job-1/workspace/docs/report.md"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs/job-1/artifacts/open?path=%2Fjobs%2Fjob-1%2Fworkspace%2Fdocs%2Freport.md",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(result.ok).toBe(true);
  });

  it("downloadWorkspaceArchive fetches the workspace archive endpoint and returns a blob", async () => {
    const blob = new Blob(["zip body"], { type: "application/zip" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWorkspaceArchive("job-1");

    expect(fetchMock).toHaveBeenCalledWith("/jobs/job-1/workspace/archive");
    expect(result).toBe(blob);
  });

  it("downloadSampleBriefTemplate fetches the sample template endpoint and returns a blob", async () => {
    const blob = new Blob(["docx body"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadSampleBriefTemplate();

    expect(fetchMock).toHaveBeenCalledWith("/templates/sample-brief.docx");
    expect(result).toBe(blob);
  });
});
