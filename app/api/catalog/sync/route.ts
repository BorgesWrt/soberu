import { env } from "cloudflare:workers";
import { syncKudaGoCatalog } from "../../../lib/catalog-sync";

export async function POST(request: Request) {
  const runtime = env as unknown as { DB?: D1Database; CATALOG_SYNC_TOKEN?: string };
  if (!runtime.DB) return Response.json({ error: "D1 binding DB is unavailable" }, { status: 503 });
  const url = new URL(request.url);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!isLocal && (!runtime.CATALOG_SYNC_TOKEN || token !== runtime.CATALOG_SYNC_TOKEN)) {
    return Response.json({ error: "Catalog sync is restricted" }, { status: 401 });
  }
  try {
    return Response.json(await syncKudaGoCatalog(runtime.DB));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Catalog sync failed" }, { status: 502 });
  }
}
