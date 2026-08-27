import { env } from "cloudflare:workers";

type PlaceRow = { id: string; name: string; description: string | null; address: string | null; subway: string | null; lat: number; lon: number; categories: string; website: string | null; image_url: string | null };
type EventRow = PlaceRow & { event_id: string; title: string; event_description: string | null; starts_at: number; ends_at: number | null; price_text: string | null; is_free: number; event_website: string | null; event_image: string | null; event_categories: string };

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad; const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseList(value: string | null) {
  try { return JSON.parse(value || "[]") as string[]; } catch { return []; }
}

export async function GET(request: Request) {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return Response.json({ places: [], events: [], status: "unavailable" });
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat") || 59.9388); const lon = Number(params.get("lon") || 30.3146);
  const from = Number(params.get("from") || Math.floor(Date.now() / 1000));
  const to = Number(params.get("to") || from + 14 * 24 * 60 * 60);
  const wanted = (params.get("categories") || "").toLowerCase().split(",").filter(Boolean);
  const limit = Math.min(100, Math.max(3, Number(params.get("limit") || 40)));
  try {
    const [placesResult, eventsResult, syncResult] = await Promise.all([
      db.prepare("SELECT id,name,description,address,subway,lat,lon,categories,website,image_url FROM catalog_places WHERE is_closed=0 AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 250")
        .bind(lat - .22, lat + .22, lon - .4, lon + .4).all<PlaceRow>(),
      db.prepare(`SELECT e.id AS event_id,e.title,e.description AS event_description,e.categories AS event_categories,e.price_text,e.is_free,
        e.website AS event_website,e.image_url AS event_image,o.starts_at,o.ends_at,p.id,p.name,p.description,p.address,p.subway,p.lat,p.lon,p.categories,p.website,p.image_url
        FROM event_occurrences o JOIN catalog_events e ON e.id=o.event_id JOIN catalog_places p ON p.id=e.place_id
        WHERE p.is_closed=0 AND o.starts_at BETWEEN ? AND ? ORDER BY o.starts_at ASC LIMIT 250`).bind(from, to).all<EventRow>(),
      db.prepare("SELECT status,places_count,events_count,synced_at,error FROM catalog_sync_state WHERE source='kudago'").first(),
    ]);
    const rank = (categories: string[], distance: number) => categories.reduce((score, category) => score + (wanted.some((item) => category.toLowerCase().includes(item)) ? 8 : 0), 0) - distance;
    const places = (placesResult.results ?? []).map((row) => {
      const categories = parseList(row.categories); const distance = distanceKm(lat, lon, row.lat, row.lon);
      return { id: row.id, type: "place", name: row.name, description: row.description, address: row.address, subway: row.subway, coords: [row.lat, row.lon], categories, website: row.website, imageUrl: row.image_url, distanceKm: distance, score: rank(categories, distance) };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
    const events = (eventsResult.results ?? []).map((row) => {
      const categories = parseList(row.event_categories); const distance = distanceKm(lat, lon, row.lat, row.lon);
      return { id: row.event_id, type: "event", name: row.title, description: row.event_description, place: row.name, address: row.address, subway: row.subway, coords: [row.lat, row.lon], categories, startsAt: row.starts_at, endsAt: row.ends_at, price: row.price_text, isFree: Boolean(row.is_free), website: row.event_website, imageUrl: row.event_image, distanceKm: distance, score: rank(categories, distance) + 4 };
    }).sort((a, b) => b.score - a.score || a.startsAt - b.startsAt).slice(0, limit);
    return Response.json({ places, events, sync: syncResult ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog unavailable";
    return Response.json({ places: [], events: [], status: "unavailable", error: message }, { status: message.includes("no such table") ? 503 : 500 });
  }
}
