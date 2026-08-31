import { inferTraits } from "./recommendation";

type KudaGoImage = { image?: string; thumbnails?: Record<string, string> };
type KudaGoCoords = { lat?: number; lon?: number };

type KudaGoPlace = {
  id: number; title: string; slug?: string; address?: string; subway?: string;
  coords?: KudaGoCoords; categories?: string[]; description?: string;
  site_url?: string; foreign_url?: string; images?: KudaGoImage[]; is_closed?: boolean;
  location?: string; tags?: string[]; favorites_count?: number; comments_count?: number;
};
type KudaGoDate = { start?: number; end?: number };
type KudaGoEvent = {
  id: number; title: string; slug?: string; place?: KudaGoPlace | null; dates?: KudaGoDate[];
  categories?: string[]; description?: string; price?: string; is_free?: boolean;
  age_restriction?: string; site_url?: string; images?: KudaGoImage[];
};
type KudaGoPage<T> = { next?: string | null; results?: T[] };

const API = "https://kudago.com/public-api/v1.4";
const CITY_CONFIGS = {
  spb: { minLat: 59.55, maxLat: 60.35, minLon: 29.2, maxLon: 31.5 },
  msk: { minLat: 55.45, maxLat: 56.05, minLon: 36.75, maxLon: 38.15 },
} as const;
type CatalogCity = keyof typeof CITY_CONFIGS;

function plainText(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 900);
}

function validCoords(coords: KudaGoCoords | undefined, city: CatalogCity): coords is { lat: number; lon: number } {
  const bounds = CITY_CONFIGS[city];
  return typeof coords?.lat === "number" && typeof coords.lon === "number" && coords.lat >= bounds.minLat && coords.lat <= bounds.maxLat && coords.lon >= bounds.minLon && coords.lon <= bounds.maxLon;
}

function imageUrl(images?: KudaGoImage[]) {
  const image = images?.[0];
  return image?.thumbnails?.["640x384"] || image?.image || null;
}

async function fetchPages<T>(url: URL, maxPages: number) {
  const rows: T[] = [];
  let next: string | null = url.toString();
  for (let page = 0; page < maxPages && next; page += 1) {
    const response = await fetch(next, { headers: { accept: "application/json", "user-agent": "Soberu/0.1 catalog sync" } });
    if (!response.ok) throw new Error(`KudaGo returned ${response.status}`);
    const payload = await response.json() as KudaGoPage<T>;
    rows.push(...(payload.results ?? []));
    next = payload.next ?? null;
  }
  return rows;
}

async function runBatches(db: D1Database, statements: D1PreparedStatement[], size = 50) {
  for (let index = 0; index < statements.length; index += size) await db.batch(statements.slice(index, index + size));
}

function canonicalKey(place: KudaGoPlace) {
  const title = place.title.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
  return `${title}:${place.coords?.lat?.toFixed(3)}:${place.coords?.lon?.toFixed(3)}`;
}

function placeStatement(db: D1Database, place: KudaGoPlace, city: CatalogCity, syncedAt: string) {
  if (!validCoords(place.coords, city)) return null;
  const popularity = Math.max(0, (place.favorites_count ?? 0) + (place.comments_count ?? 0) * 3);
  const qualityScore = Math.min(100, 34 + Math.log1p(place.favorites_count ?? 0) * 8 + Math.log1p(place.comments_count ?? 0) * 4);
  const traits = inferTraits(place.categories ?? [], place.tags ?? [], `${place.title} ${place.description ?? ""}`);
  return db.prepare(`INSERT INTO catalog_places
    (id,source,source_id,name,slug,description,address,subway,city,lat,lon,categories,traits,canonical_key,popularity,quality_score,website,image_url,is_closed,synced_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,address=excluded.address,
    subway=excluded.subway,city=excluded.city,lat=excluded.lat,lon=excluded.lon,categories=excluded.categories,traits=excluded.traits,
    canonical_key=excluded.canonical_key,popularity=excluded.popularity,quality_score=excluded.quality_score,website=excluded.website,
    image_url=excluded.image_url,is_closed=excluded.is_closed,synced_at=excluded.synced_at`)
    .bind(`kudago:${place.id}`, "kudago", String(place.id), place.title, place.slug ?? null, plainText(place.description), place.address ?? null,
      place.subway ?? null, city, place.coords.lat, place.coords.lon, JSON.stringify(place.categories ?? []), JSON.stringify(traits), canonicalKey(place), popularity, qualityScore,
      place.foreign_url || place.site_url || null, imageUrl(place.images), place.is_closed ? 1 : 0, syncedAt);
}

