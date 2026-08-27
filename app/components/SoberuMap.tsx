"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";

export type MapStop = {
  id: string;
  name: string;
  address?: string;
  coords: [number, number];
};

type Props = {
  cityName: string;
  cityCenter: [number, number];
  cityBounds: [[number, number], [number, number]];
  meetingPoint: { label: string; coords: [number, number] };
  stops?: MapStop[];
  showRoute?: boolean;
  activeStopId?: string;
  onStopSelect?: (id: string) => void;
  onMapPick?: (coords: [number, number]) => void;
  pickable?: boolean;
  meetingState?: "confirmed" | "candidate";
  height?: "compact" | "large";
};

type LineGeometry = { type: "Feature"; properties: Record<string, never>; geometry: { type: "LineString"; coordinates: number[][] } };

const darkStreetStyle: StyleSpecification = {
  version: 8,
  sources: {
    streets: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{
    id: "dark-streets",
    type: "raster",
    source: "streets",
    paint: {
      "raster-saturation": -.82,
      "raster-contrast": .28,
      "raster-brightness-min": .04,
      "raster-brightness-max": .42,
    },
  }],
};

function fallbackLine(points: [number, number][]): LineGeometry {
  const coordinates: number[][] = [];
  points.slice(0, -1).forEach((start, index) => {
    const end = points[index + 1];
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    const curve = Math.min(.008, Math.hypot(dx, dy) * .11);
    for (let part = 0; part < 12; part += 1) {
      const t = part / 11;
      const bend = Math.sin(Math.PI * t) * curve;
      coordinates.push([start[1] + dx * t - dy * bend, start[0] + dy * t + dx * bend]);
    }
  });
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

export default function SoberuMap({ cityName, cityCenter, cityBounds, meetingPoint, stops = [], showRoute = false, activeStopId, onStopSelect, onMapPick, pickable = false, meetingState = "confirmed", height = "compact" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialCityRef = useRef({ center: cityCenter, bounds: cityBounds });
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const meetingMarkerRef = useRef<Marker | null>(null);
  const stopMarkersRef = useRef<Marker[]>([]);
  const onStopSelectRef = useRef(onStopSelect);
  const onMapPickRef = useRef(onMapPick);
  const pickableRef = useRef(pickable);
  const [mapReady, setMapReady] = useState(false);
  const [routeMode, setRouteMode] = useState<"none" | "walking" | "preview">("none");
  const stopKey = stops.map((stop) => `${stop.id}:${stop.coords.join(",")}`).join("|");
  const meetingLat = meetingPoint.coords[0];
  const meetingLon = meetingPoint.coords[1];

  useEffect(() => {
    onStopSelectRef.current = onStopSelect;
    onMapPickRef.current = onMapPick;
    pickableRef.current = pickable;
  }, [onStopSelect, onMapPick, pickable]);

  useEffect(() => {
    let disposed = false;
    async function mountMap() {
      if (!containerRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (disposed || !containerRef.current) return;
      maplibreRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: darkStreetStyle,
        center: [initialCityRef.current.center[1], initialCityRef.current.center[0]],
        zoom: 12.2,
        minZoom: 9,
        maxZoom: 18,
        maxBounds: initialCityRef.current.bounds,
        attributionControl: {},
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("click", (event) => { if (pickableRef.current) onMapPickRef.current?.([event.lngLat.lat, event.lngLat.lng]); });
      map.on("load", () => { if (!disposed) setMapReady(true); });
    }
    void mountMap();
    return () => {
      disposed = true;
      meetingMarkerRef.current?.remove();
      stopMarkersRef.current.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      meetingMarkerRef.current = null;
      stopMarkersRef.current = [];
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setMaxBounds(cityBounds);
    map.easeTo({ center: [cityCenter[1], cityCenter[0]], zoom: 11.8, duration: 420 });
  }, [mapReady, cityBounds, cityCenter]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!mapReady || !map || !maplibregl) return;
    let marker = meetingMarkerRef.current;
    if (!marker) {
      const element = document.createElement("div");
      marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([meetingLon, meetingLat])
        .addTo(map);
      meetingMarkerRef.current = marker;
    }
    const element = marker.getElement();
    element.className = `soberu-meeting-marker${meetingState === "candidate" ? " candidate" : ""}`;
    element.innerHTML = `<i></i><span>${meetingState === "candidate" ? "Новая точка" : "Место встречи"}</span>`;
    marker.setLngLat([meetingLon, meetingLat]);
  }, [mapReady, meetingLat, meetingLon, meetingState]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!mapReady || !map || !maplibregl) return;
    stopMarkersRef.current.forEach((marker) => marker.remove());
    stopMarkersRef.current = stops.map((stop, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "soberu-stop-marker-wrap";
      const element = document.createElement("button");
      element.type = "button";
      element.className = `soberu-stop-marker${activeStopId === stop.id ? " active" : ""}`;
      element.setAttribute("aria-label", `Показать ${stop.name}`);
      element.innerHTML = `<span>${index + 1}</span><b>${stop.name}</b>`;
      element.addEventListener("click", (event) => { event.stopPropagation(); onStopSelectRef.current?.(stop.id); });
      wrapper.appendChild(element);
      return new maplibregl.Marker({ element: wrapper, anchor: "center" }).setLngLat([stop.coords[1], stop.coords[0]]).addTo(map);
    });
    return () => {
      stopMarkersRef.current.forEach((marker) => marker.remove());
      stopMarkersRef.current = [];
    };
  }, [mapReady, stopKey, activeStopId, stops]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!mapReady || !map || !maplibregl) return;
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([meetingLon, meetingLat]);
    stops.forEach((stop) => bounds.extend([stop.coords[1], stop.coords[0]]));
    if (stops.length) map.fitBounds(bounds, { padding: { top: 72, right: 76, bottom: 60, left: 76 }, maxZoom: 14, duration: 380 });
    else map.easeTo({ center: [meetingLon, meetingLat], zoom: Math.max(map.getZoom(), 12.8), duration: 320 });
  }, [mapReady, meetingLat, meetingLon, stopKey, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const activeMap = map;
    const controller = new AbortController();
    const allPoints: [number, number][] = [[meetingLat, meetingLon], ...stops.map((stop) => stop.coords)];
    if (!showRoute || !stops.length) {
      if (map.getLayer("soberu-route-line")) map.removeLayer("soberu-route-line");
      if (map.getLayer("soberu-route-glow")) map.removeLayer("soberu-route-glow");
      if (map.getSource("soberu-route")) map.removeSource("soberu-route");
      return () => controller.abort();
    }
    async function updateRoute() {
      let route = fallbackLine(allPoints);
      let mode: "walking" | "preview" = "preview";
      try {
        const response = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ coordinates: allPoints.map(([lat, lon]) => [lon, lat]) }), signal: controller.signal });
        if (response.ok) {
          const payload = await response.json() as { route?: LineGeometry; mode?: string };
          if (payload.route?.geometry?.coordinates?.length) route = payload.route;
          if (payload.mode === "walking") mode = "walking";
        }
      } catch (error) { if ((error as Error).name === "AbortError") return; }
      if (controller.signal.aborted) return;
      setRouteMode(mode);
      if (!activeMap.getSource("soberu-route")) activeMap.addSource("soberu-route", { type: "geojson", data: route });
      else (activeMap.getSource("soberu-route") as GeoJSONSource).setData(route);
      if (!activeMap.getLayer("soberu-route-glow")) activeMap.addLayer({ id: "soberu-route-glow", type: "line", source: "soberu-route", paint: { "line-color": "#b7ff45", "line-width": 10, "line-opacity": .16, "line-blur": 6 } });
      if (!activeMap.getLayer("soberu-route-line")) activeMap.addLayer({ id: "soberu-route-line", type: "line", source: "soberu-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#b7ff45", "line-width": 4, "line-opacity": .96 } });
    }
    void updateRoute();
    return () => controller.abort();
  }, [mapReady, meetingLat, meetingLon, stopKey, showRoute, stops]);

  return (
    <div className={`soberu-map soberu-map-${height}${pickable ? " is-pickable" : ""}`}>
      <div className="map-provider"><span><i /> {cityName} · OpenStreetMap</span><small>{showRoute ? routeMode === "walking" ? "пеший маршрут" : "схема прогулки" : pickable ? "можно поставить точку кликом" : "маршрут появится после выбора программы"}</small></div>
      <div ref={containerRef} className="soberu-map-canvas" aria-label={`Интерактивная карта ${cityName}`} />
      <div className={`map-meeting-caption${meetingState === "candidate" ? " candidate" : ""}`}><small>{meetingState === "candidate" ? "Нужно подтверждение" : "Старт программы"}</small><strong>{meetingState === "candidate" ? "Проверьте точку" : "Место встречи"}</strong><span>{meetingPoint.label}</span></div>
    </div>
  );
}
