const endpoint = process.env.SOBERU_CATALOG_URL || "http://localhost:3000/api/catalog/sync";
try {
  const response = await fetch(endpoint, { method: "POST", headers: process.env.CATALOG_SYNC_TOKEN ? { authorization: `Bearer ${process.env.CATALOG_SYNC_TOKEN}` } : {} });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  console.log(`KudaGo: ${payload.places} places, ${payload.events} events; synced ${payload.syncedAt}`);
} catch (error) {
  console.error(`Catalog sync failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