async function syncCity(db: D1Database, city: CatalogCity, syncedAt: string, options: { placePages?: number; eventPages?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const until = now + 60 * 24 * 60 * 60;
  const placeUrl = new URL(`${API}/places/`);
  placeUrl.searchParams.set("location", city);
  placeUrl.searchParams.set("page_size", "100");
  placeUrl.searchParams.set("order_by", "-favorites_count");
  placeUrl.searchParams.set("fields", "id,title,slug,address,subway,coords,categories,tags,description,site_url,foreign_url,images,is_closed,location,favorites_count,comments_count");
  const eventUrl = new URL(`${API}/events/`);
  eventUrl.searchParams.set("location", city);
  eventUrl.searchParams.set("actual_since", String(now));
  eventUrl.searchParams.set("actual_until", String(until));
  eventUrl.searchParams.set("page_size", "100");
  eventUrl.searchParams.set("order_by", "-publication_date");
  eventUrl.searchParams.set("expand", "place,dates");
  eventUrl.searchParams.set("fields", "id,title,slug,place,dates,categories,description,price,is_free,age_restriction,site_url,images");

  const syncKey = `kudago:${city}`;
  await db.prepare(`INSERT INTO catalog_sync_state (source,status,synced_at,error) VALUES (?,'running',?,NULL)
    ON CONFLICT(source) DO UPDATE SET status='running',synced_at=excluded.synced_at,error=NULL`).bind(syncKey, syncedAt).run();
  try {
    const [places, events] = await Promise.all([
      fetchPages<KudaGoPlace>(placeUrl, options.placePages ?? 6),
      fetchPages<KudaGoEvent>(eventUrl, options.eventPages ?? 4),
    ]);
    const placeStatements = new Map<string, D1PreparedStatement>();
    places.forEach((place) => { const statement = placeStatement(db, place, city, syncedAt); if (statement) placeStatements.set(String(place.id), statement); });
    events.forEach((event) => { if (event.place && !placeStatements.has(String(event.place.id))) { const statement = placeStatement(db, event.place, city, syncedAt); if (statement) placeStatements.set(String(event.place.id), statement); } });
    await runBatches(db, [...placeStatements.values()]);

    const eventStatements: D1PreparedStatement[] = [];
    events.forEach((event) => {
      const id = `kudago:${event.id}`;
      eventStatements.push(db.prepare(`INSERT INTO catalog_events
        (id,source,source_id,place_id,title,slug,description,categories,price_text,is_free,age_restriction,website,image_url,synced_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET place_id=excluded.place_id,title=excluded.title,slug=excluded.slug,description=excluded.description,
        categories=excluded.categories,price_text=excluded.price_text,is_free=excluded.is_free,age_restriction=excluded.age_restriction,
        website=excluded.website,image_url=excluded.image_url,synced_at=excluded.synced_at`)
        .bind(id, "kudago", String(event.id), event.place?.id && validCoords(event.place.coords, city) ? `kudago:${event.place.id}` : null, event.title, event.slug ?? null,
          plainText(event.description), JSON.stringify(event.categories ?? []), event.price ?? null, event.is_free ? 1 : 0,
          event.age_restriction ?? null, event.site_url ?? null, imageUrl(event.images), syncedAt));
      eventStatements.push(db.prepare("DELETE FROM event_occurrences WHERE event_id = ?").bind(id));
      (event.dates ?? []).filter((date) => typeof date.start === "number" && date.start >= now && date.start <= until).slice(0, 30).forEach((date, index) => {
        eventStatements.push(db.prepare("INSERT INTO event_occurrences (id,event_id,starts_at,ends_at) VALUES (?,?,?,?)")
          .bind(`${id}:${date.start}:${index}`, id, date.start, date.end ?? null));
      });
    });
    await runBatches(db, eventStatements);
    await db.prepare(`UPDATE catalog_sync_state SET status='ready',places_count=?,events_count=?,synced_at=?,error=NULL WHERE source=?`)
      .bind(placeStatements.size, events.length, syncedAt, syncKey).run();
    return { city, places: placeStatements.size, events: events.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await db.prepare(`UPDATE catalog_sync_state SET status='error',synced_at=?,error=? WHERE source=?`).bind(syncedAt, message, syncKey).run();
    throw error;
  }
}

export async function syncKudaGoCatalog(db: D1Database, options: { placePages?: number; eventPages?: number; cities?: CatalogCity[] } = {}) {
  const syncedAt = new Date().toISOString();
  const cities = options.cities?.length ? options.cities : (["msk", "spb"] as CatalogCity[]);
  const results = [];
  for (const city of cities) results.push(await syncCity(db, city, syncedAt, options));
  await db.prepare("DELETE FROM event_occurrences WHERE starts_at < ?").bind(Math.floor(Date.now() / 1000) - 24 * 60 * 60).run();
  return {
    source: "kudago",
    cities: results,
    places: results.reduce((total, result) => total + result.places, 0),
    events: results.reduce((total, result) => total + result.events, 0),
    syncedAt,
  };
}
