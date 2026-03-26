import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("renders generator heading without act warnings during startup", async () => {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        schema_version: "v1alpha1",
        global: {
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          thesis_cover: {}
        },
        agents: {},
        api_key_configured: false
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  );
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        schema_version: "v1alpha1",
        total: 0,
        items: []
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<App />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/settings");
    expect(fetchMock).toHaveBeenCalledWith("/jobs?sort=updated_desc");
  });

  expect(screen.getByText("idea2thesis")).toBeInTheDocument();
  expect(screen.getByText("One-click thesis project generation")).toBeInTheDocument();
  expect(screen.getByText("Quick Start")).toBeInTheDocument();
  expect(screen.getByText("API Key is never saved.")).toBeInTheDocument();
  expect(screen.getByText("Job Timeline")).toBeInTheDocument();
  expect(screen.getByText("Agent Status")).toBeInTheDocument();
  expect(screen.getByText("Artifacts")).toBeInTheDocument();
  expect(screen.getByText("Validation Report")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Project" })).toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("not wrapped in act")
  );
});
