/**
 * Chatwoot help center management tools
 */

import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { AccountIdSchema, ResponseFormatSchema } from "../schemas/common.js";
import { getClient } from "../services/chatwoot-client.js";
import { handleApiError } from "../services/error-handler.js";

const PortalIdSchema = z.object({
  portal_id: z
    .union([z.string().min(1), z.number().int().positive()])
    .describe("The help center portal slug or numeric identifier"),
});

const PortalConfigSchema = z
  .object({
    allowed_locales: z
      .array(z.string().min(1))
      .optional()
      .describe("Locales enabled for the help center, such as ['en', 'es']"),
    default_locale: z
      .string()
      .min(1)
      .optional()
      .describe("Default locale for the help center, such as 'en'"),
  })
  .strict();

const PortalPayloadSchema = z.object({
  color: z.string().optional().describe("Header color in hex format"),
  custom_domain: z
    .string()
    .optional()
    .describe("Custom domain for the help center"),
  header_text: z.string().optional().describe("Help center header text"),
  homepage_link: z
    .string()
    .url()
    .optional()
    .describe("Link back to the main website or dashboard"),
  name: z.string().min(1).optional().describe("Help center name"),
  page_title: z.string().optional().describe("Browser page title"),
  slug: z.string().min(1).optional().describe("URL slug for the help center"),
  archived: z
    .boolean()
    .optional()
    .describe("Whether the help center is archived"),
  config: PortalConfigSchema.optional().describe("Locale configuration"),
});

/**
 * Schema for listing help center portals
 */
export const ListHelpCenterPortalsSchema = AccountIdSchema.merge(
  ResponseFormatSchema
).strict();

export type ListHelpCenterPortalsInput = z.infer<
  typeof ListHelpCenterPortalsSchema
>;

/**
 * List help center portals in an account
 */
export async function listHelpCenterPortals(
  params: ListHelpCenterPortalsInput
) {
  try {
    const client = getClient();

    const { data, error, response } = await client.GET(
      "/api/v1/accounts/{account_id}/portals",
      {
        params: {
          path: {
            account_id: params.account_id,
          },
        },
      }
    );

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const payload = unwrapPayload(data);
    const portals = Array.isArray(payload) ? payload : [];
    const output = {
      portals: portals.map(formatPortal),
    };

    if (output.portals.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No help center portals found.",
          },
        ],
        structuredContent: output,
      };
    }

    const textContent =
      params.response_format === ResponseFormat.MARKDOWN
        ? formatPortalsMarkdown(output.portals)
        : JSON.stringify(output, null, 2);

    return {
      content: [{ type: "text" as const, text: textContent }],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: handleApiError(error),
        },
      ],
    };
  }
}

/**
 * Schema for creating a help center portal
 */
export const CreateHelpCenterPortalSchema = AccountIdSchema.merge(
  PortalPayloadSchema.extend({
    name: z.string().min(1).describe("Help center name"),
    slug: z.string().min(1).describe("URL slug for the help center"),
  })
).strict();

export type CreateHelpCenterPortalInput = z.infer<
  typeof CreateHelpCenterPortalSchema
>;

/**
 * Create a help center portal
 */
export async function createHelpCenterPortal(
  params: CreateHelpCenterPortalInput
) {
  try {
    const client = getClient();
    const { account_id, ...body } = params;

    const { data, error, response } = await client.POST(
      "/api/v1/accounts/{account_id}/portals",
      {
        params: {
          path: {
            account_id,
          },
        },
        body: body as any,
      }
    );

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const payload = unwrapPayload(data);
    const portal = formatPortal(Array.isArray(payload) ? payload[0] : payload);
    const output = { portal };

    return {
      content: [
        {
          type: "text" as const,
          text: `Help center portal '${portal.name || params.name}' created successfully.`,
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: handleApiError(error),
        },
      ],
    };
  }
}

/**
 * Schema for updating a help center portal
 */
export const UpdateHelpCenterPortalSchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(PortalPayloadSchema)
  .strict();

export type UpdateHelpCenterPortalInput = z.infer<
  typeof UpdateHelpCenterPortalSchema
>;

/**
 * Update a help center portal
 */
export async function updateHelpCenterPortal(
  params: UpdateHelpCenterPortalInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, ...body } = params;

    if (!hasDefinedValue(body)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: At least one portal field must be provided for update.",
          },
        ],
      };
    }

    const { data, error, response } = await client.PATCH(
      "/api/v1/accounts/{account_id}/portals/{id}",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
          },
        },
        body: body as any,
      }
    );

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const portal = formatPortal(unwrapPayload(data));
    const output = { portal };

    return {
      content: [
        {
          type: "text" as const,
          text: `Help center portal '${portal.name || portal_id}' updated successfully.`,
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: handleApiError(error),
        },
      ],
    };
  }
}

/**
 * Schema for creating a help center category
 */
export const CreateHelpCenterCategorySchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(
    z.object({
      name: z.string().min(1).describe("Category name"),
      description: z.string().optional().describe("Category description"),
      position: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Category sort position"),
      slug: z.string().min(1).optional().describe("Category URL slug"),
      locale: z.string().min(1).optional().describe("Category locale"),
      icon: z.string().optional().describe("Category icon as a string"),
      parent_category_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Parent category ID"),
      associated_category_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Associated category ID for translations or related categories"),
    })
  )
  .strict();

