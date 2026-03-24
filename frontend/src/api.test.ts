import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJob, uploadBrief } from "./api";

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

    await uploadBrief(file);

    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = fetchMock.mock.calls[0];
    const formData = options.body as FormData;
    expect(formData.get("file")).toBe(file);
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
});
