import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const z = Number(request.nextUrl.searchParams.get("z"));
  const x = Number(request.nextUrl.searchParams.get("x"));
  const y = Number(request.nextUrl.searchParams.get("y"));
  const maxIndex = Number.isInteger(z) && z >= 0 && z <= 19 ? 2 ** z : 0;
  if (!maxIndex || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= maxIndex || y >= maxIndex) {
    return NextResponse.json({ error: "Invalid tile" }, { status: 400 });
  }
  try {
    const response = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { "User-Agent": "Soberu local meeting planner" } });
    if (!response.ok) throw new Error(`Tile ${response.status}`);
    return new NextResponse(await response.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Tile unavailable" }, { status: 502 });
  }
}