export type CreateHelpCenterCategoryInput = z.infer<
  typeof CreateHelpCenterCategorySchema
>;

/**
 * Create a help center category in a portal
 */
export async function createHelpCenterCategory(
  params: CreateHelpCenterCategoryInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, ...body } = params;

    const { data, error, response } = await client.POST(
      "/api/v1/accounts/{account_id}/portals/{id}/categories",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
          },
        },
        body: body as any,
      }
    );

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const category = formatCategory(unwrapPayload(data));
    const output = { category };

    return {
      content: [
        {
          type: "text" as const,
          text: `Help center category '${category.name || params.name}' created successfully.`,
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: handleApiError(error),
        },
      ],
    };
  }
}

const ArticleStatusSchema = z
  .enum(["draft", "published", "archived"])
  .default("draft");

const ArticleStatusValue = {
  draft: 0,
  published: 1,
  archived: 2,
} as const;

/**
 * Schema for creating a help center article
 */
export const CreateHelpCenterArticleSchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(
    z.object({
      title: z.string().min(1).describe("Article title"),
      content: z.string().min(1).describe("Article body content"),
      slug: z.string().min(1).optional().describe("Article URL slug"),
      position: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Article sort position within the category"),
      description: z.string().optional().describe("Article description"),
      category_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Category ID for the article"),
      author_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Author agent ID"),
      associated_article_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Associated article ID for translations or related articles"),
      status: ArticleStatusSchema.describe("Article status"),
      locale: z.string().min(1).optional().describe("Article locale"),
      meta: z
        .record(z.unknown())
        .optional()
        .describe("Search metadata such as tags, title, or description"),
    })
  )
  .strict();

export type CreateHelpCenterArticleInput = z.infer<
  typeof CreateHelpCenterArticleSchema
>;

/**
 * Create a help center article in a portal
 */
export async function createHelpCenterArticle(
  params: CreateHelpCenterArticleInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, status, ...body } = params;

    const { data, error, response } = await client.POST(
      "/api/v1/accounts/{account_id}/portals/{id}/articles",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
          },
        },
        body: {
          ...body,
          status: ArticleStatusValue[status],
        } as any,
      }
    );

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const article = formatArticle(unwrapPayload(data));
    const output = { article };

    return {
      content: [
        {
          type: "text" as const,
          text: `Help center article '${article.title || params.title}' created successfully.`,
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: handleApiError(error),
        },
      ],
    };
  }
}

function formatPortal(portal: any) {
  return {
    id: portal?.id,
    name: portal?.name,
    slug: portal?.slug,
    archived: portal?.archived,
    color: portal?.color,
    custom_domain: portal?.custom_domain,
    header_text: portal?.header_text,
    homepage_link: portal?.homepage_link,
    page_title: portal?.page_title,
    account_id: portal?.account_id,
    logo_url: portal?.logo?.file_url,
    inbox: portal?.inbox
      ? {
          id: portal.inbox.id,
          name: portal.inbox.name,
          channel_type: portal.inbox.channel_type,
          website_url: portal.inbox.website_url,
        }
      : null,
    config: portal?.config || {},
    meta: portal?.meta || {},
  };
}

function unwrapPayload(data: any) {
  return data?.payload ?? data?.data?.payload ?? data;
}

function hasDefinedValue(value: Record<string, unknown>) {
  return Object.values(value).some((item) => item !== undefined);
}

function formatCategory(category: any) {
  return {
    id: category?.id,
    name: category?.name,
    slug: category?.slug,
    description: category?.description,
    locale: category?.locale,
    position: category?.position,
    portal_id: category?.portal_id,
    account_id: category?.account_id,
    parent_category_id: category?.parent_category_id,
    associated_category_id: category?.associated_category_id,
  };
}

function formatArticle(article: any) {
  return {
    id: article?.id,
    title: article?.title,
    slug: article?.slug,
    content: article?.content,
    status: article?.status,
    position: article?.position,
    views: article?.views,
    portal_id: article?.portal_id,
    account_id: article?.account_id,
    author_id: article?.author_id,
    category_id: article?.category_id,
    folder_id: article?.folder_id,
    associated_article_id: article?.associated_article_id,
    meta: article?.meta || {},
  };
}

function formatPortalsMarkdown(portals: ReturnType<typeof formatPortal>[]) {
  const lines = ["# Help Center Portals", "", `Total: ${portals.length}`, ""];

  for (const portal of portals) {
    lines.push(`## ${portal.name || "Untitled portal"}`);
    lines.push(`- **ID**: ${portal.id ?? "N/A"}`);
    lines.push(`- **Slug**: ${portal.slug || "N/A"}`);
    lines.push(`- **Archived**: ${portal.archived ? "Yes" : "No"}`);
    lines.push(`- **Custom Domain**: ${portal.custom_domain || "N/A"}`);
    lines.push(
      `- **Articles**: ${portal.meta?.all_articles_count ?? "N/A"} total, ${portal.meta?.published_count ?? "N/A"} published`
    );
    lines.push(`- **Categories**: ${portal.meta?.categories_count ?? "N/A"}`);
    lines.push(`- **Default Locale**: ${portal.meta?.default_locale || "N/A"}`);
    lines.push("");
  }

  return lines.join("\n");
}
