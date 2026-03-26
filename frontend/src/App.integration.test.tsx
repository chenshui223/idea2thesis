import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { AGENT_ROLES } from "./types";

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  }) as Response;
}

function mockSettingsResponse() {
  return mockResponse({
    schema_version: "v1alpha1",
    global: {
      base_url: "https://api.example.com/v1",
      model: "gpt-4.1-mini",
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
  });
}

function buildDefaultPersistedAgents() {
  return Object.fromEntries(
    AGENT_ROLES.map((role) => [
      role,
      {
        use_global: true,
        base_url: "",
        model: ""
      }
    ])
  );
}

describe("App history workbench", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    expect(screen.getByLabelText("School")).toHaveValue("示例大学");
    expect(screen.getByLabelText("Student Name")).toHaveValue("张三");
    expect(screen.getByRole("row", { name: /First job/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Current job: job-1")).toBeInTheDocument();
  });

  test("thesis cover settings can reset to default placeholders", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 0,
        items: []
      })
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        global: {
          base_url: "https://api.example.com/v1",
          model: "gpt-4.1-mini",
          thesis_cover: {
            school: "待填写学校",
            department: "待填写学院",
            major: "计算机软件相关专业",
            student_name: "待填写",
            student_id: "待填写",
            advisor: "待填写"
          }
        },
        agents: {},
        api_key_configured: false
      })
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Thesis Cover" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reset Thesis Cover" }));

    expect(screen.getByLabelText("School")).toHaveValue("待填写学校");
    expect(screen.getByLabelText("Department")).toHaveValue("待填写学院");
    expect(screen.getByLabelText("Major")).toHaveValue("计算机软件相关专业");
    expect(screen.getByLabelText("Student Name")).toHaveValue("待填写");
    expect(screen.getByLabelText("Student ID")).toHaveValue("待填写");
    expect(screen.getByLabelText("Advisor")).toHaveValue("待填写");
    expect(fetchMock).toHaveBeenCalledWith(
      "/settings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          schema_version: "v1alpha1",
          global: {
            base_url: "https://api.example.com/v1",
            model: "gpt-4.1-mini",
            thesis_cover: {
              school: "待填写学校",
              department: "待填写学院",
              major: "计算机软件相关专业",
              student_name: "待填写",
              student_id: "待填写",
              advisor: "待填写"
            }
          },
          agents: buildDefaultPersistedAgents()
        })
      })
    );
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

  test("reopens with the previously selected job restored from local storage", async () => {
    localStorage.setItem("idea2thesis.history.selectedJobId", "job-2");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url === "/settings") {
          return mockSettingsResponse();
        }
        if (url === "/jobs" || url === "/jobs?sort=updated_desc") {
          return mockResponse({
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
              agents: {}
            }
          });
        }
        if (url === "/jobs/job-1/events") {
          return mockResponse({
            schema_version: "v1alpha1",
            items: []
          });
        }
        if (url === "/jobs/job-2") {
          return mockResponse({
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
          });
        }
        if (url === "/jobs/job-2/events") {
          return mockResponse({
            schema_version: "v1alpha1",
            items: []
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      }
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-2")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Second job/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(fetchMock).toHaveBeenCalledWith("/jobs/job-2");
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
    expect(localStorage.getItem("idea2thesis.history.selectedJobId")).toBe("job-2");
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
            source_job_id: "job-1",
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
    expect(screen.getByText("Visible jobs: 3")).toBeInTheDocument();
    expect(screen.getByText("Active jobs: 1")).toBeInTheDocument();
    expect(screen.getByText("Needs repair: 1")).toBeInTheDocument();
    expect(screen.getByText("Deleted jobs: 0")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Repair Needed")).toBeInTheDocument();
    let historyTable = screen.getByRole("table");
    expect(within(historyTable).getByText("job-1")).toBeInTheDocument();
    expect(within(historyTable).getByText("job-2")).toBeInTheDocument();
    expect(within(historyTable).getByText("job-3")).toBeInTheDocument();
    expect(within(historyTable).getByText("Rerun from job-1")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search jobs"), "beta");
    historyTable = screen.getByRole("table");
    expect(within(historyTable).getByText("Beta analysis")).toBeInTheDocument();
    expect(within(historyTable).queryByText("Alpha research")).not.toBeInTheDocument();
    expect(screen.getByText("Visible jobs: 1")).toBeInTheDocument();
    expect(screen.getByText("Active jobs: 1")).toBeInTheDocument();
    expect(screen.getByText("Needs repair: 0")).toBeInTheDocument();
    expect(within(historyTable).getByText("job-2")).toBeInTheDocument();
    expect(within(historyTable).getByText("Rerun from job-1")).toBeInTheDocument();
    expect(within(historyTable).queryByText("job-1")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status filter"), "running");
    historyTable = screen.getByRole("table");
    expect(within(historyTable).getByText("Beta analysis")).toBeInTheDocument();
    expect(within(historyTable).queryByText("Gamma plan")).not.toBeInTheDocument();
  });

  test("temporary empty search results do not clear the remembered job selection", async () => {
    localStorage.setItem("idea2thesis.history.selectedJobId", "job-2");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url === "/settings") {
          return mockSettingsResponse();
        }
        if (url === "/jobs?sort=updated_desc") {
          return mockResponse({
            schema_version: "v1alpha1",
            total: 2,
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
              }
            ]
          });
        }
        if (url === "/jobs?query=missing&sort=updated_desc") {
          return mockResponse({
            schema_version: "v1alpha1",
            total: 0,
            items: []
          });
        }
        if (url === "/jobs/job-2") {
          return mockResponse({
            schema_version: "v1alpha1",
            job_id: "job-2",
            source_job_id: null,
            title: "Beta analysis",
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
          });
        }
        if (url === "/jobs/job-2/events") {
          return mockResponse({
            schema_version: "v1alpha1",
            items: []
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      }
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-2")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search jobs"), "missing");

    expect(
      await screen.findByText("No jobs match the current search or status filter.")
    ).toBeInTheDocument();
    expect(screen.getByText('Current search: "missing"')).toBeInTheDocument();
    expect(localStorage.getItem("idea2thesis.history.selectedJobId")).toBe("job-2");
    expect(fetchMock).toHaveBeenCalledWith("/jobs?query=missing&sort=updated_desc");
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
        source_job_id: "job-0",
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
        started_at: "2026-03-25T00:00:05Z",
        finished_at: "2026-03-25T00:01:30Z",
        agents: [
          { role: "advisor", status: "done", summary: "defined delivery scope" },
          { role: "code_eval", status: "done", summary: "local verification command executed" }
        ],
        artifacts: [
          { kind: "job_manifest", path: "/jobs/job-1/artifacts/final/job_manifest.json" },
          { kind: "code_eval", path: "/jobs/job-1/artifacts/verification/code_eval.json" },
          { kind: "workspace_file", path: "/jobs/job-1/workspace/src/pipeline.py" },
          { kind: "workspace_file", path: "/jobs/job-1/workspace/docs/答辩提纲.md" },
          { kind: "thesis_draft_docx", path: "/jobs/job-1/artifacts/agent/writer/thesis_draft.docx" }
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
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        path: "/jobs/job-1/workspace/docs/答辩提纲.md",
        content: "# 答辩提纲\n\n- 项目背景\n- 系统设计\n",
        truncated: false
      })
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-1")).toBeInTheDocument();
    expect(screen.getByText("Source job: job-0")).toBeInTheDocument();
    expect(screen.getByText("Created at: 2026-03-25T00:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("Updated at: 2026-03-25T00:02:00Z")).toBeInTheDocument();
    expect(screen.getByText("Started at: 2026-03-25T00:00:05Z")).toBeInTheDocument();
    expect(screen.getByText("Finished at: 2026-03-25T00:01:30Z")).toBeInTheDocument();
    expect(
      screen.getByText("Validation summary: Validation completed and the deliverable is ready.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preview status: idle")).toBeInTheDocument();
    expect(screen.getByText("Select an artifact to preview.")).toBeInTheDocument();
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
    expect(
      within(artifactsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("artifacts/agent/writer/thesis_draft.docx") ?? false)
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
      within(generatedDocsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("artifacts/agent/writer/thesis_draft.docx") ?? false)
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
    expect(
      within(generatedCodeSection as HTMLElement).getByRole("button", {
        name: /workspace\/src\/pipeline\.py/i
      })
    ).toHaveAttribute("aria-current", "true");
    expect(await screen.findByText("Artifact Preview")).toBeInTheDocument();
    expect(screen.getByText("Code Preview")).toBeInTheDocument();
    expect(screen.getByText("File: pipeline.py")).toBeInTheDocument();
    expect(screen.getByText("Artifact type: workspace_file")).toBeInTheDocument();
    expect(screen.getByText("Preview status: complete")).toBeInTheDocument();
    expect(screen.getByText("print('provider generated')")).toBeInTheDocument();
    await userEvent.click(
      within(generatedDocsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/docs/答辩提纲.md") ?? false)
      )
    );
    expect(await screen.findByText("Document Preview")).toBeInTheDocument();
    expect(await screen.findByText("File: 答辩提纲.md")).toBeInTheDocument();
    expect(screen.getByText("Preview status: complete")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download Artifact" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open In Folder" })
    ).toBeInTheDocument();
    expect(screen.queryByText("# 答辩提纲")).not.toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName.toLowerCase() === "article" && (element.textContent?.includes("项目背景") ?? false))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear Preview" }));
    expect(
      within(generatedDocsSection as HTMLElement).getByRole("button", {
        name: /workspace\/docs\/答辩提纲\.md/i
      })
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Preview status: idle")).toBeInTheDocument();
    expect(screen.getByText("Select an artifact to preview.")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }) as Response);
    await userEvent.click(
      within(generatedDocsSection as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/docs/答辩提纲.md") ?? false)
      )
    );
    expect(await screen.findByText("Document Preview")).toBeInTheDocument();
    expect(await screen.findByText("File: 答辩提纲.md")).toBeInTheDocument();
    expect(screen.getByText("Preview status: error")).toBeInTheDocument();
    expect(screen.getByText("failed to fetch artifact content")).toBeInTheDocument();
    expect(screen.getByText("Latest event: verification completed")).toBeInTheDocument();
    expect(screen.getByText("Event count: 2")).toBeInTheDocument();
    expect(screen.getByText("code_eval: pass")).toBeInTheDocument();
    expect(screen.getByText(/verification_completed/i)).toBeInTheDocument();
  });

  test("artifact preview actions download and open the selected artifact", async () => {
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
        agents: [],
        artifacts: [
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
        items: []
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        path: "/jobs/job-1/workspace/docs/答辩提纲.md",
        content: "# 答辩提纲\n\n- 项目背景\n",
        truncated: false
      })
    );

    const downloadBlob = new Blob(["artifact body"], { type: "text/markdown" });
    fetchMock.mockResolvedValueOnce(
      new Response(downloadBlob, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown"
        }
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        path: "/jobs/job-1/workspace/docs/答辩提纲.md"
      })
    );

    const createObjectURL = vi.fn(() => "blob:idea2thesis");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });

    const anchorClick = vi.fn();
    const anchorRemove = vi.fn();
    const createdAnchors: Array<{
      href: string;
      download: string;
      click: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    }> = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === "a") {
        const anchor = originalCreateElement("a");
        Object.defineProperty(anchor, "click", {
          value: anchorClick
        });
        Object.defineProperty(anchor, "remove", {
          value: anchorRemove
        });
        createdAnchors.push(anchor as unknown as {
          href: string;
          download: string;
          click: ReturnType<typeof vi.fn>;
          remove: ReturnType<typeof vi.fn>;
        });
        return anchor;
      }
      return originalCreateElement(tagName);
    });

    render(<App />);

    const generatedDocsSection = await screen.findByRole("heading", {
      name: "Generated Docs"
    });
    await userEvent.click(
      within(generatedDocsSection.closest("section") as HTMLElement).getByText((_, element) =>
        element?.tagName.toLowerCase() === "li" &&
        (element.textContent?.includes("workspace/docs/答辩提纲.md") ?? false)
      )
    );

    await screen.findByText("Document Preview");

    await userEvent.click(screen.getByRole("button", { name: "Download Artifact" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs/job-1/artifacts/download?path=%2Fjobs%2Fjob-1%2Fworkspace%2Fdocs%2F%E7%AD%94%E8%BE%A9%E6%8F%90%E7%BA%B2.md"
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(anchorRemove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:idea2thesis");

    await userEvent.click(screen.getByRole("button", { name: "Open In Folder" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/jobs/job-1/artifacts/open?path=%2Fjobs%2Fjob-1%2Fworkspace%2Fdocs%2F%E7%AD%94%E8%BE%A9%E6%8F%90%E7%BA%B2.md",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  test("job detail can download the generated workspace archive", async () => {
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
        agents: [],
        artifacts: [],
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
        items: []
      })
    );
    const downloadBlob = new Blob(["workspace zip"], { type: "application/zip" });
    fetchMock.mockResolvedValueOnce(
      new Response(downloadBlob, {
        status: 200,
        headers: {
          "Content-Type": "application/zip"
        }
      })
    );

    const createObjectURL = vi.fn(() => "blob:workspace");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });

    const anchorClick = vi.fn();
    const anchorRemove = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === "a") {
        const anchor = originalCreateElement("a");
        Object.defineProperty(anchor, "click", {
          value: anchorClick
        });
        Object.defineProperty(anchor, "remove", {
          value: anchorRemove
        });
        return anchor;
      }
      return originalCreateElement(tagName);
    });

    render(<App />);

    await screen.findByText("Current job: job-1");
    await userEvent.click(
      screen.getByRole("button", { name: "Download Workspace ZIP" })
    );

    expect(fetchMock).toHaveBeenCalledWith("/jobs/job-1/workspace/archive");
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(anchorRemove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:workspace");
  });

  test("upload form can download a sample brief template", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 0,
        items: []
      })
    );

    const downloadBlob = new Blob(["sample brief"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    fetchMock.mockResolvedValueOnce(
      new Response(downloadBlob, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      })
    );

    const createObjectURL = vi.fn(() => "blob:sample-brief");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true
    });

    const anchorClick = vi.fn();
    const anchorRemove = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === "a") {
        const anchor = originalCreateElement("a");
        Object.defineProperty(anchor, "click", {
          value: anchorClick
        });
        Object.defineProperty(anchor, "remove", {
          value: anchorRemove
        });
        return anchor;
      }
      return originalCreateElement(tagName);
    });

    render(<App />);

    await screen.findByRole("button", { name: "Generate Project" });
    await userEvent.click(
      screen.getByRole("button", { name: "Download Sample Brief" })
    );

    expect(fetchMock).toHaveBeenCalledWith("/templates/sample-brief.docx");
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(anchorRemove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sample-brief");
  });

  test("shows first-run empty state guidance when there are no jobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 0,
        items: []
      })
    );

    render(<App />);

    expect(await screen.findByText("No jobs yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start with a sample brief or upload your own .docx design brief."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("1. Download Sample Brief")).toBeInTheDocument();
    expect(
      screen.getByText("2. Enter API Key, Base URL, and Model")
    ).toBeInTheDocument();
    expect(screen.getByText("3. Click Generate Project")).toBeInTheDocument();
  });

  test("job detail shows repair guidance for blocked jobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 1,
        items: [
          {
            job_id: "job-1",
            brief_title: "Blocked thesis job",
            status: "blocked",
            stage: "blocked",
            final_disposition: "blocked",
            updated_at: "2026-03-26T00:00:00Z",
            created_at: "2026-03-26T00:00:00Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-1",
        brief_title: "Blocked thesis job",
        source_job_id: null,
        status: "blocked",
        stage: "blocked",
        final_disposition: "blocked",
        validation_state: "blocked",
        workspace_path: "/jobs/job-1/workspace",
        input_file_path: "/jobs/job-1/input/brief.docx",
        error_message: "delivery reviewer marked thesis draft as incomplete",
        deleted_at: null,
        created_at: "2026-03-26T00:00:00Z",
        updated_at: "2026-03-26T00:02:00Z",
        agents: [],
        artifacts: [],
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
        items: []
      })
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-1")).toBeInTheDocument();
    expect(screen.getByText("Recommended Next Steps")).toBeInTheDocument();
    expect(
      screen.getByText("This job is blocked and needs manual repair before delivery.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review the generated artifacts, fix the reported issues, and rerun the job."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reported issue: delivery reviewer marked thesis draft as incomplete"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Validation summary: Validation is blocked and manual repair is required.")
    ).toBeInTheDocument();
  });

  test("job detail shows repair guidance for failed jobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 1,
        items: [
          {
            job_id: "job-2",
            brief_title: "Failed thesis job",
            status: "failed",
            stage: "implementation",
            final_disposition: "failed",
            updated_at: "2026-03-26T00:10:00Z",
            created_at: "2026-03-26T00:00:00Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-2",
        brief_title: "Failed thesis job",
        source_job_id: null,
        status: "failed",
        stage: "implementation",
        final_disposition: "failed",
        validation_state: "failed",
        workspace_path: "/jobs/job-2/workspace",
        input_file_path: "/jobs/job-2/input/brief.docx",
        error_message: "python evaluation agent crashed with exit code 1",
        deleted_at: null,
        created_at: "2026-03-26T00:00:00Z",
        updated_at: "2026-03-26T00:12:00Z",
        agents: [],
        artifacts: [],
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
        items: []
      })
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-2")).toBeInTheDocument();
    expect(screen.getByText("Recommended Next Steps")).toBeInTheDocument();
    expect(
      screen.getByText("This job failed before it could produce a deliverable result.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Inspect the failure details, verify runtime settings or generated code, and rerun the job."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reported issue: python evaluation agent crashed with exit code 1")
    ).toBeInTheDocument();
  });

  test("job detail shows repair guidance for interrupted jobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(mockSettingsResponse());
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        total: 1,
        items: [
          {
            job_id: "job-3",
            brief_title: "Interrupted thesis job",
            status: "interrupted",
            stage: "writer",
            final_disposition: "pending",
            updated_at: "2026-03-26T00:20:00Z",
            created_at: "2026-03-26T00:00:00Z"
          }
        ]
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        schema_version: "v1alpha1",
        job_id: "job-3",
        brief_title: "Interrupted thesis job",
        source_job_id: null,
        status: "interrupted",
        stage: "writer",
        final_disposition: "pending",
        validation_state: "pending",
        workspace_path: "/jobs/job-3/workspace",
        input_file_path: "/jobs/job-3/input/brief.docx",
        error_message: "local runtime stopped before writer completed",
        deleted_at: null,
        created_at: "2026-03-26T00:00:00Z",
        updated_at: "2026-03-26T00:22:00Z",
        agents: [],
        artifacts: [],
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
        items: []
      })
    );

    render(<App />);

    expect(await screen.findByText("Current job: job-3")).toBeInTheDocument();
    expect(screen.getByText("Recommended Next Steps")).toBeInTheDocument();
    expect(
      screen.getByText("This job was interrupted before the workflow finished.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check the last completed stage, confirm the environment is ready, and rerun the job."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reported issue: local runtime stopped before writer completed")
    ).toBeInTheDocument();
  });
});
