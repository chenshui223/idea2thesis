import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJob, fetchSettings, saveSettings, uploadBrief } from "./api";
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
        global: { base_url: "https://example.com/v1", model: "gpt-test" },
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
        global: { base_url: "https://example.com/v1", model: "gpt-test" },
        agents: {},
        api_key_configured: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const settings: PersistedSettings = {
      schema_version: "v1alpha1",
      global: {
        base_url: "https://example.com/v1",
        model: "gpt-test"
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
});
