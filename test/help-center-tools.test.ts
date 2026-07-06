import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseFormat } from "../src/constants.js";

const mocks = vi.hoisted(() => ({
  client: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
  getClient: vi.fn(),
}));

vi.mock("../src/services/chatwoot-client.js", () => ({
  getClient: mocks.getClient,
}));

const {
  listHelpCenterPortals,
  createHelpCenterArticle,
  updateHelpCenterPortal,
} = await import("../src/tools/help-center.js");

describe("Help center MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClient.mockReturnValue(mocks.client);
  });

  it("lists help center portals with structured content", async () => {
    mocks.client.GET.mockResolvedValue({
      data: {
        payload: [
          {
            id: 7,
            name: "Docs",
            slug: "docs",
            archived: false,
            custom_domain: "help.example.com",
            meta: {
              all_articles_count: 12,
              published_count: 10,
              categories_count: 3,
              default_locale: "en",
            },
          },
        ],
      },
      response: { status: 200 },
    });

    const result = await listHelpCenterPortals({
      account_id: 1,
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(mocks.client.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals",
      {
        params: {
          path: {
            account_id: 1,
          },
        },
      }
    );
    expect(result.structuredContent).toEqual({
      portals: [
        expect.objectContaining({
          id: 7,
          name: "Docs",
          slug: "docs",
          meta: expect.objectContaining({
            all_articles_count: 12,
            published_count: 10,
          }),
        }),
      ],
    });
    expect(result.content[0].text).toContain("# Help Center Portals");
  });

  it("creates articles with numeric Chatwoot status values", async () => {
    mocks.client.POST.mockResolvedValue({
      data: {
        id: 44,
        title: "Install guide",
        status: "published",
        portal_id: 9,
      },
      response: { status: 200 },
    });

    const result = await createHelpCenterArticle({
      account_id: 1,
      portal_id: 9,
      title: "Install guide",
      content: "Install steps",
      status: "published",
      locale: "en",
    });

    expect(mocks.client.POST).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/articles",
      {
        params: {
          path: {
            account_id: 1,
            id: "9",
          },
        },
        body: {
          title: "Install guide",
          content: "Install steps",
          locale: "en",
          status: 1,
        },
      }
    );
    expect(result.structuredContent).toEqual({
      article: expect.objectContaining({
        id: 44,
        title: "Install guide",
        status: "published",
      }),
    });
  });

  it("rejects empty portal updates before calling Chatwoot", async () => {
    const result = await updateHelpCenterPortal({
      account_id: 1,
      portal_id: "docs",
    });

    expect(mocks.client.PATCH).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe(
      "Error: At least one portal field must be provided for update."
    );
  });
});
