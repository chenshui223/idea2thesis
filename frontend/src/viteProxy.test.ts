// @vitest-environment node

import config from "../vite.config";

describe("vite dev proxy", () => {
  test("proxies the sample brief template endpoint to the backend", () => {
    expect(config.server?.proxy).toMatchObject({
      "/templates": "http://127.0.0.1:8000"
    });
  });
});
