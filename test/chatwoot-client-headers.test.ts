import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {
    GET: vi.fn(),
    POST: vi.fn(),
    use: vi.fn(),
  },
  createClient: vi.fn(),
  loadTokens: vi.fn(),
  saveTokens: vi.fn(),
  loginToChatwoot: vi.fn(),
  areTokensValid: vi.fn(),
}));

vi.mock("openapi-fetch", () => ({
  default: mocks.createClient,
}));

vi.mock("../src/services/token-cache.js", () => ({
  loadTokens: mocks.loadTokens,
  saveTokens: mocks.saveTokens,
}));

vi.mock("../src/services/chatwoot-auth.js", () => ({
  loginToChatwoot: mocks.loginToChatwoot,
  areTokensValid: mocks.areTokensValid,
}));

const { createChatwootClient } = await import(
  "../src/services/chatwoot-client.js"
);

describe("Chatwoot client auth headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue(mocks.client);
    mocks.areTokensValid.mockReturnValue(true);
  });

  it("adds API access token headers to requests", async () => {
    await createChatwootClient({
      baseUrl: "https://chatwoot.example",
      apiAccessToken: "api-token-123",
    });

    expect(mocks.createClient).toHaveBeenCalledWith({
      baseUrl: "https://chatwoot.example",
    });
    expect(mocks.client.use).toHaveBeenCalledOnce();

    const middleware = mocks.client.use.mock.calls[0][0];
    const request = new Request("https://chatwoot.example/api/v1/accounts");

    await middleware.onRequest({ request });

    expect(request.headers.get("api_access_token")).toBe("api-token-123");
    expect(request.headers.get("Content-Type")).toBe("application/json");
  });

  it("preserves multipart content type for API token requests", async () => {
    await createChatwootClient({
      baseUrl: "https://chatwoot.example",
      apiAccessToken: "api-token-123",
    });

    const middleware = mocks.client.use.mock.calls[0][0];
    const formData = new FormData();
    formData.append("attachment", new Blob(["file"]), "file.txt");
    const request = new Request("https://chatwoot.example/api/v1/accounts/1/upload", {
      method: "POST",
      body: formData,
    });

    await middleware.onRequest({ request });

    expect(request.headers.get("api_access_token")).toBe("api-token-123");
    expect(request.headers.get("Content-Type")).toContain("multipart/form-data");
  });

  it("adds cached JWT auth headers to requests", async () => {
    mocks.loadTokens.mockResolvedValue({
      uid: "agent@example.com",
      client: "jwt-client",
      accessToken: "jwt-token",
      expiry: "9999999999",
    });

    await createChatwootClient({
      baseUrl: "https://chatwoot.example",
      email: "agent@example.com",
    });

    expect(mocks.loadTokens).toHaveBeenCalledWith(
      "https://chatwoot.example",
      "agent@example.com"
    );
    expect(mocks.loginToChatwoot).not.toHaveBeenCalled();
    expect(mocks.client.use).toHaveBeenCalledOnce();

    const middleware = mocks.client.use.mock.calls[0][0];
    const request = new Request("https://chatwoot.example/api/v1/accounts");

    await middleware.onRequest({ request });

    expect(request.headers.get("uid")).toBe("agent@example.com");
    expect(request.headers.get("client")).toBe("jwt-client");
    expect(request.headers.get("access-token")).toBe("jwt-token");
    expect(request.headers.get("expiry")).toBe("9999999999");
    expect(request.headers.get("token-type")).toBe("Bearer");
    expect(request.headers.get("Content-Type")).toBe("application/json");
  });
});
