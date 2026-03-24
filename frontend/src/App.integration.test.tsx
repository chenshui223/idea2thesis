import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import App from "./App";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("shows validation error when no file is selected", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));
  expect(screen.getByText("Please select a .docx brief first.")).toBeInTheDocument();
});

test("uploads file, shows generating state, and renders returned snapshot", async () => {
  const intervalCallbacks: Array<() => void | Promise<void>> = [];
  vi.spyOn(window, "setInterval").mockImplementation((handler) => {
    intervalCallbacks.push(handler as () => void | Promise<void>);
    return 1;
  });
  vi.spyOn(window, "clearInterval").mockImplementation(() => {});
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        job_id: "job-1",
        stage: "running",
        status: "running",
        agents: [{ role: "coder", status: "running", summary: "generating code" }],
        artifacts: [],
        validation_state: "running",
        final_disposition: "pending"
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        job_id: "job-1",
        stage: "completed",
        status: "completed",
        agents: [{ role: "coder", status: "done", summary: "generated code" }],
        artifacts: [{ kind: "verification_report", path: "/tmp/report.json" }],
        validation_state: "completed",
        final_disposition: "completed"
      })
    });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByRole("button", { name: "Generating..." })).toBeInTheDocument();

  expect(intervalCallbacks).toHaveLength(1);
  await act(async () => {
    await intervalCallbacks[0]();
  });
  await waitFor(() => {
    expect(screen.getByText("Current stage: completed")).toBeInTheDocument();
    expect(screen.getByText(/coder: done/i)).toBeInTheDocument();
    expect(
      screen.getByText(/verification_report: \/tmp\/report.json/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Validation state: completed")).toBeInTheDocument();
    expect(screen.getByText("Final disposition: completed")).toBeInTheDocument();
  });
});

test("shows upload error when request fails", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false
    })
  );

  render(<App />);
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByText("failed to create job")).toBeInTheDocument();
});
