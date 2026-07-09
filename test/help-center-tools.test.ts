import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseFormat } from "../src/constants.js";

const mocks = vi.hoisted(() => ({
  client: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
  getClient: vi.fn(),
}));

vi.mock("../src/services/chatwoot-client.js", () => ({
  getClient: mocks.getClient,
}));

const {
  listHelpCenterPortals,
  listHelpCenterCategories,
  listHelpCenterArticles,
  getHelpCenterArticle,
  createHelpCenterArticle,
  updateHelpCenterArticle,
  updateHelpCenterCategory,
  deleteHelpCenterCategory,
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

  it("lists help center categories with locale and pagination metadata", async () => {
    mocks.client.GET.mockResolvedValue({
      data: {
        payload: [
          {
            id: 32,
            name: "Downloads & Offline",
            slug: "downloads-and-offline",
            locale: "en",
            description: "Download media and manage offline playback.",
            position: 3,
            account_id: 1,
            icon: "",
            meta: {
              articles_count: 1,
            },
          },
        ],
        meta: {
          current_page: 1,
          categories_count: 11,
        },
      },
      response: { status: 200 },
    });

    const result = await listHelpCenterCategories({
      account_id: 1,
      portal_id: "phyn-help-centre",
      locale: "en",
      page: 1,
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(mocks.client.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/categories",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
          },
          query: {
            locale: "en",
            page: 1,
          },
        },
      }
    );
    expect(result.structuredContent).toEqual({
      categories: [
        expect.objectContaining({
          id: 32,
          name: "Downloads & Offline",
          slug: "downloads-and-offline",
          locale: "en",
          meta: {
            articles_count: 1,
          },
        }),
      ],
      meta: {
        current_page: 1,
        categories_count: 11,
      },
    });
    expect(result.content[0].text).toContain("# Help Center Categories");
  });

  it("lists help center articles with category filtering and metadata", async () => {
    mocks.client.GET.mockResolvedValue({
      data: {
        payload: [
          {
            id: 104,
            slug: "connect-phyn-to-your-jellyfin-server",
            title: "Connect Phyn to your Jellyfin server",
            content: "Add your server and sign in.",
            description: "Add your Jellyfin server to Phyn.",
            status: "draft",
            position: 20,
            account_id: 1,
            updated_at: 1783380641,
            meta: {
              title: "Connect Phyn to your Jellyfin server",
              description: "Add your Jellyfin server to Phyn.",
            },
            category: {
              id: 32,
              name: "Downloads & Offline",
              slug: "downloads-and-offline",
              locale: "en",
            },
            views: null,
            author: {
              id: 1,
              account_id: 1,
              availability_status: "online",
              auto_offline: true,
              confirmed: true,
              email: "agent@example.com",
              provider: "email",
              available_name: "Agent",
              name: "Agent",
              role: "administrator",
              thumbnail: "",
              custom_role_id: null,
            },
          },
        ],
        meta: {
          all_articles_count: 31,
          archived_articles_count: 0,
          articles_count: 31,
          current_page: "1",
          draft_articles_count: 4,
          mine_articles_count: 31,
          published_count: 27,
        },
      },
      response: { status: 200 },
    });

    const result = await listHelpCenterArticles({
      account_id: 1,
      portal_id: "phyn-help-centre",
      locale: "en",
      category_slug: "downloads-and-offline",
      query: "server",
      status: "draft",
      author_id: 1,
      page: 1,
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(mocks.client.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/articles",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
          },
          query: {
            page: 1,
            locale: "en",
            category_slug: "downloads-and-offline",
            query: "server",
            status: "draft",
            author_id: 1,
          },
        },
      }
    );
    expect(result.structuredContent).toEqual({
      articles: [
        expect.objectContaining({
          id: 104,
          title: "Connect Phyn to your Jellyfin server",
          slug: "connect-phyn-to-your-jellyfin-server",
          status: "draft",
          category: {
            id: 32,
            name: "Downloads & Offline",
            slug: "downloads-and-offline",
            locale: "en",
          },
          author: expect.objectContaining({
            id: 1,
            name: "Agent",
          }),
        }),
      ],
      meta: expect.objectContaining({
        articles_count: 31,
        published_count: 27,
      }),
    });
    expect(result.content[0].text).toContain("# Help Center Articles");
  });

  it("gets one full help center article", async () => {
    mocks.client.GET.mockResolvedValue({
      data: {
        payload: {
          id: 106,
          slug: "fix-a-failed-or-stuck-download",
          title: "Fix a failed or stuck download",
          content: "Full article body",
          description: "Troubleshoot failed downloads.",
          status: "published",
          views: 42,
          category: {
            id: 32,
            name: "Downloads & Offline",
            slug: "downloads-and-offline",
            locale: "en",
          },
        },
      },
      response: { status: 200 },
    });

    const result = await getHelpCenterArticle({
      account_id: 1,
      portal_id: "phyn-help-centre",
      article_id: 106,
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(mocks.client.GET).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/articles/{article_id}",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
            article_id: 106,
          },
        },
      }
    );
    expect(result.structuredContent).toEqual({
      article: expect.objectContaining({
        id: 106,
        title: "Fix a failed or stuck download",
        content: "Full article body",
        views: 42,
      }),
    });
    expect(result.content[0].text).toContain("## Content");
    expect(result.content[0].text).toContain("Full article body");
  });

  it("updates help center category metadata", async () => {
    mocks.client.PATCH.mockResolvedValue({
      data: {
        id: 32,
        name: "Downloads",
        slug: "downloads",
        locale: "en",
        description: "Download help.",
        position: 10,
        account_id: 1,
      },
      response: { status: 200 },
    });

    const result = await updateHelpCenterCategory({
      account_id: 1,
      portal_id: "phyn-help-centre",
      category_id: 32,
      name: "Downloads",
      slug: "downloads",
      position: 10,
      description: "Download help.",
    });

    expect(mocks.client.PATCH).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/categories/{category_id}",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
            category_id: 32,
          },
        },
        body: {
          name: "Downloads",
          slug: "downloads",
          position: 10,
          description: "Download help.",
        },
      }
    );
    expect(result.structuredContent).toEqual({
      category: expect.objectContaining({
        id: 32,
        name: "Downloads",
        slug: "downloads",
        position: 10,
      }),
    });
  });

  it("deletes help center categories", async () => {
    mocks.client.DELETE.mockResolvedValue({
      response: { status: 200 },
    });

    const result = await deleteHelpCenterCategory({
      account_id: 1,
      portal_id: "phyn-help-centre",
      category_id: 32,
    });

    expect(mocks.client.DELETE).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/categories/{category_id}",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
            category_id: 32,
          },
        },
      }
    );
    expect(result.structuredContent).toEqual({
      deleted: true,
      category_id: 32,
    });
    expect(result.content[0].text).toContain("does not support archiving");
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
      portal_id: "docs",
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
            id: "docs",
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

  it("updates help center article content", async () => {
    mocks.client.PATCH.mockResolvedValue({
      data: {
        id: 106,
        title: "Fix download issues",
        content: "Updated troubleshooting steps",
        status: "draft",
      },
      response: { status: 200 },
    });

    const result = await updateHelpCenterArticle({
      account_id: 1,
      portal_id: "phyn-help-centre",
      article_id: 106,
      content: "Updated troubleshooting steps",
    });

    expect(mocks.client.PATCH).toHaveBeenCalledWith(
      "/api/v1/accounts/{account_id}/portals/{id}/articles/{article_id}",
      {
        params: {
          path: {
            account_id: 1,
            id: "phyn-help-centre",
            article_id: 106,
          },
        },
        body: {
          content: "Updated troubleshooting steps",
        },
      }
    );
    expect(result.structuredContent).toEqual({
      article: expect.objectContaining({
        id: 106,
        title: "Fix download issues",
        content: "Updated troubleshooting steps",
      }),
    });
  });

  it("rejects empty article updates before calling Chatwoot", async () => {
    const result = await updateHelpCenterArticle({
      account_id: 1,
      portal_id: "docs",
      article_id: 106,
    });

    expect(mocks.client.PATCH).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe(
      "Error: At least one article field must be provided for update."
    );
  });

  it("rejects empty category updates before calling Chatwoot", async () => {
    const result = await updateHelpCenterCategory({
      account_id: 1,
      portal_id: "docs",
      category_id: 32,
    });

    expect(mocks.client.PATCH).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe(
      "Error: At least one category field must be provided for update."
    );
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
