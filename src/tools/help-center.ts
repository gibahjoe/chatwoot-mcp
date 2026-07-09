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
    .string()
    .min(1)
    .describe("The help center portal slug. Chatwoot names this path parameter 'id'."),
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
 * Schema for listing help center categories
 */
export const ListHelpCenterCategoriesSchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(ResponseFormatSchema)
  .extend({
    locale: z.string().min(1).optional().describe("Category locale filter"),
    page: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("Page number for pagination"),
  })
  .strict();

export type ListHelpCenterCategoriesInput = z.infer<
  typeof ListHelpCenterCategoriesSchema
>;

/**
 * List help center categories in a portal
 */
export async function listHelpCenterCategories(
  params: ListHelpCenterCategoriesInput
) {
  try {
    const client = getClient();

    const { data, error, response } = await client.GET(
      "/api/v1/accounts/{account_id}/portals/{id}/categories",
      {
        params: {
          path: {
            account_id: params.account_id,
            id: String(params.portal_id),
          },
          query: {
            locale: params.locale,
            page: params.page,
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

    const output = {
      categories: ((data as any).payload || []).map(formatCategory),
      meta: (data as any).meta || {},
    };

    if (output.categories.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No help center categories found.",
          },
        ],
        structuredContent: output,
      };
    }

    const textContent =
      params.response_format === ResponseFormat.MARKDOWN
        ? formatCategoriesMarkdown(output.categories, output.meta)
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
 * Schema for updating a help center category
 */
export const UpdateHelpCenterCategorySchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(
    z.object({
      category_id: z
        .number()
        .int()
        .positive()
        .describe("Numeric ID of the category to update"),
      name: z.string().min(1).optional().describe("Category name"),
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

export type UpdateHelpCenterCategoryInput = z.infer<
  typeof UpdateHelpCenterCategorySchema
>;

/**
 * Schema for deleting a help center category
 */
export const DeleteHelpCenterCategorySchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(
    z.object({
      category_id: z
        .number()
        .int()
        .positive()
        .describe("Numeric ID of the category to delete"),
    })
  )
  .strict();

export type DeleteHelpCenterCategoryInput = z.infer<
  typeof DeleteHelpCenterCategorySchema
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

/**
 * Update a help center category in a portal
 */
export async function updateHelpCenterCategory(
  params: UpdateHelpCenterCategoryInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, category_id, ...body } = params;

    if (!hasDefinedValue(body)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: At least one category field must be provided for update.",
          },
        ],
      };
    }

    const { data, error, response } = await client.PATCH(
      "/api/v1/accounts/{account_id}/portals/{id}/categories/{category_id}",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
            category_id,
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
          text: `Help center category '${category.name || category_id}' updated successfully.`,
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
 * Delete a help center category from a portal
 */
export async function deleteHelpCenterCategory(
  params: DeleteHelpCenterCategoryInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, category_id } = params;

    const { error, response } = await client.DELETE(
      "/api/v1/accounts/{account_id}/portals/{id}/categories/{category_id}",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
            category_id,
          },
        },
      }
    );

    if (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: handleApiError({ response, error }),
          },
        ],
      };
    }

    const output = { deleted: true, category_id };

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Help center category ${category_id} deleted successfully. ` +
            "Chatwoot does not support archiving categories; existing articles are left uncategorized.",
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
 * Schema for listing help center articles
 */
export const ListHelpCenterArticlesSchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(ResponseFormatSchema)
  .merge(
    z.object({
      locale: z.string().min(1).optional().describe("Article locale filter"),
      category_slug: z
        .string()
        .optional()
        .describe("Category slug filter. Omit or leave blank to list all articles."),
      query: z
        .string()
        .optional()
        .describe("Full-text search query across article title, description, and content"),
      status: z
        .enum(["draft", "published", "archived"])
        .optional()
        .describe("Article status filter"),
      author_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Filter articles by author user ID"),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
    })
  )
  .strict();

export type ListHelpCenterArticlesInput = z.infer<
  typeof ListHelpCenterArticlesSchema
>;

/**
 * Schema for getting a help center article
 */
export const GetHelpCenterArticleSchema = AccountIdSchema.merge(PortalIdSchema)
  .merge(ResponseFormatSchema)
  .merge(
    z.object({
      article_id: z
        .number()
        .int()
        .positive()
        .describe("Numeric ID of the article to fetch"),
    })
  )
  .strict();

export type GetHelpCenterArticleInput = z.infer<
  typeof GetHelpCenterArticleSchema
>;

/**
 * List help center articles in a portal
 */
export async function listHelpCenterArticles(
  params: ListHelpCenterArticlesInput
) {
  try {
    const client = getClient();

    const { data, error, response } = await client.GET(
      "/api/v1/accounts/{account_id}/portals/{id}/articles",
      {
        params: {
          path: {
            account_id: params.account_id,
            id: String(params.portal_id),
          },
          query: {
            page: params.page,
            locale: params.locale,
            category_slug: params.category_slug || undefined,
            query: params.query,
            status: params.status,
            author_id: params.author_id,
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

    const output = {
      articles: ((data as any).payload || []).map(formatArticle),
      meta: (data as any).meta || {},
    };

    if (output.articles.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No help center articles found.",
          },
        ],
        structuredContent: output,
      };
    }

    const textContent =
      params.response_format === ResponseFormat.MARKDOWN
        ? formatArticlesMarkdown(output.articles, output.meta)
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
 * Get a single help center article in a portal
 */
export async function getHelpCenterArticle(params: GetHelpCenterArticleInput) {
  try {
    const client = getClient();

    const { data, error, response } = await client.GET(
      "/api/v1/accounts/{account_id}/portals/{id}/articles/{article_id}",
      {
        params: {
          path: {
            account_id: params.account_id,
            id: String(params.portal_id),
            article_id: params.article_id,
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

    const article = formatArticle(unwrapPayload(data));
    const output = { article };

    const textContent =
      params.response_format === ResponseFormat.MARKDOWN
        ? formatArticleMarkdown(article)
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
 * Schema for updating a help center article
 */
export const UpdateHelpCenterArticleSchema = AccountIdSchema.merge(
  PortalIdSchema
)
  .merge(
    z.object({
      article_id: z
        .number()
        .int()
        .positive()
        .describe("Numeric ID of the article to update"),
      title: z.string().min(1).optional().describe("Article title"),
      content: z.string().min(1).optional().describe("Article body content"),
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
      status: z
        .enum(["draft", "published", "archived"])
        .optional()
        .describe("Article status"),
      locale: z.string().min(1).optional().describe("Article locale"),
      meta: z
        .record(z.unknown())
        .optional()
        .describe("Search metadata such as tags, title, or description"),
    })
  )
  .strict();

export type UpdateHelpCenterArticleInput = z.infer<
  typeof UpdateHelpCenterArticleSchema
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

/**
 * Update a help center article in a portal
 */
export async function updateHelpCenterArticle(
  params: UpdateHelpCenterArticleInput
) {
  try {
    const client = getClient();
    const { account_id, portal_id, article_id, status, ...body } = params;
    const updateBody = {
      ...body,
      ...(status ? { status: ArticleStatusValue[status] } : {}),
    };

    if (!hasDefinedValue(updateBody)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: At least one article field must be provided for update.",
          },
        ],
      };
    }

    const { data, error, response } = await client.PATCH(
      "/api/v1/accounts/{account_id}/portals/{id}/articles/{article_id}",
      {
        params: {
          path: {
            account_id,
            id: String(portal_id),
            article_id,
          },
        },
        body: updateBody as any,
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
          text: `Help center article '${article.title || article_id}' updated successfully.`,
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
    icon: category?.icon,
    portal_id: category?.portal_id,
    account_id: category?.account_id,
    parent_category_id: category?.parent_category_id,
    associated_category_id: category?.associated_category_id,
    meta: category?.meta || {},
  };
}

function formatArticle(article: any) {
  return {
    id: article?.id,
    title: article?.title,
    slug: article?.slug,
    content: article?.content,
    description: article?.description,
    status: article?.status,
    position: article?.position,
    views: article?.views,
    updated_at: article?.updated_at,
    portal_id: article?.portal_id,
    account_id: article?.account_id,
    author_id: article?.author_id,
    author: article?.author
      ? {
          id: article.author.id,
          name: article.author.name,
          available_name: article.author.available_name,
          email: article.author.email,
          role: article.author.role,
        }
      : null,
    category_id: article?.category_id,
    category: article?.category
      ? {
          id: article.category.id,
          name: article.category.name,
          slug: article.category.slug,
          locale: article.category.locale,
        }
      : null,
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

function formatArticlesMarkdown(
  articles: ReturnType<typeof formatArticle>[],
  meta: any
) {
  const lines = [
    "# Help Center Articles",
    "",
    `Total: ${meta?.articles_count ?? articles.length}`,
    `Page: ${meta?.current_page ?? 1}`,
    `Published: ${meta?.published_count ?? "N/A"}`,
    `Drafts: ${meta?.draft_articles_count ?? "N/A"}`,
    "",
  ];

  for (const article of articles) {
    lines.push(`## ${article.title || "Untitled article"}`);
    lines.push(`- **ID**: ${article.id ?? "N/A"}`);
    lines.push(`- **Slug**: ${article.slug || "N/A"}`);
    lines.push(`- **Status**: ${article.status || "N/A"}`);
    lines.push(`- **Position**: ${article.position ?? "N/A"}`);
    lines.push(`- **Views**: ${article.views ?? "N/A"}`);
    lines.push(`- **Updated At**: ${article.updated_at ?? "N/A"}`);
    lines.push(
      `- **Category**: ${article.category?.name || article.category?.slug || "N/A"}`
    );
    if (article.description) {
      lines.push(`- **Description**: ${article.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatArticleMarkdown(article: ReturnType<typeof formatArticle>) {
  const lines = [`# ${article.title || "Untitled article"}`, ""];
  lines.push(`- **ID**: ${article.id ?? "N/A"}`);
  lines.push(`- **Slug**: ${article.slug || "N/A"}`);
  lines.push(`- **Status**: ${article.status || "N/A"}`);
  lines.push(`- **Position**: ${article.position ?? "N/A"}`);
  lines.push(`- **Views**: ${article.views ?? "N/A"}`);
  lines.push(`- **Updated At**: ${article.updated_at ?? "N/A"}`);
  lines.push(
    `- **Category**: ${article.category?.name || article.category?.slug || "N/A"}`
  );
  if (article.description) {
    lines.push(`- **Description**: ${article.description}`);
  }
  lines.push("");
  lines.push("## Content");
  lines.push("");
  lines.push(article.content || "");

  return lines.join("\n");
}

function formatCategoriesMarkdown(
  categories: ReturnType<typeof formatCategory>[],
  meta: any
) {
  const lines = [
    "# Help Center Categories",
    "",
    `Total: ${meta?.categories_count ?? categories.length}`,
    `Page: ${meta?.current_page ?? 1}`,
    "",
  ];

  for (const category of categories) {
    lines.push(`## ${category.name || "Untitled category"}`);
    lines.push(`- **ID**: ${category.id ?? "N/A"}`);
    lines.push(`- **Slug**: ${category.slug || "N/A"}`);
    lines.push(`- **Locale**: ${category.locale || "N/A"}`);
    lines.push(`- **Position**: ${category.position ?? "N/A"}`);
    lines.push(`- **Icon**: ${category.icon || "N/A"}`);
    lines.push(`- **Articles**: ${category.meta?.articles_count ?? "N/A"}`);
    if (category.description) {
      lines.push(`- **Description**: ${category.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
