import { NextRequest, NextResponse } from "next/server";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    locality?: string;
    postcode?: string;
    osm_key?: string;
    osm_value?: string;
    osm_type?: string;
    osm_id?: number;
  };
};

const CITY_CONFIG = {
  spb: { label: "Санкт-Петербург", bounds: { minLon: 29.25, minLat: 59.55, maxLon: 31.5, maxLat: 60.35 }, center: { lat: 59.9388, lon: 30.3146 } },
  moscow: { label: "Москва", bounds: { minLon: 36.75, minLat: 55.45, maxLon: 38.15, maxLat: 56.05 }, center: { lat: 55.7558, lon: 37.6173 } },
} as const;
const cache = new Map<string, { expires: number; items: ReturnType<typeof formatFeature>[] }>();

function formatKind(properties: NonNullable<PhotonFeature["properties"]>) {
  if (properties.osm_key === "railway" || properties.osm_value === "subway") return "Метро";
  if (properties.osm_key === "place") return "Район";
  if (properties.osm_key === "tourism" || properties.osm_key === "historic") return "Достопримечательность";
  if (properties.housenumber || properties.osm_key === "highway") return "Адрес";
  return "Место";
}

function formatFeature(feature: PhotonFeature, city: (typeof CITY_CONFIG)[keyof typeof CITY_CONFIG]) {
  const properties = feature.properties ?? {};
  const [lon, lat] = feature.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lon < city.bounds.minLon || lon > city.bounds.maxLon || lat < city.bounds.minLat || lat > city.bounds.maxLat) return null;

  const streetAddress = [properties.street, properties.housenumber].filter(Boolean).join(", ");
  const label = properties.name || streetAddress || properties.street || "Точка на карте";
  const context = [properties.district || properties.locality, properties.city, properties.postcode].filter((value, index, values) => value && value !== label && values.indexOf(value) === index).join(" · ");
  const address = streetAddress && streetAddress !== label ? [streetAddress, context].filter(Boolean).join(" · ") : context;

  return {
    id: `photon-${properties.osm_type || "point"}-${properties.osm_id || `${lat}-${lon}`}`,
    label,
    address: address || city.label,
    kind: formatKind(properties),
    coords: [lat, lon] as [number, number],
    source: "OpenStreetMap · Photon",
  };
}

export async function GET(request: NextRequest) {
  const cityKey = request.nextUrl.searchParams.get("city") === "spb" ? "spb" : "moscow";
  const city = CITY_CONFIG[cityKey];
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  const lat = Number(latParam);
  const lon = Number(lonParam);
  const isReverse = latParam !== null && lonParam !== null && Number.isFinite(lat) && Number.isFinite(lon);
  if (!isReverse && query.length < 2) return NextResponse.json({ items: [] });

  const cacheKey = isReverse ? `${cityKey}:reverse:${lat.toFixed(5)}:${lon.toFixed(5)}` : `${cityKey}:search:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json({ items: cached.items, cached: true });

  const url = new URL(isReverse ? "https://photon.komoot.io/reverse" : "https://photon.komoot.io/api/");
  if (isReverse) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("limit", "1");
  } else {
    url.searchParams.set("q", query);
    url.searchParams.set("bbox", `${city.bounds.minLon},${city.bounds.minLat},${city.bounds.maxLon},${city.bounds.maxLat}`);
    url.searchParams.set("lat", String(city.center.lat));
    url.searchParams.set("lon", String(city.center.lon));
    url.searchParams.set("zoom", "11");
    url.searchParams.set("location_bias_scale", "0.15");
    url.searchParams.set("limit", "8");
  }

  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/geo+json, application/json", "User-Agent": "Soberu local meeting planner" } });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    const data = await response.json() as { features?: PhotonFeature[] };
    const items = (data.features ?? []).map((feature) => formatFeature(feature, city)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    cache.set(cacheKey, { expires: Date.now() + 5 * 60_000, items });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], unavailable: true });
  }
}
