import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import App from "./App";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockStartupFetch() {
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
  return fetchMock;
}

test("renders generator heading in Chinese without act warnings during startup", async () => {
  const fetchMock = mockStartupFetch();
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<App />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/settings");
    expect(fetchMock).toHaveBeenCalledWith("/jobs?sort=updated_desc");
  });

  expect(screen.getByText("idea2thesis")).toBeInTheDocument();
  expect(screen.getByText("一键生成毕业设计项目")).toBeInTheDocument();
  expect(screen.getByText("快速开始")).toBeInTheDocument();
  expect(screen.getByText("API Key 不会被保存。")).toBeInTheDocument();
  expect(screen.getByText("任务时间线")).toBeInTheDocument();
  expect(screen.getByText("等待你上传第一份 .docx 设计书。")).toBeInTheDocument();
  expect(screen.getByText("Agent 状态")).toBeInTheDocument();
  expect(screen.getByText("产物列表")).toBeInTheDocument();
  expect(screen.getByText("校验报告")).toBeInTheDocument();
  expect(
    screen.getByText(
      "建议操作：保持当前页面开启，后台 worker 会自动拾取排队中的任务。"
    )
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成项目" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("not wrapped in act")
  );
});

test("toggles to English and persists locale preference", async () => {
  const fetchMock = mockStartupFetch();
  const user = userEvent.setup();
  const { unmount } = render(<App />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/settings");
    expect(fetchMock).toHaveBeenCalledWith("/jobs?sort=updated_desc");
  });

  await user.click(screen.getByRole("button", { name: "EN" }));

  expect(screen.getByText("One-click thesis project generation")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "中文" })).toBeInTheDocument();
  expect(window.localStorage.getItem("idea2thesis.locale")).toBe("\"en\"");

  unmount();

  mockStartupFetch();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("One-click thesis project generation")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "中文" })).toBeInTheDocument();
});
