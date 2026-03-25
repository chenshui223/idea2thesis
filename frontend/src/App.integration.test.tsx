import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import App from "./App";

const SETTINGS_CACHE_KEY = "idea2thesis.settings.cache";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
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
        global: {
          base_url: "https://api.openai.com/v1",
          model: "gpt-4.1-mini"
        },
        agents: {},
        api_key_configured: false
      })
    })
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
  await user.type(screen.getByLabelText("API Key"), "runtime-key");
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByRole("button", { name: "Generating..." })).toBeInTheDocument();

  expect(intervalCallbacks).toHaveLength(1);
  const uploadCall = fetchMock.mock.calls[1];
  const uploadBody = uploadCall[1].body as FormData;
  const configPayload = JSON.parse(String(uploadBody.get("config")));
  expect(configPayload.global.api_key).toBe("runtime-key");
  expect(configPayload.global.base_url).toBe("https://api.openai.com/v1");
  expect(configPayload.global.model).toBe("gpt-4.1-mini");
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
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schema_version: "v1alpha1",
          global: {
            base_url: "https://api.openai.com/v1",
            model: "gpt-4.1-mini"
          },
          agents: {},
          api_key_configured: false
        })
      })
      .mockResolvedValueOnce({
        ok: false
      })
  );

  render(<App />);
  await user.type(screen.getByLabelText("API Key"), "runtime-key");
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByText("failed to create job")).toBeInTheDocument();
});

test("restores non-sensitive settings from cache but leaves api key blank", async () => {
  window.localStorage.setItem(
    SETTINGS_CACHE_KEY,
    JSON.stringify({
      schema_version: "v1alpha1",
      global: { base_url: "https://cached.example/v1", model: "cached-model" },
      agents: {
        coder: {
          use_global: false,
          base_url: "https://coder.example/v1",
          model: "coder-model"
        }
      }
    })
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  );

  render(<App />);

  expect(screen.getByLabelText("Base URL")).toHaveValue("https://cached.example/v1");
  expect(screen.getByLabelText("Model")).toHaveValue("cached-model");
  expect(screen.getByLabelText("API Key")).toHaveValue("");
});

test("backend settings overwrite cache and advanced overrides flow into upload config", async () => {
  window.localStorage.setItem(
    SETTINGS_CACHE_KEY,
    JSON.stringify({
      schema_version: "v1alpha1",
      global: { base_url: "https://stale.example/v1", model: "stale-model" },
      agents: {}
    })
  );

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        global: { base_url: "https://server.example/v1", model: "server-model" },
        agents: {
          coder: {
            use_global: false,
            base_url: "https://server-coder.example/v1",
            model: "server-coder-model"
          }
        },
        api_key_configured: false
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        job_id: "job-2",
        stage: "completed",
        status: "completed",
        agents: [],
        artifacts: [],
        validation_state: "completed",
        final_disposition: "completed"
      })
    });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByLabelText("Base URL")).toHaveValue("https://server.example/v1");
  });
  expect(JSON.parse(window.localStorage.getItem(SETTINGS_CACHE_KEY) ?? "{}").global.base_url).toBe(
    "https://server.example/v1"
  );

  await user.type(screen.getByLabelText("API Key"), "global-key");
  await user.click(screen.getByRole("button", { name: "Advanced Settings" }));
  await user.clear(screen.getByLabelText("Coder API Key"));
  await user.type(screen.getByLabelText("Coder API Key"), "coder-key");
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  const uploadBody = fetchMock.mock.calls[1][1].body as FormData;
  const configPayload = JSON.parse(String(uploadBody.get("config")));
  expect(configPayload.agents.coder.use_global).toBe(false);
  expect(configPayload.agents.coder.api_key).toBe("coder-key");
  expect(configPayload.agents.coder.base_url).toBe("https://server-coder.example/v1");
  expect(configPayload.agents.coder.model).toBe("server-coder-model");
});

test("requires global base url and model before submit", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        global: { base_url: "", model: "" },
        agents: {},
        api_key_configured: false
      })
    })
  );
  const user = userEvent.setup();

  render(<App />);
  await user.type(screen.getByLabelText("API Key"), "runtime-key");
  const file = new File(["demo"], "brief.docx");
  await user.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await user.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByText("Base URL and Model are required.")).toBeInTheDocument();
});
