import { NextRequest, NextResponse } from "next/server";

type Coordinates = [number, number][];

function fallbackRoute(coordinates: Coordinates) {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { coordinates?: Coordinates };
  const coordinates = Array.isArray(body.coordinates) ? body.coordinates.filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) : [];
  if (coordinates.length < 2 || coordinates.length > 12) return NextResponse.json({ error: "Нужно от 2 до 12 точек" }, { status: 400 });

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ route: fallbackRoute(coordinates), mode: "preview" });

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST",
      headers: { Authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ coordinates, preference: "recommended", instructions: false }),
    });
    if (!response.ok) throw new Error(`ORS ${response.status}`);
    const data = await response.json() as { features?: Array<{ type: "Feature"; properties: Record<string, unknown>; geometry: { type: "LineString"; coordinates: number[][] } }> };
    const route = data.features?.[0];
    if (!route) throw new Error("Empty route");
    return NextResponse.json({ route, mode: "walking" });
  } catch {
    return NextResponse.json({ route: fallbackRoute(coordinates), mode: "preview" });
  }
}
