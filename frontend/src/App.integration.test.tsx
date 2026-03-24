import { render, screen } from "@testing-library/react";

import App from "./App";

test("renders settings and upload controls", () => {
  render(<App />);
  expect(screen.getByLabelText("API Key")).toBeInTheDocument();
  expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toBeInTheDocument();
  expect(screen.getByLabelText("Design Brief (.docx)")).toBeInTheDocument();
  expect(screen.getByText("Job Timeline")).toBeInTheDocument();
  expect(screen.getByText("Agent Status")).toBeInTheDocument();
  expect(screen.getByText("Artifacts")).toBeInTheDocument();
  expect(screen.getByText("Validation Report")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Project" })).toBeInTheDocument();
});
