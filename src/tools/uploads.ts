/**
 * Chatwoot file upload tools
 */

import { basename, extname } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { AccountIdSchema, ResponseFormatSchema } from "../schemas/common.js";
import { getClient } from "../services/chatwoot-client.js";
import { handleApiError } from "../services/error-handler.js";

/**
 * Schema for uploading a file to Chatwoot
 */
export const UploadFileSchema = AccountIdSchema.merge(ResponseFormatSchema)
  .merge(
    z.object({
      file_path: z.string().min(1).describe("Local path to the file to upload"),
      filename: z
        .string()
        .min(1)
        .optional()
        .describe("Optional filename to send to Chatwoot"),
      content_type: z
        .string()
        .min(1)
        .optional()
        .describe("Optional MIME type, such as image/png"),
    })
  )
  .strict();

export type UploadFileInput = z.infer<typeof UploadFileSchema>;

/**
 * Upload a file to Chatwoot
 */
export async function uploadFile(params: UploadFileInput) {
  try {
    const fileStat = await stat(params.file_path);
    if (!fileStat.isFile()) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: '${params.file_path}' is not a file.`,
          },
        ],
      };
    }

    const fileBuffer = await readFile(params.file_path);
    const filename = params.filename || basename(params.file_path);
    const contentType = params.content_type || inferContentType(filename);
    const formData = new FormData();
    formData.append(
      "attachment",
      new Blob([fileBuffer], { type: contentType }),
      filename
    );

    const client = getClient();
    const { data, error, response } = await client.POST(
      "/api/v1/accounts/{account_id}/upload",
      {
        params: {
          path: {
            account_id: params.account_id,
          },
        },
        body: formData as any,
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

    const upload = formatUpload(data);
    const output = { upload };

    const textContent =
      params.response_format === ResponseFormat.MARKDOWN
        ? formatUploadMarkdown(upload)
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

function formatUpload(upload: any) {
  return {
    file_url: upload?.file_url,
    blob_id: upload?.blob_id,
  };
}

function formatUploadMarkdown(upload: ReturnType<typeof formatUpload>) {
  const lines = ["# Chatwoot Upload", ""];
  lines.push(`- **File URL**: ${upload.file_url || "N/A"}`);
  lines.push(`- **Blob ID**: ${upload.blob_id || "N/A"}`);
  if (upload.file_url) {
    lines.push("");
    lines.push("Use this Markdown in help center article content:");
    lines.push("");
    lines.push(`![](${upload.file_url})`);
  }
  return lines.join("\n");
}

function inferContentType(filename: string) {
  switch (extname(filename).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
