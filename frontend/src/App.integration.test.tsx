import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  }) as Response;
}

function mockSettingsResponse() {
  return mockResponse({
    schema_version: "v1alpha1",
    global: { base_url: "https://api.example.com/v1", model: "gpt-4.1-mini" },
    agents: {},
    api_key_configured: false
  });
}

describe("App history workbench", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test("loads history list and auto-selects first row", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockSettingsResponse()
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 2,
        items: [
          {
            job_id: "job-1",
            title: "First job",
            status: "completed",
            stage: "done",
            final_disposition: "completed",
            updated_at: "2026-03-25T00:00:00Z"
          },
          {
            job_id: "job-2",
            title: "Second job",
            status: "running",
            stage: "drafting",
            final_disposition: "pending",
            updated_at: "2026-03-25T00:00:01Z"
          }
        ]
      })
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        source_job_id: null,
        title: "First job",
        status: "completed",
        stage: "done",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: null,
        deleted_at: null,
        runtime_preset: {
          apiKeyConfigured: true,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {
            coder: {
              useGlobal: true,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini"
            }
          }
        }
      })
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ schema_version: "v1alpha1", items: [] })
    );

    render(<App />);

    expect(await screen.findByText("First job")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /First job/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Current job: job-1")).toBeInTheDocument();
  });

  test("selecting a row updates right-side detail panel", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 2,
        items: [
          {
            job_id: "job-1",
            title: "First job",
            status: "completed",
            stage: "done",
            final_disposition: "completed",
            updated_at: "2026-03-25T00:00:00Z"
          },
          {
            job_id: "job-2",
            title: "Second job",
            status: "running",
            stage: "drafting",
            final_disposition: "pending",
            updated_at: "2026-03-25T00:00:01Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        source_job_id: null,
        title: "First job",
        status: "completed",
        stage: "done",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: null,
        deleted_at: null,
        runtime_preset: {
          apiKeyConfigured: true,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {
            coder: {
              useGlobal: true,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini"
            }
          }
        }
      })
    );
    fetchMock.mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }));
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-2",
        source_job_id: "job-1",
        title: "Second job",
        status: "running",
        stage: "drafting",
        final_disposition: "pending",
        validation_state: "running",
        workspace_path: "/jobs/job-2/workspace",
        input_file_path: "/jobs/job-2/input/brief.docx",
        error_message: null,
        deleted_at: null,
        runtime_preset: {
          apiKeyConfigured: false,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {}
        }
      })
    );
    fetchMock.mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }));

    render(<App />);

    await screen.findByText("First job");
    await userEvent.click(screen.getByRole("row", { name: /Second job/ }));

    expect(await screen.findByText("Current job: job-2")).toBeInTheDocument();
    expect(screen.getByText("Second job")).toBeInTheDocument();
  });

  test("rerun repopulates non-sensitive settings only and selects new job", async () => {
    let historyRequestCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/settings" && method === "GET") {
          return mockSettingsResponse();
        }
        if (url === "/settings" && method === "PUT") {
          return mockSettingsResponse();
        }
        if ((url === "/jobs" || url === "/jobs?sort=updated_desc") && method === "GET") {
          historyRequestCount += 1;
          return mockResponse({
            schema_version: "v1alpha1",
            total: historyRequestCount === 1 ? 1 : 2,
            items:
              historyRequestCount === 1
                ? [
                    {
                      job_id: "job-1",
                      title: "First job",
                      status: "completed",
                      stage: "done",
                      final_disposition: "completed",
                      updated_at: "2026-03-25T00:00:00Z"
                    }
                  ]
                : [
                    {
                      job_id: "job-2",
                      title: "Rerun job",
                      status: "pending",
                      stage: "queued",
                      final_disposition: "pending",
                      updated_at: "2026-03-25T00:01:00Z"
                    },
                    {
                      job_id: "job-1",
                      title: "First job",
                      status: "completed",
                      stage: "done",
                      final_disposition: "completed",
                      updated_at: "2026-03-25T00:00:00Z"
                    }
                  ]
          });
        }
        if (url === "/jobs/job-1") {
          return mockResponse({
            schema_version: "v1alpha1",
            job_id: "job-1",
            source_job_id: null,
            title: "First job",
            status: "completed",
            stage: "done",
            final_disposition: "completed",
            validation_state: "completed",
            workspace_path: "/jobs/job-1/workspace",
            input_file_path: "/jobs/job-1/input/brief.docx",
            error_message: null,
            deleted_at: null,
            runtime_preset: {
              apiKeyConfigured: true,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini",
              agents: {
                coder: {
                  useGlobal: true,
                  base_url: "https://api.example.com/v1",
                  model: "gpt-4.1-mini"
                }
              }
            }
          });
        }
        if (url === "/jobs/job-1/events") {
          return mockResponse({ schema_version: "v1alpha1", items: [] });
        }
        if (url === "/jobs/job-1/rerun" && method === "POST") {
          return mockResponse({
            schema_version: "v1alpha1",
            job_id: "job-2",
            source_job_id: "job-1",
            title: "Rerun job",
            status: "pending",
            stage: "queued",
            final_disposition: "pending",
            validation_state: "pending",
            workspace_path: "/jobs/job-2/workspace",
            input_file_path: "/jobs/job-2/input/brief.docx",
            error_message: null,
            deleted_at: null,
            runtime_preset: {
              apiKeyConfigured: false,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini",
              agents: {}
            }
          });
        }
        if (url === "/jobs/job-2/events") {
          return mockResponse({ schema_version: "v1alpha1", items: [] });
        }
        if (url === "/jobs/job-2") {
          return mockResponse({
            schema_version: "v1alpha1",
            job_id: "job-2",
            source_job_id: "job-1",
            title: "Rerun job",
            status: "pending",
            stage: "queued",
            final_disposition: "pending",
            validation_state: "pending",
            workspace_path: "/jobs/job-2/workspace",
            input_file_path: "/jobs/job-2/input/brief.docx",
            error_message: null,
            deleted_at: null,
            runtime_preset: {
              apiKeyConfigured: false,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini",
              agents: {}
            }
          });
        }

        throw new Error(`unexpected fetch: ${method} ${url}`);
      }
    );

    render(<App />);
    await screen.findByText("First job");

    await userEvent.type(screen.getByLabelText("API Key"), "secret-key");
    await userEvent.clear(screen.getByLabelText("Base URL"));
    await userEvent.type(screen.getByLabelText("Base URL"), "https://override.example.com/v1");
    await userEvent.clear(screen.getByLabelText("Model"));
    await userEvent.type(screen.getByLabelText("Model"), "gpt-4.1");

    await userEvent.click(screen.getByRole("button", { name: "Rerun" }));

    await waitFor(() => expect(screen.getByText("Current job: job-2")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("API Key")).toHaveValue(""));
    await waitFor(() =>
      expect(screen.getByLabelText("Base URL")).toHaveValue("https://api.example.com/v1")
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Model")).toHaveValue("gpt-4.1-mini")
    );
  });

  test("delete marks a terminal job deleted and keeps it selected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 1,
        items: [
          {
            job_id: "job-1",
            title: "First job",
            status: "completed",
            stage: "done",
            final_disposition: "completed",
            updated_at: "2026-03-25T00:00:00Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        source_job_id: null,
        title: "First job",
        status: "completed",
        stage: "done",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: null,
        deleted_at: null,
        runtime_preset: {
          apiKeyConfigured: true,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {
            coder: {
              useGlobal: true,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini"
            }
          }
        }
      })
    );
    fetchMock.mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }));
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        source_job_id: null,
        title: "First job",
        status: "deleted",
        stage: "done",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: null,
        deleted_at: "2026-03-25T00:10:00Z",
        runtime_preset: {
          apiKeyConfigured: true,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {
            coder: {
              useGlobal: true,
              base_url: "https://api.example.com/v1",
              model: "gpt-4.1-mini"
            }
          }
        }
      })
    );

    render(<App />);
    await screen.findByText("First job");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Status: deleted")).toBeInTheDocument();
    expect(screen.getByText("Deleted at: 2026-03-25T00:10:00Z")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /First job/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("search and status filter narrow visible list correctly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockSettingsResponse()
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 3,
        items: [
          {
            job_id: "job-1",
            title: "Alpha research",
            status: "completed",
            stage: "done",
            final_disposition: "completed",
            updated_at: "2026-03-25T00:00:00Z"
          },
          {
            job_id: "job-2",
            title: "Beta analysis",
            status: "running",
            stage: "drafting",
            final_disposition: "pending",
            updated_at: "2026-03-25T00:00:01Z"
          },
          {
            job_id: "job-3",
            title: "Gamma plan",
            status: "failed",
            stage: "review",
            final_disposition: "failed",
            updated_at: "2026-03-25T00:00:02Z"
          }
        ]
      })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        source_job_id: null,
        title: "Alpha research",
        status: "completed",
        stage: "done",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: null,
        deleted_at: null,
        runtime_preset: {
          apiKeyConfigured: true,
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          agents: {}
        }
      })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }));

    render(<App />);
    await screen.findByText("Alpha research");

    await userEvent.type(screen.getByLabelText("Search jobs"), "beta");
    let historyTable = screen.getByRole("table");
    expect(within(historyTable).getByText("Beta analysis")).toBeInTheDocument();
    expect(within(historyTable).queryByText("Alpha research")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status filter"), "running");
    historyTable = screen.getByRole("table");
    expect(within(historyTable).getByText("Beta analysis")).toBeInTheDocument();
    expect(within(historyTable).queryByText("Gamma plan")).not.toBeInTheDocument();
  });

  test("selected active job polling only", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          schema_version: "v1alpha1",
          total: 2,
          items: [
            {
              job_id: "job-1",
              title: "First job",
              status: "running",
              stage: "drafting",
              final_disposition: "pending",
              updated_at: "2026-03-25T00:00:00Z"
            },
            {
              job_id: "job-2",
              title: "Second job",
              status: "running",
              stage: "drafting",
              final_disposition: "pending",
              updated_at: "2026-03-25T00:00:01Z"
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          schema_version: "v1alpha1",
          job_id: "job-1",
          source_job_id: null,
          title: "First job",
          status: "running",
          stage: "drafting",
          final_disposition: "pending",
          validation_state: "running",
          workspace_path: "/jobs/job-1/workspace",
          input_file_path: "/jobs/job-1/input/brief.docx",
          error_message: null,
          deleted_at: null,
          runtime_preset: {
            apiKeyConfigured: true,
            base_url: "https://api.example.com/v1",
            model: "gpt-4.1-mini",
            agents: {}
          }
        })
      )
      .mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }))
      .mockResolvedValueOnce(
        mockResponse({
          schema_version: "v1alpha1",
          job_id: "job-2",
          source_job_id: null,
          title: "Second job",
          status: "running",
          stage: "drafting",
          final_disposition: "pending",
          validation_state: "running",
          workspace_path: "/jobs/job-2/workspace",
          input_file_path: "/jobs/job-2/input/brief.docx",
          error_message: null,
          deleted_at: null,
          runtime_preset: {
            apiKeyConfigured: true,
            base_url: "https://api.example.com/v1",
            model: "gpt-4.1-mini",
            agents: {}
          }
        })
      )
      .mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }))
      .mockResolvedValueOnce(
        mockResponse({
          schema_version: "v1alpha1",
          job_id: "job-2",
          source_job_id: null,
          title: "Second job",
          status: "running",
          stage: "drafting",
          final_disposition: "pending",
          validation_state: "running",
          workspace_path: "/jobs/job-2/workspace",
          input_file_path: "/jobs/job-2/input/brief.docx",
          error_message: null,
          deleted_at: null,
          runtime_preset: {
            apiKeyConfigured: true,
            base_url: "https://api.example.com/v1",
            model: "gpt-4.1-mini",
            agents: {}
          }
        })
      )
      .mockResolvedValueOnce(mockResponse({ schema_version: "v1alpha1", items: [] }));

    render(<App />);
    await screen.findByText("First job");

    await user.click(screen.getByRole("row", { name: /Second job/ }));
    await waitFor(() => expect(screen.getByText("Current job: job-2")).toBeInTheDocument());

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes("/jobs/job-2")).length
      ).toBeGreaterThan(1)
    );

    const job1Calls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/jobs/job-1"));
    const job2Calls = fetchMock.mock.calls.filter(([input]) => String(input).includes("/jobs/job-2"));
    expect(job2Calls.length).toBeGreaterThanOrEqual(job1Calls.length);
  });

  test("detail workbench shows agent summaries, artifacts, and verification events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 1,
        items: [
          {
            job_id: "job-1",
            brief_title: "Thesis Job",
            status: "completed",
            stage: "completed",
            final_disposition: "completed",
            updated_at: "2026-03-25T00:00:00Z",
            created_at: "2026-03-25T00:00:00Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        brief_title: "Thesis Job",
        source_job_id: null,
        status: "completed",
        stage: "completed",
        final_disposition: "completed",
        validation_state: "completed",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: "",
        deleted_at: null,
        created_at: "2026-03-25T00:00:00Z",
        updated_at: "2026-03-25T00:02:00Z",
        agents: [
          { role: "advisor", status: "done", summary: "defined delivery scope" },
          { role: "code_eval", status: "done", summary: "local verification command executed" }
        ],
        artifacts: [
          { kind: "job_manifest", path: "/jobs/job-1/artifacts/final/job_manifest.json" },
          { kind: "code_eval", path: "/jobs/job-1/artifacts/verification/code_eval.json" },
          { kind: "workspace_file", path: "/jobs/job-1/workspace/src/pipeline.py" },
          { kind: "workspace_file", path: "/jobs/job-1/workspace/docs/答辩提纲.md" }
        ],
        runtime_preset: {
          global: {
            base_url: "https://api.example.com/v1",
            model: "gpt-4.1-mini"
          },
          agents: {}
        }
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        items: [
          {
            id: 1,
            timestamp: "2026-03-25T00:00:10Z",
            kind: "verification_started",
            message: "verification started",
            payload: {}
          },
          {
            id: 2,
            timestamp: "2026-03-25T00:00:20Z",
            kind: "verification_completed",
            message: "verification completed",
            payload: { code_eval: "pass" }
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        path: "/jobs/job-1/workspace/src/pipeline.py",
        content: "print('provider generated')\n",
        truncated: false
      })
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-1")).toBeInTheDocument();
    expect(screen.getByText(/advisor: defined delivery scope/i)).toBeInTheDocument();
    const artifactsSection = screen.getByRole("heading", { name: "Artifacts" }).closest("section");
    expect(artifactsSection).not.toBeNull();
    expect(
      within(artifactsSection as HTMLElement).getByRole("heading", { name: "Generated Code" })
    ).toBeInTheDocument();
    expect(
      within(artifactsSection as HTMLElement).getByRole("heading", { name: "Generated Docs" })
    ).toBeInTheDocument();
    expect(
      within(artifactsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("artifacts/final/job_manifest.json") ??
          false)
      )
    ).toBeInTheDocument();
    expect(
      within(artifactsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/src/pipeline.py") ?? false)
      )
    ).toBeInTheDocument();
    expect(
      within(artifactsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/docs/答辩提纲.md") ?? false)
      )
    ).toBeInTheDocument();
    const generatedCodeSection = within(artifactsSection as HTMLElement)
      .getByRole("heading", { name: "Generated Code" })
      .closest("section");
    const generatedDocsSection = within(artifactsSection as HTMLElement)
      .getByRole("heading", { name: "Generated Docs" })
      .closest("section");
    expect(generatedCodeSection).not.toBeNull();
    expect(generatedDocsSection).not.toBeNull();
    expect(
      within(generatedCodeSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/src/pipeline.py") ?? false)
      )
    ).toBeInTheDocument();
    expect(
      within(generatedDocsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/docs/答辩提纲.md") ?? false)
      )
    ).toBeInTheDocument();
    expect(
      within(generatedCodeSection as HTMLElement).getByTitle("/jobs/job-1/workspace/src/pipeline.py")
    ).toBeInTheDocument();
    await userEvent.click(
      within(generatedCodeSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/src/pipeline.py") ?? false)
      )
    );
    expect(await screen.findByText("Artifact Preview")).toBeInTheDocument();
    expect(screen.getByText("print('provider generated')")).toBeInTheDocument();
    expect(screen.getByText(/verification_completed/i)).toBeInTheDocument();
  });
});
