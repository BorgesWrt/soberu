type KudaGoImage = { image?: string; thumbnails?: Record<string, string> };
type KudaGoCoords = { lat?: number; lon?: number };
type KudaGoPlace = {
  id: number; title: string; slug?: string; address?: string; subway?: string;
  coords?: KudaGoCoords; categories?: string[]; description?: string;
  site_url?: string; foreign_url?: string; images?: KudaGoImage[]; is_closed?: boolean;
};
type KudaGoDate = { start?: number; end?: number };
type KudaGoEvent = {
  id: number; title: string; slug?: string; place?: KudaGoPlace | null; dates?: KudaGoDate[];
  categories?: string[]; description?: string; price?: string; is_free?: boolean;
  age_restriction?: string; site_url?: string; images?: KudaGoImage[];
};
type KudaGoPage<T> = { next?: string | null; results?: T[] };

const API = "https://kudago.com/public-api/v1.4";
const SPB = { minLat: 59.55, maxLat: 60.35, minLon: 29.2, maxLon: 31.5 };

function plainText(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 900);
}

function validCoords(coords?: KudaGoCoords): coords is { lat: number; lon: number } {
  return typeof coords?.lat === "number" && typeof coords.lon === "number" && coords.lat >= SPB.minLat && coords.lat <= SPB.maxLat && coords.lon >= SPB.minLon && coords.lon <= SPB.maxLon;
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

function placeStatement(db: D1Database, place: KudaGoPlace, syncedAt: string) {
  if (!validCoords(place.coords)) return null;
  return db.prepare(`INSERT INTO catalog_places
    (id,source,source_id,name,slug,description,address,subway,lat,lon,categories,website,image_url,is_closed,synced_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,address=excluded.address,
    subway=excluded.subway,lat=excluded.lat,lon=excluded.lon,categories=excluded.categories,website=excluded.website,
    image_url=excluded.image_url,is_closed=excluded.is_closed,synced_at=excluded.synced_at`)
    .bind(`kudago:${place.id}`, "kudago", String(place.id), place.title, place.slug ?? null, plainText(place.description), place.address ?? null,
      place.subway ?? null, place.coords.lat, place.coords.lon, JSON.stringify(place.categories ?? []), place.foreign_url || place.site_url || null,
      imageUrl(place.images), place.is_closed ? 1 : 0, syncedAt);
}

export async function syncKudaGoCatalog(db: D1Database, options: { placePages?: number; eventPages?: number } = {}) {
  const syncedAt = new Date().toISOString();
  const now = Math.floor(Date.now() / 1000);
  const until = now + 60 * 24 * 60 * 60;
  const placeUrl = new URL(`${API}/places/`);
  placeUrl.searchParams.set("location", "spb");
  placeUrl.searchParams.set("page_size", "100");
  placeUrl.searchParams.set("order_by", "-favorites_count");
  placeUrl.searchParams.set("fields", "id,title,slug,address,subway,coords,categories,description,site_url,foreign_url,images,is_closed");
  const eventUrl = new URL(`${API}/events/`);
  eventUrl.searchParams.set("location", "spb");
  eventUrl.searchParams.set("actual_since", String(now));
  eventUrl.searchParams.set("actual_until", String(until));
  eventUrl.searchParams.set("page_size", "100");
  eventUrl.searchParams.set("order_by", "-publication_date");
  eventUrl.searchParams.set("expand", "place,dates");
  eventUrl.searchParams.set("fields", "id,title,slug,place,dates,categories,description,price,is_free,age_restriction,site_url,images");

  await db.prepare(`INSERT INTO catalog_sync_state (source,status,synced_at,error) VALUES ('kudago','running',?,NULL)
    ON CONFLICT(source) DO UPDATE SET status='running',synced_at=excluded.synced_at,error=NULL`).bind(syncedAt).run();
  try {
    const [places, events] = await Promise.all([
      fetchPages<KudaGoPlace>(placeUrl, options.placePages ?? 2),
      fetchPages<KudaGoEvent>(eventUrl, options.eventPages ?? 3),
    ]);
    const placeStatements = new Map<string, D1PreparedStatement>();
    places.forEach((place) => { const statement = placeStatement(db, place, syncedAt); if (statement) placeStatements.set(String(place.id), statement); });
    events.forEach((event) => { if (event.place) { const statement = placeStatement(db, event.place, syncedAt); if (statement) placeStatements.set(String(event.place.id), statement); } });
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
        .bind(id, "kudago", String(event.id), event.place?.id && validCoords(event.place.coords) ? `kudago:${event.place.id}` : null, event.title, event.slug ?? null,
          plainText(event.description), JSON.stringify(event.categories ?? []), event.price ?? null, event.is_free ? 1 : 0,
          event.age_restriction ?? null, event.site_url ?? null, imageUrl(event.images), syncedAt));
      eventStatements.push(db.prepare("DELETE FROM event_occurrences WHERE event_id = ?").bind(id));
      (event.dates ?? []).filter((date) => typeof date.start === "number" && date.start >= now && date.start <= until).slice(0, 30).forEach((date, index) => {
        eventStatements.push(db.prepare("INSERT INTO event_occurrences (id,event_id,starts_at,ends_at) VALUES (?,?,?,?)")
          .bind(`${id}:${date.start}:${index}`, id, date.start, date.end ?? null));
      });
    });
    await runBatches(db, eventStatements);
    await db.prepare(`UPDATE catalog_sync_state SET status='ready',places_count=?,events_count=?,synced_at=?,error=NULL WHERE source='kudago'`)
      .bind(placeStatements.size, events.length, syncedAt).run();
    return { source: "kudago", places: placeStatements.size, events: events.length, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await db.prepare(`UPDATE catalog_sync_state SET status='error',synced_at=?,error=? WHERE source='kudago'`).bind(syncedAt, message).run();
    throw error;
  }
}
