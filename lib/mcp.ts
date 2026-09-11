import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { searchDomain, type DomainSearchResult } from "@/lib/search";

const quoteSchema = z.object({
  id: z.string(),
  name: z.string(),
  register: z.number().nullable(),
  renew: z.number().nullable(),
  transfer: z.number().nullable(),
  currency: z.literal("BRL"),
  originalCurrency: z.enum(["USD", "EUR", "BRL"]),
  originalRegister: z.number().nullable(),
  originalRenew: z.number().nullable(),
  originalTransfer: z.number().nullable(),
  brl: z.number().nullable(),
  live: z.boolean(),
  buyUrl: z.string().url(),
  note: z.string().optional(),
});

const searchOutputSchema = {
  domain: z.string(),
  available: z.boolean().nullable(),
  cheapest: z.string().nullable(),
  quotes: z.array(quoteSchema),
  fx: z.object({
    usdBrl: z.number(),
    eurBrl: z.number(),
    source: z.string(),
    at: z.string(),
  }),
};

function summarize(result: DomainSearchResult) {
  if (result.available === false) {
    return `${result.domain} is already registered.`;
  }

  const cheapest = result.quotes.find(
    (quote) => quote.id === result.cheapest,
  );
  const availability =
    result.available === true ? "is available" : "may be available";

  if (cheapest?.register == null) {
    return `${result.domain} ${availability}, but no registration price was found.`;
  }

  return `${result.domain} ${availability}. The lowest registration price found is BRL ${cheapest.register.toFixed(2)} at ${cheapest.name}.`;
}

export function createMcpServer() {
  const server = new McpServer({
    name: "dominio.cheap",
    version: "0.1.0",
  });

  server.registerTool(
    "search_domain",
    {
      title: "Search and compare a domain",
      description:
        "Check domain availability and compare one-year registration, renewal, and transfer prices across registrars. Prices are normalized to BRL and also include their original currencies.",
      inputSchema: {
        domain: z
          .string()
          .min(1)
          .max(2048)
          .describe("Domain name or URL, for example example.com"),
      },
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain }) => {
      const result = await searchDomain(domain);

      if (!result) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Invalid domain. Use a value such as example.com.",
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: summarize(result) }],
        structuredContent: result,
      };
    },
  );

  return server;
}
