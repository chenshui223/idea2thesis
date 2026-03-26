import { render, screen } from "@testing-library/react";

import { JobTimeline } from "./JobTimeline";

describe("JobTimeline", () => {
  test("renders user-facing guidance for backend runtime stage keys", () => {
    render(<JobTimeline stage="verification_running" />);

    expect(screen.getByText("Current stage: Local Verification")).toBeInTheDocument();
    expect(screen.getByText("Pipeline status: Verifying deliverables")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The generated workspace and thesis draft are being checked before final delivery."
      )
    ).toBeInTheDocument();
  });

  test("maps legacy bare agent stage keys to readable labels", () => {
    render(<JobTimeline stage="writer" />);

    expect(screen.getByText("Current stage: Writer")).toBeInTheDocument();
    expect(screen.getByText("Pipeline status: Writing the thesis draft")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The writer agent is drafting the thesis first draft and repository documents."
      )
    ).toBeInTheDocument();
  });
});
