import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Soberu meeting builder", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/i);
  assert.match(html, /<title>Soberu — собраться стало проще<\/title>/i);
  assert.match(html, /Зачем встречаемся\?/);
  assert.match(html, /Парное свидание/);
  assert.match(html, /Москва/);
  assert.match(html, /Петербург/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("keeps recommendation, catalog and local memory layers wired", async () => {
  const [page, recommendation, schema, migration, memory] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/recommendation.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_catalog_intelligence.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/soberu-memory.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const allPrimaryKeys = new Set/);
  assert.match(page, /!allPrimaryKeys\.has\(key\)/);
  assert.match(page, /Учтём то, о чём обычно даже не спрашивают/);
  assert.match(page, /\+ Своя точка/);
  assert.match(recommendation, /export type MeetingSignals/);
  assert.match(recommendation, /signalScore/);
  assert.match(schema, /catalog_places_city_geo_idx/);
  assert.match(schema, /qualityScore/);
  assert.match(migration, /catalog_places_city_quality_idx/);
  assert.match(memory, /templates: MeetingTemplate\[\]/);
  assert.match(memory, /version: 2/);
});
