import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseFormat } from "../src/constants.js";

const mocks = vi.hoisted(() => ({
  client: {
    POST: vi.fn(),
  },
  getClient: vi.fn(),
}));

vi.mock("../src/services/chatwoot-client.js", () => ({
  getClient: mocks.getClient,
}));

const { uploadFile } = await import("../src/tools/uploads.js");

describe("Upload MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClient.mockReturnValue(mocks.client);
  });

  it("uploads a local file as multipart form data", async () => {
    mocks.client.POST.mockResolvedValue({
      data: {
        file_url: "https://chatwoot.example/rails/active_storage/blobs/file.png",
        blob_id: "signed-blob-id",
      },
      response: { status: 200 },
    });

    const result = await uploadFile({
      account_id: 1,
      file_path: new URL("../package.json", import.meta.url).pathname,
      filename: "package.json",
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(mocks.client.POST).toHaveBeenCalledOnce();
    const [path, options] = mocks.client.POST.mock.calls[0];
    expect(path).toBe("/api/v1/accounts/{account_id}/upload");
    expect(options.params).toEqual({
      path: {
        account_id: 1,
      },
    });
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.structuredContent).toEqual({
      upload: {
        file_url: "https://chatwoot.example/rails/active_storage/blobs/file.png",
        blob_id: "signed-blob-id",
      },
    });
    expect(result.content[0].text).toContain("![](https://chatwoot.example");
  });
});
