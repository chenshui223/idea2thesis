import { render, screen } from "@testing-library/react";

import App from "./App";

test("renders generator heading", () => {
  render(<App />);
  expect(screen.getByText("idea2thesis")).toBeInTheDocument();
  expect(screen.getByText("One-click thesis project generation")).toBeInTheDocument();
  expect(screen.getByText("Job Timeline")).toBeInTheDocument();
  expect(screen.getByText("Agent Status")).toBeInTheDocument();
  expect(screen.getByText("Artifacts")).toBeInTheDocument();
  expect(screen.getByText("Validation Report")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Project" })).toBeInTheDocument();
});
