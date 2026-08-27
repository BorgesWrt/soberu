"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SoberuMap from "./components/SoberuMap";
import { cityConfigs, type CityId, type CityPlace } from "./data/places";

type Mode = "builder" | "room" | "plans" | "final";
type VenueAlternative = { name: string; distance: string; website: string; address?: string; coords?: [number, number]; note?: string };
type VenueStop = { id: string; time: string; name: string; address: string; coords: [number, number]; website: string; note: string; analogs: VenueAlternative[] };
type LocationCandidate = { id: string; label: string; address: string; coords: [number, number]; kind: string; source: string; website?: string; description?: string };
type MeetingLocation = { label: string; address?: string; coords: [number, number]; kind?: string; source?: string };
type SaveState = "idle" | "saving" | "saved" | "local";
type CatalogItem = { id: string; type: "place" | "event"; name: string; description?: string | null; place?: string; address?: string | null; coords: [number, number]; categories: string[]; startsAt?: number; price?: string | null; isFree?: boolean; website?: string | null; distanceKm: number };
type Participant = { id: string; name: string; role: "host" | "guest"; status: "ready" | "waiting"; votedAt?: string; prefs?: string[]; dates?: string[]; budgetLimit?: number };
type StoredMeeting = { id: string; name: string; status: string; snapshot: Record<string, unknown>; updatedAt: string };

const goals = [
  { id: "talk", icon: "✦", title: "Поговорить", text: "Тихое место и время без спешки" },
  { id: "fun", icon: "↗", title: "Повеселиться", text: "Игра, впечатления и немного азарта" },
  { id: "date", icon: "♡", title: "Свидание", text: "Красивый план на двоих" },
  { id: "double-date", icon: "♡♡", title: "Парное свидание", text: "Вечер для двух пар" },
  { id: "food", icon: "⌁", title: "Вкусно поесть", text: "Новая кухня или любимая классика" },
  { id: "walk", icon: "○", title: "Погулять", text: "Город, воздух и длинный маршрут" },
  { id: "surprise", icon: "?", title: "Удивите нас", text: "Довериться подборке целиком" },
];

const companies = ["Друзья", "Свидание", "Парное свидание", "Коллеги", "Семья"];
const preferences = [
  { name: "Новая кухня", icon: "⌁", group: "Еда" }, { name: "Уютное кафе", icon: "☕", group: "Еда" },
  { name: "Стритфуд", icon: "◇", group: "Еда" }, { name: "Винный бар", icon: "♢", group: "Еда" },
  { name: "Коктейли", icon: "△", group: "Еда" }, { name: "Настолки", icon: "▦", group: "Игры" },
  { name: "Квиз", icon: "?", group: "Игры" }, { name: "Боулинг", icon: "●", group: "Игры" },
  { name: "Бильярд", icon: "◎", group: "Игры" }, { name: "Караоке", icon: "♫", group: "Музыка" },
  { name: "Живая музыка", icon: "♪", group: "Музыка" }, { name: "Концерт", icon: "♬", group: "Музыка" },
  { name: "Кино", icon: "▶", group: "Культура" }, { name: "Театр", icon: "◫", group: "Культура" },
  { name: "Выставка", icon: "▧", group: "Культура" }, { name: "Музей", icon: "▥", group: "Культура" },
  { name: "Прогулка", icon: "↗", group: "Город" }, { name: "Парк", icon: "♧", group: "Город" },
  { name: "У воды", icon: "≈", group: "Город" }, { name: "Красивый вид", icon: "◇", group: "Город" },
  { name: "Танцы", icon: "✦", group: "Активно" }, { name: "Мастер-класс", icon: "+", group: "Активно" },
  { name: "Спорт", icon: "○", group: "Активно" }, { name: "Спа и релакс", icon: "~", group: "Спокойно" },
];
const hourSlots = Array.from({ length: 24 }, (_, index) => index);
const catalogCategoryMap: Record<string, string> = {
  "Новая кухня": "restaurants", "Уютное кафе": "cafe", "Стритфуд": "restaurants", "Винный бар": "bars",
  "Коктейли": "bars", "Настолки": "games", "Квиз": "quiz", "Боулинг": "bowling", "Бильярд": "billiards",
  "Караоке": "karaoke", "Живая музыка": "concert", "Концерт": "concert", "Кино": "cinema", "Театр": "theater",
  "Выставка": "exhibition", "Музей": "museums", "Прогулка": "attractions", "Парк": "parks", "У воды": "attractions",
  "Красивый вид": "sights", "Танцы": "dance", "Мастер-класс": "workshops", "Спорт": "sport", "Спа и релакс": "spa",
};

const planSlots: Record<string, string[][]> = {
  fontanka: [["exhibition", "museums", "theater", "tour"], ["attractions", "sights", "parks", "tour"], ["restaurants", "cafe", "bars"]],
  petro: [["amusement", "anticafe", "games", "quiz", "education"], ["restaurants", "cafe", "anticafe"], ["concert", "theater", "cinema", "amusement"]],
  island: [["attractions", "sights", "parks", "tour"], ["exhibition", "museums", "concert", "festival"], ["restaurants", "bars", "cafe"]],
};
const livePlanTitles: Record<string, { evening: string; day: string }> = {
  fontanka: { evening: "Культура, прогулка и хороший финал", day: "Спокойный день с культурой и прогулкой" },
  petro: { evening: "Общение и активный вечер", day: "День для общения и новых впечатлений" },
  island: { evening: "Городские открытия и событие", day: "Большой маршрут по новым местам" },
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialDates() {
  return [1, 2, 3].map((offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return toIsoDate(date);
  });
}

function getInitialAvailability() {
  return Object.fromEntries(getInitialDates().map((date) => [date, [18, 19, 20, 21]]));
}

function formatDate(date: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("ru-RU", style === "short"
    ? { weekday: "short", day: "numeric", month: "short" }
    : { weekday: "long", day: "numeric", month: "long" }
  ).format(new Date(`${date}T12:00:00`));
}

function getLongestWindow(availability: Record<string, number[]>) {
  let result = { date: "", start: 0, end: 0, length: 0 };

  Object.entries(availability).forEach(([date, sourceHours]) => {
    const hours = [...sourceHours].sort((a, b) => a - b);
    let runStart = hours[0];
    let previous = hours[0];

    hours.forEach((hour, index) => {
      if (index === 0) return;
      if (hour !== previous + 1) runStart = hour;
      const length = hour - runStart + 1;
      if (length > result.length) result = { date, start: runStart, end: hour + 1, length };
      previous = hour;
    });

    if (hours.length === 1 && result.length === 0) result = { date, start: hours[0], end: hours[0] + 1, length: 1 };
  });

  return result;
}

function makeParticipants(total: number): Participant[] {
  return [
    { id: "host", name: "Вы", role: "host", status: "ready", votedAt: new Date().toISOString() },
    ...Array.from({ length: Math.max(1, total) - 1 }, (_, index) => ({ id: `slot-${index + 1}`, name: `Гость ${index + 1}`, role: "guest" as const, status: "waiting" as const })),
  ];
}

function readParticipants(snapshot: Record<string, unknown>, fallbackSize = 2): Participant[] {
  if (Array.isArray(snapshot.participants)) return snapshot.participants.filter((item): item is Participant => Boolean(item && typeof item === "object" && "id" in item && "name" in item && "status" in item));
  const savedSize = typeof snapshot.size === "number" ? snapshot.size : fallbackSize;
  return makeParticipants(savedSize);
}

const demoPlans = [
  {
    id: "fontanka",
    number: "01",
    badge: "Лучшее совпадение",
    title: "Тёплый вечер на Фонтанке",
    subtitle: "Ужин → прогулка → десерт",
    area: "Сенная · 2,4 км",
    price: "≈ 2 100 ₽ / чел.",
    score: "94%",
    color: "orange",
    reason: "Все успевают к 18:30, маршрут удобен от выбранной станции, а прогулку поддержали трое из четырёх.",
    steps: ["18:30 · Ужин в тихом бистро", "20:15 · Прогулка вдоль Фонтанки", "21:20 · Десерт и кофе"],
  },
  {
    id: "petro",
    number: "02",
    badge: "Больше общения",
    title: "Игротека на Петроградской",
    subtitle: "Настолки → поздний ужин",
    area: "Петроградская · 1,1 км",
    price: "≈ 1 700 ₽ / чел.",
    score: "89%",
    color: "sage",
    reason: "Самый спокойный вариант: мало ходьбы, одна пересадка для большинства и достаточно времени поговорить.",
    steps: ["18:45 · Стол в городской игротеке", "21:00 · Поздний ужин рядом", "22:30 · Свободное продолжение"],
  },
  {
    id: "island",
    number: "03",
    badge: "Больше впечатлений",
    title: "Остров и вечерний вид",
    subtitle: "Выставка → остров → гастробар",
    area: "Василеостровская · 3,2 км",
    price: "≈ 2 450 ₽ / чел.",
    score: "82%",
    color: "blue",
    reason: "Подходит по бюджету и собрал больше всего «хочу», но потребует чуть больше ходьбы и раннего старта.",
    steps: ["17:30 · Небольшая выставка", "19:00 · Прогулка у воды", "20:10 · Ужин в гастробаре"],
  },
];

const dayPrograms = [
  {
    id: "fontanka",
    number: "01",
    badge: "Полный день · лучшее совпадение",
    title: "День на Фонтанке",
    subtitle: "Бранч → выставка → прогулка → ужин → десерт",
    area: "Сенная · 4,6 км",
    price: "≈ 4 300 ₽ / чел.",
    score: "94%",
    color: "orange",
    reason: "Пять точек складываются в спокойный маршрут без лишних переездов: можно менять темп и пропускать этапы, не ломая весь день.",
    steps: ["11:00 · Бранч в тихом бистро", "12:30 · Небольшая выставка", "14:30 · Прогулка вдоль Фонтанки", "17:00 · Ужин во дворе-колодце", "19:00 · Десерт и кофе"],
  },
  {
    id: "petro",
    number: "02",
    badge: "Полный день · больше общения",
    title: "Петроградская без спешки",
    subtitle: "Кофе → игротека → обед → остров → бар",
    area: "Петроградская · 3,8 км",
    price: "≈ 3 850 ₽ / чел.",
    score: "89%",
    color: "sage",
    reason: "Маршрут собран вокруг одной станции: меньше дороги, больше времени на разговоры и возможность задержаться там, где особенно понравится.",
    steps: ["11:30 · Кофе и знакомство с районом", "12:30 · Игротека", "15:00 · Поздний обед", "17:00 · Прогулка на Каменном острове", "19:00 · Коктейльный бар"],
  },
  {
    id: "island",
    number: "03",
    badge: "Полный день · у воды",
    title: "Васильевский: вода и искусство",
    subtitle: "Музей → обед → набережная → закат → гастробар",
    area: "Василеостровская · 5,1 км",
    price: "≈ 4 700 ₽ / чел.",
    score: "82%",
    color: "blue",
    reason: "Самый насыщенный маршрут: чуть больше ходьбы, зато полноценный день у воды с хорошим финалом на закате.",
    steps: ["11:00 · Музей или выставка", "13:00 · Обед на Васильевском", "15:00 · Набережная и кофе", "17:30 · Закат у воды", "19:30 · Ужин в гастробаре"],
  },
];

export const finalStopsByPlan: Record<string, VenueStop[]> = {
  fontanka: [
    { id: "faberge", time: "12:00", name: "Музей Фаберже", address: "наб. Фонтанки, 21", coords: [59.9344, 30.3427], website: "https://fabergemuseum.ru/", note: "Начать день с искусства", analogs: [{ name: "Русский музей", distance: "12 мин", website: "https://rusmuseum.ru/" }, { name: "Музей Анны Ахматовой", distance: "8 мин", website: "https://akhmatova.spb.ru/" }] },
    { id: "summer-garden", time: "15:00", name: "Летний сад", address: "наб. Кутузова, 2", coords: [59.9458, 30.3356], website: "https://rusmuseum.ru/summer-garden/", note: "Прогулка без спешки", analogs: [{ name: "Михайловский сад", distance: "14 мин", website: "https://rusmuseum.ru/mikhailovsky-garden/" }, { name: "Марсово поле", distance: "7 мин", website: "https://visit-petersburg.ru/" }] },
    { id: "new-holland", time: "18:30", name: "Новая Голландия", address: "наб. Адмиралтейского канала, 2", coords: [59.929, 30.2891], website: "https://www.newhollandsp.ru/", note: "Ужин и свободный финал", analogs: [{ name: "Севкабель Порт", distance: "18 мин на авто", website: "https://sevcableport.ru/" }, { name: "Никольские ряды", distance: "12 мин", website: "https://nikolskiye.ru/" }] },
  ],
  petro: [
    { id: "planetarium", time: "11:30", name: "Петербургский планетарий", address: "Александровский парк, 4", coords: [59.955, 30.3137], website: "https://www.planetary-spb.ru/", note: "Спокойное начало программы", analogs: [{ name: "Планетарий №1", distance: "24 мин на авто", website: "https://planetarium.one/" }, { name: "Ленфильм", distance: "15 мин", website: "https://www.lenfilm.ru/" }] },
    { id: "botanical", time: "15:00", name: "Ботанический сад", address: "ул. Профессора Попова, 2", coords: [59.9705, 30.323], website: "https://botsad-spb.com/", note: "Прогулка и оранжереи", analogs: [{ name: "Лопухинский сад", distance: "12 мин", website: "https://visit-petersburg.ru/" }, { name: "ЦПКиО", distance: "18 мин", website: "https://elaginpark.org/" }] },
    { id: "lenfilm", time: "18:30", name: "Ленфильм", address: "Каменноостровский пр., 10", coords: [59.957, 30.3165], website: "https://www.lenfilm.ru/", note: "Кино и вечер рядом", analogs: [{ name: "Аврора", distance: "14 мин", website: "https://avrora.spb.ru/" }, { name: "Дом кино", distance: "16 мин", website: "https://domkino.spb.ru/" }] },
  ],
  island: [
    { id: "erarta", time: "11:00", name: "Эрарта", address: "29-я линия В.О., 2", coords: [59.9323, 30.2518], website: "https://www.erarta.com/", note: "Современное искусство", analogs: [{ name: "Артмуза", distance: "12 мин", website: "https://artmuza.spb.ru/" }, { name: "ЦСИ Курёхина", distance: "18 мин", website: "https://kuryokhin.net/" }] },
    { id: "sevkabel", time: "15:00", name: "Севкабель Порт", address: "Кожевенная линия, 40", coords: [59.9238, 30.2416], website: "https://sevcableport.ru/", note: "Еда, события и набережная", analogs: [{ name: "Брусницын", distance: "5 мин", website: "https://brusnitsyn.com/" }, { name: "Новая Голландия", distance: "18 мин на авто", website: "https://www.newhollandsp.ru/" }] },
    { id: "new-holland-island", time: "19:00", name: "Новая Голландия", address: "наб. Адмиралтейского канала, 2", coords: [59.929, 30.2891], website: "https://www.newhollandsp.ru/", note: "Ужин и вечерняя программа", analogs: [{ name: "Никольские ряды", distance: "12 мин", website: "https://nikolskiye.ru/" }, { name: "Севкабель Порт", distance: "18 мин на авто", website: "https://sevcableport.ru/" }] },
  ],
};

function pointDistance(first: [number, number], second: [number, number]) {
  const lat = (first[0] + second[0]) * Math.PI / 360;
  const x = (second[1] - first[1]) * Math.cos(lat);
  const y = second[0] - first[0];
  return Math.hypot(x, y);
}

function distanceKm(first: [number, number], second: [number, number]) {
  const toRad = Math.PI / 180;
  const dLat = (second[0] - first[0]) * toRad;
  const dLon = (second[1] - first[1]) * toRad;
  const lat1 = first[0] * toRad;
  const lat2 = second[0] * toRad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function catalogPlaceKey(item: CatalogItem) {
  return `${item.coords[0].toFixed(4)}:${item.coords[1].toFixed(4)}`;
}

function orderStopsFrom(start: [number, number], stops: VenueStop[]) {
  const remaining = [...stops];
  const ordered: VenueStop[] = [];
  let cursor = start;
  while (remaining.length) {
    remaining.sort((a, b) => pointDistance(cursor, a.coords) - pointDistance(cursor, b.coords));
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    cursor = next.coords;
  }
  const times = stops.map((stop) => stop.time);
  return ordered.map((stop, index) => ({ ...stop, time: times[index] }));
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function placeToCandidate(place: CityPlace): LocationCandidate {
  return { id: place.id, label: place.name, address: place.address, coords: place.coords, kind: place.categories[0] || "Место", source: place.source, website: place.website, description: place.description };
}

function mapWorldPoint(coords: [number, number], zoom: number) {
  const [lat, lon] = coords;
  const scale = 256 * 2 ** zoom;
  const sin = Math.min(.9999, Math.max(-.9999, Math.sin(lat * Math.PI / 180)));
  return { x: (lon + 180) / 360 * scale, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function drawCityMap(ctx: CanvasRenderingContext2D, coords: [number, number][], box: { x: number; y: number; width: number; height: number }) {
  const basePoints = coords.map((point) => mapWorldPoint(point, 0));
  const minX = Math.min(...basePoints.map((point) => point.x));
  const maxX = Math.max(...basePoints.map((point) => point.x));
  const minY = Math.min(...basePoints.map((point) => point.y));
  const maxY = Math.max(...basePoints.map((point) => point.y));
  const zoomX = Math.log2((box.width - 190) / Math.max(maxX - minX, .00001));
  const zoomY = Math.log2((box.height - 150) / Math.max(maxY - minY, .00001));
  const zoom = Math.max(10, Math.min(14, Math.floor(Math.min(zoomX, zoomY))));
  const worldPoints = coords.map((point) => mapWorldPoint(point, zoom));
  const centerX = (Math.min(...worldPoints.map((point) => point.x)) + Math.max(...worldPoints.map((point) => point.x))) / 2;
  const centerY = (Math.min(...worldPoints.map((point) => point.y)) + Math.max(...worldPoints.map((point) => point.y))) / 2;
  const worldLeft = centerX - box.width / 2;
  const worldTop = centerY - box.height / 2;
  const firstTileX = Math.floor(worldLeft / 256);
  const lastTileX = Math.floor((worldLeft + box.width) / 256);
  const firstTileY = Math.floor(worldTop / 256);
  const lastTileY = Math.floor((worldTop + box.height) / 256);
  const tileRequests: Array<Promise<{ image: HTMLImageElement | null; x: number; y: number }>> = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      tileRequests.push(loadCanvasImage(`/api/map/tile?z=${zoom}&x=${tileX}&y=${tileY}`).then((image) => ({ image, x: box.x + tileX * 256 - worldLeft, y: box.y + tileY * 256 - worldTop })));
    }
  }
  const tiles = await Promise.all(tileRequests);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 28);
  ctx.clip();
  ctx.fillStyle = "#11151b";
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.filter = "grayscale(1) brightness(.48) contrast(1.18)";
  tiles.forEach(({ image, x, y }) => { if (image) ctx.drawImage(image, x, y, 256, 256); });
  ctx.filter = "none";
  const shade = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.height);
  shade.addColorStop(0, "rgba(5,7,11,.28)");
  shade.addColorStop(.65, "rgba(5,7,11,.48)");
  shade.addColorStop(1, "rgba(5,7,11,.7)");
  ctx.fillStyle = shade;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
  ctx.strokeStyle = "rgba(183,255,69,.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 28);
  ctx.stroke();
  return worldPoints.map((point) => ({ x: box.x + point.x - worldLeft, y: box.y + point.y - worldTop }));
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("builder");
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("talk");
  const [company, setCompany] = useState("Друзья");
  const [size, setSize] = useState(4);
  const [selectedDates, setSelectedDates] = useState<string[]>(getInitialDates);
  const [availability, setAvailability] = useState<Record<string, number[]>>(getInitialAvailability);
  const [dateDraft, setDateDraft] = useState("");
  const [budgetLimit, setBudgetLimit] = useState(2500);
  const [budgetUnlimited, setBudgetUnlimited] = useState(false);
  const [budgetScope, setBudgetScope] = useState<"person" | "group">("person");
  const [city, setCity] = useState<CityId>("moscow");
  const [district, setDistrict] = useState("Центральный");
  const [locationView, setLocationView] = useState<"map" | "list">("map");
  const [placeQuery, setPlaceQuery] = useState("");
  const [remotePlaceResults, setRemotePlaceResults] = useState<LocationCandidate[]>([]);
  const [placeSearchState, setPlaceSearchState] = useState<"idle" | "loading" | "offline">("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const [customMeetingPoint, setCustomMeetingPoint] = useState<MeetingLocation | null>(null);
  const [pendingMeetingPoint, setPendingMeetingPoint] = useState<LocationCandidate | null>(null);
  const [meetingPointConfirmed, setMeetingPointConfirmed] = useState(false);
  const [prefs, setPrefs] = useState<string[]>(["Прогулка", "Новая кухня"]);
  const [preferenceQuery, setPreferenceQuery] = useState("");
  const [meetingName, setMeetingName] = useState("Августовский вечер");
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("fontanka");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [shareCardUrl, setShareCardUrl] = useState("");
  const [shareCardLoading, setShareCardLoading] = useState(false);
  const [meetingId, setMeetingId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [storageReady, setStorageReady] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [guestMeeting, setGuestMeeting] = useState<StoredMeeting | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPrefs, setGuestPrefs] = useState<string[]>([]);
  const [guestDates, setGuestDates] = useState<string[]>([]);
  const [guestBudget, setGuestBudget] = useState(2500);
  const [guestStage, setGuestStage] = useState<"idle" | "name" | "vote" | "done">("idle");
  const [guestError, setGuestError] = useState("");
  const [stopAlternativeSelections, setStopAlternativeSelections] = useState<Record<string, number>>({});
  const hourDragRef = useRef({ active: false, selecting: true, lastKey: "" });

  const activeCity = cityConfigs[city];
  const cityPlaces = activeCity.places;
  const districts = activeCity.districts;
  const districtCenters = activeCity.districtCenters;
  const selectedGoal = useMemo(() => goals.find((item) => item.id === goal) ?? goals[0], [goal]);
  const sizeLabel = size >= 20 ? "20+" : String(size);
  const sizeWord = size === 2 || size === 3 || size === 4 ? "человека" : "человек";
  const fixedDateSize = company === "Свидание" ? 2 : company === "Парное свидание" ? 4 : null;
  const budget = budgetUnlimited ? "Без ограничений" : `До ${budgetLimit.toLocaleString("ru-RU")} ₽ ${budgetScope === "person" ? "/ чел." : "на всех"}`;
  const budgetProgress = ((budgetLimit - 500) / (10000 - 500)) * 100;
  const peopleProgress = ((size - 2) / (20 - 2)) * 100;
  const selectedHoursCount = Object.values(availability).reduce((total, hours) => total + hours.length, 0);
  const roomParticipants = participants.length ? participants : makeParticipants(size);
  const votedCount = roomParticipants.filter((participant) => participant.status === "ready").length;
  const effectiveBudgetLimit = Math.min(budgetLimit, ...roomParticipants.filter((participant) => participant.status === "ready" && participant.budgetLimit).map((participant) => participant.budgetLimit!), budgetLimit);
  const combinedPrefs = useMemo(() => Array.from(new Set([
    ...prefs,
    ...participants.filter((participant) => participant.status === "ready").flatMap((participant) => participant.prefs ?? []),
  ])), [participants, prefs]);
  const longestWindow = useMemo(() => getLongestWindow(availability), [availability]);
  const hasDayProgram = longestWindow.length >= 7;
  const availablePlans = hasDayProgram ? dayPrograms : demoPlans;
  const currentPlan = availablePlans.find((item) => item.id === selectedPlan) ?? availablePlans[0];
  const meetingCenter: MeetingLocation = customMeetingPoint ?? districtCenters[district] ?? districtCenters[activeCity.defaultDistrict];
  const mapMeetingPoint = pendingMeetingPoint ?? meetingCenter;
  const stopsByPlan = useMemo(() => {
    const result: Record<string, VenueStop[]> = {};
    if (catalogItems.length < 3) return result;
    const routeSize = hasDayProgram ? 4 : 3;
    const schedule = hasDayProgram ? ["11:30", "14:00", "17:00", "20:00"] : ["18:30", "20:00", "21:30"];
    const wantedCategories = combinedPrefs.map((item) => catalogCategoryMap[item]).filter(Boolean);
    const goalCategories = goal === "talk" ? ["cafe", "restaurants", "anticafe", "parks"] : goal === "fun" ? ["amusement", "concert", "games", "quiz"] : goal === "date" || goal === "double-date" ? ["restaurants", "exhibition", "parks", "sights"] : goal === "food" ? ["restaurants", "cafe", "bars"] : goal === "walk" ? ["attractions", "sights", "parks", "tour"] : [];
    const companyCategories = company === "Семья" ? ["kids", "amusement", "museums", "parks"] : [];
    const usedAcrossPlans = new Set<string>();
    const eventFitsAvailability = (item: CatalogItem) => {
      if (!item.startsAt) return true;
      const moment = new Date(item.startsAt * 1000);
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(moment));
      return (availability[date] ?? []).some((availableHour) => Math.abs(availableHour - hour) <= 1);
    };
    const pricePenalty = (item: CatalogItem) => {
      if (budgetUnlimited || item.isFree || !item.price) return 0;
      const parsed = Number(item.price.replace(/\s/g, "").match(/\d+/)?.[0]);
      return Number.isFinite(parsed) && parsed > effectiveBudgetLimit ? 35 : 0;
    };
    const basePool = catalogItems
      .filter(eventFitsAvailability)
      .filter((item, index, items) => items.findIndex((candidate) => catalogPlaceKey(candidate) === catalogPlaceKey(item)) === index)
      .filter((item) => item.distanceKm <= (hasDayProgram ? 5 : 3.5));

    availablePlans.forEach((plan) => {
      const picked: CatalogItem[] = [];
      const routeUsed = new Set<string>();
      let cursor = meetingCenter.coords;
      let travelled = 0;
      const routeDistanceLimit = hasDayProgram ? 6 : 3.5;
      const slots = planSlots[plan.id] ?? planSlots.fontanka;
      for (let index = 0; index < routeSize; index += 1) {
        const slot = slots[Math.min(index, slots.length - 1)];
        const candidates = basePool.filter((item) => !routeUsed.has(catalogPlaceKey(item)) && !usedAcrossPlans.has(catalogPlaceKey(item)) && travelled + distanceKm(cursor, item.coords) <= routeDistanceLimit);
        const matching = candidates.filter((item) => item.categories.some((category) => slot.includes(category)) || (item.type === "event" && slot.some((category) => item.name.toLowerCase().includes(category))));
        const source = matching.length ? matching : candidates;
        source.sort((first, second) => {
          const score = (item: CatalogItem) => {
            const categories = item.categories;
            const preferenceScore = wantedCategories.filter((category) => categories.includes(category)).length * 22;
            const goalScore = [...goalCategories, ...companyCategories].filter((category) => categories.includes(category)).length * 10;
            const slotScore = slot.filter((category) => categories.includes(category)).length * 16;
            const leg = distanceKm(cursor, item.coords);
            return preferenceScore + goalScore + slotScore + (item.type === "event" ? 5 : 0) - item.distanceKm * 8 - leg * 18 - pricePenalty(item);
          };
          return score(second) - score(first);
        });
        const next = source[0];
        if (!next) break;
        picked.push(next);
        const key = catalogPlaceKey(next);
        routeUsed.add(key);
        usedAcrossPlans.add(key);
        travelled += distanceKm(cursor, next.coords);
        cursor = next.coords;
      }
      if (picked.length < routeSize) {
        const fillers = basePool.filter((item) => !routeUsed.has(catalogPlaceKey(item)) && !usedAcrossPlans.has(catalogPlaceKey(item)) && travelled + distanceKm(cursor, item.coords) <= routeDistanceLimit).sort((a, b) => distanceKm(cursor, a.coords) - distanceKm(cursor, b.coords));
        while (picked.length < routeSize && fillers.length) {
          const next = fillers.shift()!; const key = catalogPlaceKey(next);
          if (routeUsed.has(key)) continue;
          picked.push(next); routeUsed.add(key); usedAcrossPlans.add(key); travelled += distanceKm(cursor, next.coords); cursor = next.coords;
        }
      }
      if (picked.length < routeSize) {
        const nearbyReuse = basePool.filter((item) => !routeUsed.has(catalogPlaceKey(item)) && travelled + distanceKm(cursor, item.coords) <= routeDistanceLimit).sort((a, b) => distanceKm(cursor, a.coords) - distanceKm(cursor, b.coords));
        while (picked.length < routeSize && nearbyReuse.length) {
          const next = nearbyReuse.shift()!; const key = catalogPlaceKey(next);
          if (routeUsed.has(key)) continue;
          picked.push(next); routeUsed.add(key); usedAcrossPlans.add(key); travelled += distanceKm(cursor, next.coords); cursor = next.coords;
        }
      }
      result[plan.id] = picked.map((item, index) => {
        const analogs = catalogItems.filter((candidate) => candidate.type === "place" && catalogPlaceKey(candidate) !== catalogPlaceKey(item) && distanceKm(item.coords, candidate.coords) <= 2).sort((a, b) => distanceKm(item.coords, a.coords) - distanceKm(item.coords, b.coords)).slice(0, 2);
        const eventTime = item.startsAt ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(item.startsAt * 1000)) : null;
        return { id: `${plan.id}:${item.id}`, time: eventTime || schedule[index] || schedule.at(-1)!, name: item.name, address: [item.place, item.address].filter(Boolean).join(" · ") || activeCity.name, coords: item.coords, website: item.website || "https://kudago.com/", note: item.type === "event" ? `${item.price || (item.isFree ? "Бесплатно" : "Актуальное событие")} · KudaGo` : item.description?.slice(0, 80) || "Место из городского каталога", analogs: analogs.map((analog) => ({ name: analog.name, distance: `${distanceKm(item.coords, analog.coords).toFixed(1)} км`, website: analog.website || "https://kudago.com/", address: [analog.place, analog.address].filter(Boolean).join(" · ") || activeCity.name, coords: analog.coords, note: analog.description?.slice(0, 80) || "Похожее место рядом" })) } satisfies VenueStop;
      });
    });
    return result;
  }, [activeCity.name, catalogItems, hasDayProgram, combinedPrefs, goal, company, availability, budgetUnlimited, effectiveBudgetLimit, availablePlans, meetingCenter.coords]);
  const localFallbackStops = useMemo(() => {
    const schedule = hasDayProgram ? ["11:30", "14:00", "17:00", "20:00"] : ["18:30", "20:00", "21:30"];
    const routeSize = hasDayProgram ? 4 : 3;
    const nearby = cityPlaces
      .map((place) => ({ place, distance: distanceKm(meetingCenter.coords, place.coords) }))
      .sort((first, second) => first.distance - second.distance);
    const buildStop = (place: CityPlace, planId: string, index: number) => ({
      id: `local:${planId}:${place.id}`,
      time: schedule[index] || schedule.at(-1)!,
      name: place.name,
      address: place.address,
      coords: place.coords,
      website: place.website,
      note: place.description,
      analogs: cityPlaces.filter((candidate) => candidate.id !== place.id).map((candidate) => ({ candidate, distance: distanceKm(place.coords, candidate.coords) })).sort((a, b) => a.distance - b.distance).slice(0, 2).map(({ candidate, distance }) => ({ name: candidate.name, distance: `${distance.toFixed(1)} км`, website: candidate.website, address: candidate.address, coords: candidate.coords, note: candidate.description })),
    } satisfies VenueStop);

    if (city === "moscow") {
      const usedAcrossPlans = new Set<string>();
      const startLimit = hasDayProgram ? 1.8 : 1.15;
      const legLimit = hasDayProgram ? 1.5 : .95;
      const totalLimit = hasDayProgram ? 4.5 : 2.6;
      const results: Record<string, VenueStop[]> = {};
      availablePlans.forEach((plan) => {
        const route: CityPlace[] = [];
        const used = new Set<string>();
        let cursor = meetingCenter.coords;
        let travelled = 0;
        for (let index = 0; index < routeSize; index += 1) {
          const selectFrom = (allowShared: boolean) => cityPlaces
            .filter((place) => !used.has(place.id) && (allowShared || !usedAcrossPlans.has(place.id)))
            .map((place) => ({ place, leg: distanceKm(cursor, place.coords), start: distanceKm(meetingCenter.coords, place.coords) }))
            .filter((item) => item.leg <= (index === 0 ? startLimit : legLimit) && travelled + item.leg <= totalLimit)
            .sort((first, second) => {
              const preference = (item: typeof first) => combinedPrefs.filter((pref) => item.place.categories.some((category) => normalizeSearch(category).includes(normalizeSearch(pref)) || normalizeSearch(pref).includes(normalizeSearch(category)))).length * 1.4;
              return (preference(second) - second.leg * 2.2 - second.start * .35) - (preference(first) - first.leg * 2.2 - first.start * .35);
            });
          const next = selectFrom(false)[0] ?? selectFrom(true)[0] ?? cityPlaces
            .filter((place) => !used.has(place.id))
            .map((place) => ({ place, leg: distanceKm(cursor, place.coords), start: distanceKm(meetingCenter.coords, place.coords) }))
            .filter((item) => item.leg <= (index === 0 ? 2.2 : 1.35) && travelled + item.leg <= (hasDayProgram ? 5 : 3.8))
            .sort((first, second) => first.leg - second.leg)[0];
          if (!next) break;
          route.push(next.place);
          used.add(next.place.id);
          usedAcrossPlans.add(next.place.id);
          travelled += next.leg;
          cursor = next.place.coords;
        }
        results[plan.id] = route.map((place, index) => buildStop(place, plan.id, index));
      });
      return results;
    }

    const compact = nearby.filter((item) => item.distance <= (hasDayProgram ? 5 : 3.5));
    const pool = (compact.length >= routeSize ? compact : nearby).slice(0, Math.max(routeSize, 9));
    return Object.fromEntries(availablePlans.map((plan, planIndex) => {
      const picked = Array.from({ length: Math.min(routeSize, pool.length) }, (_, index) => pool[(index + planIndex * 2) % pool.length].place);
      const stops = picked.map((place, index) => buildStop(place, plan.id, index));
      return [plan.id, orderStopsFrom(meetingCenter.coords, stops)];
    }));
  }, [availablePlans, city, cityPlaces, combinedPrefs, hasDayProgram, meetingCenter.coords]);
  const resolvedStopsByPlan = useMemo(() => Object.fromEntries(availablePlans.map((plan) => {
    const catalogRoute = stopsByPlan[plan.id];
    return [plan.id, catalogRoute?.length >= 3 ? catalogRoute : localFallbackStops[plan.id]];
  })), [availablePlans, localFallbackStops, stopsByPlan]);
  const finalStops = useMemo(() => resolvedStopsByPlan[selectedPlan] ?? localFallbackStops[selectedPlan] ?? [], [localFallbackStops, resolvedStopsByPlan, selectedPlan]);
  const displayStops = useMemo(() => finalStops.map((stop) => {
    const selection = stopAlternativeSelections[`${selectedPlan}:${stop.id}`] ?? 0;
    const alternative = selection > 0 ? stop.analogs[selection - 1] : null;
    if (!alternative?.coords) return stop;
    return { ...stop, name: alternative.name, address: alternative.address || stop.address, coords: alternative.coords, website: alternative.website, note: alternative.note || `Альтернатива рядом · ${alternative.distance}` };
  }), [finalStops, selectedPlan, stopAlternativeSelections]);
  const planDistances = useMemo(() => Object.fromEntries(availablePlans.map((plan) => {
    const stops = resolvedStopsByPlan[plan.id] ?? [];
    let cursor = meetingCenter.coords; let total = 0;
    stops.forEach((stop) => { total += distanceKm(cursor, stop.coords); cursor = stop.coords; });
    return [plan.id, total];
  })), [availablePlans, resolvedStopsByPlan, meetingCenter.coords]);
  const planTitle = useCallback((plan: (typeof availablePlans)[number]) => livePlanTitles[plan.id]?.[hasDayProgram ? "day" : "evening"] || plan.title, [hasDayProgram]);
  const currentPlanTitle = planTitle(currentPlan);
  const districtPlaces = useMemo(() => (district === "Неважно" ? cityPlaces : cityPlaces.filter((place) => place.district === district)).slice(0, 10).map(placeToCandidate), [cityPlaces, district]);
  const localPlaceResults = useMemo(() => {
    const query = normalizeSearch(placeQuery);
    if (query.length < 2) return [];
    const placeMatches = cityPlaces.filter((place) => normalizeSearch(`${place.name} ${place.address} ${place.district} ${place.categories.join(" ")}`).includes(query)).map(placeToCandidate);
    const districtMatches = districts.filter((item) => normalizeSearch(item).includes(query)).map((item) => ({ id: `district-${item}`, label: `${item} район`, address: districtCenters[item].label, coords: districtCenters[item].coords, kind: "Район", source: "Soberu" } satisfies LocationCandidate));
    return [...districtMatches, ...placeMatches].slice(0, 8);
  }, [cityPlaces, districtCenters, districts, placeQuery]);
  const searchItems = useMemo(() => {
    const seen = new Set<string>();
    return [...localPlaceResults, ...remotePlaceResults].filter((item) => {
      const key = `${item.label.toLowerCase()}-${item.coords.map((value) => value.toFixed(4)).join("-")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }, [localPlaceResults, remotePlaceResults]);
  const visiblePlaces = placeQuery.trim().length >= 2 ? searchItems : districtPlaces;
  const timeWindowLabel = longestWindow.length ? `${String(longestWindow.start).padStart(2, "0")}:00–${String(longestWindow.end).padStart(2, "0")}:00` : "время уточняется";
  const filteredPreferences = preferences.filter((item) => `${item.name} ${item.group}`.toLowerCase().includes(preferenceQuery.trim().toLowerCase()));
  const dateLimits = useMemo(() => {
    const min = new Date(); min.setHours(12, 0, 0, 0);
    const max = new Date(min); max.setMonth(max.getMonth() + 2);
    return { min: toIsoDate(min), max: toIsoDate(max) };
  }, []);
  const firstMeetingDate = selectedDates[0] ?? dateLimits.min;

  useEffect(() => {
    const restoreDraft = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("soberu-draft");
        if (stored) {
          const draft = JSON.parse(stored) as Record<string, unknown>;
          const draftCity: CityId = draft.city === "spb" ? "spb" : "moscow";
          const restoreCity = cityConfigs[draftCity];
          if (typeof draft.goal === "string") setGoal(draft.goal);
          if (typeof draft.company === "string") setCompany(draft.company);
          if (typeof draft.size === "number") setSize(Math.min(20, Math.max(2, draft.size)));
          else if (typeof draft.size === "string") setSize(draft.size === "2" ? 2 : draft.size === "3–5" ? 4 : draft.size === "6–10" ? 8 : 12);
          if (Array.isArray(draft.selectedDates)) setSelectedDates(draft.selectedDates as string[]);
          if (draft.availability && typeof draft.availability === "object") setAvailability(draft.availability as Record<string, number[]>);
          if (typeof draft.budgetLimit === "number") setBudgetLimit(draft.budgetLimit);
          if (typeof draft.budgetUnlimited === "boolean") setBudgetUnlimited(draft.budgetUnlimited);
          if (draft.budgetScope === "person" || draft.budgetScope === "group") setBudgetScope(draft.budgetScope);
          setCity(draftCity);
          if (typeof draft.district === "string" && restoreCity.districts.includes(draft.district)) setDistrict(draft.district);
          else setDistrict(restoreCity.defaultDistrict);
          if (draft.meetingPoint && typeof draft.meetingPoint === "object") {
            const point = draft.meetingPoint as Partial<MeetingLocation>;
            const [lat, lon] = Array.isArray(point.coords) ? point.coords : [];
            const [[minLon, minLat], [maxLon, maxLat]] = restoreCity.bounds;
            const belongsToCity = typeof lat === "number" && typeof lon === "number" && lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
            if (typeof point.label === "string" && Array.isArray(point.coords) && point.coords.length === 2 && belongsToCity) {
              setCustomMeetingPoint(point as MeetingLocation);
              setMeetingPointConfirmed(true);
            }
          }
          if (Array.isArray(draft.prefs)) setPrefs(draft.prefs as string[]);
          if (typeof draft.meetingName === "string") setMeetingName(draft.meetingName);
        }
      } catch { /* keep a fresh local draft if old data is damaged */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const draft = { goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPoint: meetingPointConfirmed ? meetingCenter : null, prefs, meetingName };
    window.localStorage.setItem("soberu-draft", JSON.stringify(draft));
  }, [storageReady, goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPointConfirmed, meetingCenter, prefs, meetingName]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("meeting");
    if (!id) return;
    const controller = new AbortController();
    const loadGuestMeeting = async () => {
      let loaded: StoredMeeting | null = null;
      try {
        const response = await fetch(`/api/meetings?id=${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" });
        if (response.ok) loaded = ((await response.json()) as { meeting?: StoredMeeting }).meeting ?? null;
      } catch { /* local fallback below */ }
      if (!loaded) {
        try {
          const local = JSON.parse(window.localStorage.getItem("soberu-meetings") || "[]") as StoredMeeting[];
          loaded = local.find((meeting) => meeting.id === id) ?? null;
        } catch { /* damaged local data */ }
      }
      if (!loaded) { setGuestError("Встреча не найдена или ссылка устарела."); setGuestStage("name"); return; }
      setGuestMeeting(loaded);
      const dates = Array.isArray(loaded.snapshot.selectedDates) ? loaded.snapshot.selectedDates as string[] : [];
      setGuestDates(dates);
      setGuestStage("name");
    };
    void loadGuestMeeting();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (mode !== "room" || !meetingId) return;
    const refresh = async () => {
      let snapshot: Record<string, unknown> | null = null;
      try {
        const response = await fetch(`/api/meetings?id=${encodeURIComponent(meetingId)}`, { cache: "no-store" });
        if (response.ok) snapshot = ((await response.json()) as { meeting?: StoredMeeting }).meeting?.snapshot ?? null;
      } catch { /* local fallback below */ }
      if (!snapshot) {
        try {
          const local = JSON.parse(window.localStorage.getItem("soberu-meetings") || "[]") as StoredMeeting[];
          snapshot = local.find((meeting) => meeting.id === meetingId)?.snapshot ?? null;
        } catch { /* keep current list */ }
      }
      if (snapshot) setParticipants(readParticipants(snapshot, size));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [meetingId, mode, size]);

  useEffect(() => {
    if (mode === "final") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [mode]);

  useEffect(() => {
    const finishHourDrag = () => { hourDragRef.current.active = false; hourDragRef.current.lastKey = ""; };
    window.addEventListener("pointerup", finishHourDrag);
    window.addEventListener("pointercancel", finishHourDrag);
    return () => {
      window.removeEventListener("pointerup", finishHourDrag);
      window.removeEventListener("pointercancel", finishHourDrag);
    };
  }, []);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setRemotePlaceResults([]);
        setPlaceSearchState("idle");
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceSearchState("loading");
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}&city=${city}`, { signal: controller.signal });
        const payload = await response.json() as { items?: LocationCandidate[]; unavailable?: boolean };
        setRemotePlaceResults(payload.items ?? []);
        setPlaceSearchState(payload.unavailable ? "offline" : "idle");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPlaceSearchState("offline");
      }
    }, 320);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [placeQuery, city]);

  useEffect(() => {
    if (!storageReady || !["room", "plans", "final"].includes(mode)) return;
    if (city !== "spb") {
      const fallbackTimer = window.setTimeout(() => { setCatalogItems([]); setCatalogState("fallback"); }, 0);
      return () => window.clearTimeout(fallbackTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogState("loading");
      const dates = selectedDates.length ? [...selectedDates].sort() : [toIsoDate(new Date())];
      const from = Math.floor(new Date(`${dates[0]}T00:00:00+03:00`).getTime() / 1000);
      const to = Math.floor(new Date(`${dates.at(-1)}T23:59:59+03:00`).getTime() / 1000);
      const categories = prefs.map((item) => catalogCategoryMap[item]).filter(Boolean).join(",");
      try {
        const params = new URLSearchParams({ lat: String(meetingCenter.coords[0]), lon: String(meetingCenter.coords[1]), from: String(from), to: String(to), categories, limit: "90" });
        const response = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        const payload = await response.json() as { places?: CatalogItem[]; events?: CatalogItem[] };
        const items = [...(payload.events ?? []), ...(payload.places ?? [])];
        setCatalogItems(items);
        setCatalogState(items.length >= 3 ? "ready" : "fallback");
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setCatalogItems([]); setCatalogState("fallback"); }
      }
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [storageReady, mode, selectedDates, prefs, meetingCenter, city]);

  function toggleFromList(value: string, list: string[], setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function chooseGoal(nextGoal: string) {
    setGoal(nextGoal);
    if (nextGoal === "surprise") {
      setPrefs([]);
      setPreferenceQuery("");
    }
    if (nextGoal === "date") {
      setCompany("Свидание");
      setSize(2);
    }
    if (nextGoal === "double-date") {
      setCompany("Парное свидание");
      setSize(4);
    }
  }

  function chooseCompany(nextCompany: string) {
    setCompany(nextCompany);
    if (nextCompany === "Свидание") setSize(2);
    if (nextCompany === "Парное свидание") setSize(4);
  }

  function addDate() {
    if (!dateDraft || selectedDates.includes(dateDraft) || selectedDates.length >= 7) return;
    setSelectedDates((dates) => [...dates, dateDraft].sort());
    setAvailability((current) => ({ ...current, [dateDraft]: [] }));
    setDateDraft("");
  }

  function removeDate(date: string) {
    setSelectedDates((dates) => dates.filter((item) => item !== date));
    setAvailability((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== date)));
  }

  function toggleHour(date: string, hour: number) {
    setAvailability((current) => {
      const hours = current[date] ?? [];
      return { ...current, [date]: hours.includes(hour) ? hours.filter((item) => item !== hour) : [...hours, hour].sort((a, b) => a - b) };
    });
  }

  function setHour(date: string, hour: number, active: boolean) {
    setAvailability((current) => {
      const hours = current[date] ?? [];
      if (hours.includes(hour) === active) return current;
      return { ...current, [date]: active ? [...hours, hour].sort((a, b) => a - b) : hours.filter((item) => item !== hour) };
    });
  }

  function beginHourDrag(event: React.PointerEvent<HTMLButtonElement>, date: string, hour: number) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const selecting = !availability[date]?.includes(hour);
    hourDragRef.current = { active: true, selecting, lastKey: `${date}-${hour}` };
    setHour(date, hour, selecting);
  }

  function continueHourDrag(date: string, hour: number) {
    const drag = hourDragRef.current;
    const key = `${date}-${hour}`;
    if (!drag.active || drag.lastKey === key) return;
    drag.lastKey = key;
    setHour(date, hour, drag.selecting);
  }

  function moveHourDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!hourDragRef.current.active) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>(".hour-cell");
    const date = target?.dataset.date;
    const hour = Number(target?.dataset.hour);
    if (date && Number.isFinite(hour)) continueHourDrag(date, hour);
  }

  function chooseDistrict(value: string) {
    setDistrict(value);
    setCustomMeetingPoint(null);
    setPendingMeetingPoint(null);
    setMeetingPointConfirmed(false);
    setPlaceQuery("");
    setRemotePlaceResults([]);
    setSearchOpen(false);
    if (value === "Василеостровский") setSelectedPlan("island");
    else if (["Петроградский", "Выборгский", "Приморский"].includes(value)) setSelectedPlan("petro");
    else if (value !== "Неважно") setSelectedPlan("fontanka");
  }

  function chooseCity(nextCity: CityId) {
    if (nextCity === city) return;
    const next = cityConfigs[nextCity];
    setCity(nextCity);
    setDistrict(next.defaultDistrict);
    setCustomMeetingPoint(null);
    setPendingMeetingPoint(null);
    setMeetingPointConfirmed(false);
    setPlaceQuery("");
    setRemotePlaceResults([]);
    setSearchOpen(false);
    setCatalogItems([]);
    setCatalogState("idle");
    setSelectedPlan("fontanka");
  }

  function choosePlan(planId: string, stayOnFinal = false) {
    setSelectedPlan(planId);
    setSelectedVenue(resolvedStopsByPlan[planId]?.[0]?.id || "");
    setShareCardUrl("");
    if (stayOnFinal) window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  }

  function chooseStopAlternative(stop: VenueStop, selection: number) {
    const alternative = selection > 0 ? stop.analogs[selection - 1] : null;
    if (alternative && !alternative.coords) return;
    setStopAlternativeSelections((current) => ({ ...current, [`${selectedPlan}:${stop.id}`]: selection }));
    setSelectedVenue(stop.id);
    setShareCardUrl("");
  }

  const selectLocationCandidate = useCallback((id: string) => {
    const candidate = visiblePlaces.find((item) => item.id === id);
    if (!candidate) return;
    setPendingMeetingPoint(candidate);
    setSearchOpen(false);
  }, [visiblePlaces]);

  const pickPointOnMap = useCallback(async (coords: [number, number]) => {
    const temporary: LocationCandidate = { id: `map-${coords.join("-")}`, label: "Точка на карте", address: "Уточняем адрес…", coords, kind: "Точка", source: "OpenStreetMap" };
    setPendingMeetingPoint(temporary);
    setSearchOpen(false);
    try {
      const response = await fetch(`/api/places/search?lat=${coords[0]}&lon=${coords[1]}&city=${city}`);
      const payload = await response.json() as { items?: LocationCandidate[] };
      const resolved = payload.items?.[0];
      setPendingMeetingPoint((current) => current?.id === temporary.id ? (resolved ? { ...resolved, coords } : { ...temporary, address: `Выбранная точка в ${activeCity.name}` }) : current);
    } catch {
      setPendingMeetingPoint((current) => current?.id === temporary.id ? { ...temporary, address: `Выбранная точка в ${activeCity.name}` } : current);
    }
  }, [activeCity.name, city]);

  function confirmMeetingPoint(point: MeetingLocation) {
    setCustomMeetingPoint(point);
    setPendingMeetingPoint(null);
    setMeetingPointConfirmed(true);
    setPlaceQuery("");
    setRemotePlaceResults([]);
    setSearchOpen(false);
  }

  async function shareMeeting() {
    const url = meetingId ? `${window.location.origin}${window.location.pathname}?meeting=${meetingId}` : window.location.href;
    const shareData = { title: meetingName, text: "Отметь, когда тебе удобно — Soberu соберёт общий план встречи", url };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user closed share sheet */ }
    }
    await navigator.clipboard?.writeText(shareData.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function createShareCard() {
    setShareCardLoading(true);
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1500;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, 1200, 1500); gradient.addColorStop(0, "#090a10"); gradient.addColorStop(.55, "#11131d"); gradient.addColorStop(1, "#0a100a");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 1500); ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
      for (let x = 0; x < 1200; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1500); ctx.stroke(); }
      for (let y = 0; y < 1500; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
      ctx.fillStyle = "#b7ff45"; ctx.font = "800 28px Manrope, Arial"; ctx.fillText("SOBERU · МАРШРУТ ГОТОВ", 86, 92);
      ctx.fillStyle = "#f4f5f8"; ctx.font = "600 58px Georgia, serif"; ctx.fillText(currentPlanTitle, 86, 172);
      ctx.fillStyle = "#8c91a1"; ctx.font = "500 24px Manrope, Arial"; ctx.fillText(`${formatDate(hasDayProgram ? longestWindow.date : firstMeetingDate, "long")} · ${hasDayProgram ? timeWindowLabel : "после 18:30"}`, 86, 220);

      const mapBox = { x: 86, y: 260, width: 1028, height: 520 };
      const routeCoords: [number, number][] = [meetingCenter.coords, ...displayStops.map((stop) => stop.coords)];
      const routePoints = await drawCityMap(ctx, routeCoords, mapBox);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 14; ctx.strokeStyle = "rgba(183,255,69,.2)"; ctx.beginPath(); routePoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = "#b7ff45"; ctx.stroke();
      const meeting = routePoints[0];
      ctx.fillStyle = "#10242a"; ctx.strokeStyle = "#5ee7ff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(meeting.x, meeting.y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#5ee7ff"; ctx.font = "900 20px Manrope, Arial"; ctx.textAlign = "center"; ctx.fillText("М", meeting.x, meeting.y + 7);
      ctx.fillStyle = "rgba(7,9,13,.88)"; ctx.beginPath(); ctx.roundRect(meeting.x - 76, meeting.y - 68, 152, 30, 8); ctx.fill(); ctx.fillStyle = "#dfe4e8"; ctx.font = "800 13px Manrope, Arial"; ctx.fillText("МЕСТО ВСТРЕЧИ", meeting.x, meeting.y - 48);
      routePoints.slice(1).forEach((point, index) => { ctx.fillStyle = "#0e1408"; ctx.strokeStyle = "#b7ff45"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(point.x, point.y, 27, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#b7ff45"; ctx.font = "800 22px Manrope, Arial"; ctx.textAlign = "center"; ctx.fillText(String(index + 1), point.x, point.y + 8); });
      ctx.textAlign = "right"; ctx.fillStyle = "rgba(220,224,230,.56)"; ctx.font = "500 12px Manrope, Arial"; ctx.fillText("© OpenStreetMap contributors", mapBox.x + mapBox.width - 16, mapBox.y + mapBox.height - 14);

      ctx.textAlign = "left"; ctx.fillStyle = "#747988"; ctx.font = "700 19px Manrope, Arial"; ctx.fillText("ОСТАНОВКИ", 86, 835);
      displayStops.forEach((stop, index) => { const y = 890 + index * 155; ctx.fillStyle = "rgba(255,255,255,.052)"; ctx.beginPath(); ctx.roundRect(86, y, 1028, 125, 22); ctx.fill(); ctx.fillStyle = "#b7ff45"; ctx.font = "800 24px Manrope, Arial"; ctx.fillText(`${index + 1} · ${stop.time}`, 118, y + 47); ctx.fillStyle = "#f4f5f8"; ctx.font = "700 28px Manrope, Arial"; ctx.fillText(stop.name, 270, y + 47); ctx.fillStyle = "#8c91a1"; ctx.font = "500 20px Manrope, Arial"; ctx.fillText(stop.address, 270, y + 84); });
      ctx.fillStyle = "#8c91a1"; ctx.font = "500 20px Manrope, Arial"; ctx.fillText(`Место встречи: ${meetingCenter.label} · ${currentPlan.price}`, 86, 1430);
      setShareCardUrl(canvas.toDataURL("image/png"));
    } finally {
      setShareCardLoading(false);
    }
  }

  async function shareGeneratedCard() {
    if (!shareCardUrl) return;
    const blob = await (await fetch(shareCardUrl)).blob(); const file = new File([blob], "soberu-route.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: meetingName, text: currentPlanTitle, files: [file] }); return; }
    const link = document.createElement("a"); link.href = shareCardUrl; link.download = "soberu-route.png"; link.click();
  }

  function beginGuestVote() {
    const name = guestName.trim();
    if (name.length < 2) { setGuestError("Введите имя — так организатор поймёт, кто ответил."); return; }
    setGuestError("");
    setGuestStage("vote");
  }

  async function submitGuestVote() {
    if (!guestMeeting) return;
    const current = readParticipants(guestMeeting.snapshot);
    const normalizedName = guestName.trim().toLocaleLowerCase("ru-RU");
    const existingIndex = current.findIndex((participant) => participant.role === "guest" && participant.name.toLocaleLowerCase("ru-RU") === normalizedName);
    const waitingIndex = current.findIndex((participant) => participant.role === "guest" && participant.status === "waiting");
    const targetIndex = existingIndex >= 0 ? existingIndex : waitingIndex;
    if (targetIndex < 0) { setGuestError("Все места уже заняты. Попросите организатора увеличить размер компании."); return; }
    const updatedParticipants = [...current];
    updatedParticipants[targetIndex] = { ...updatedParticipants[targetIndex], name: guestName.trim(), status: "ready", votedAt: new Date().toISOString(), prefs: guestPrefs, dates: guestDates, budgetLimit: guestBudget };
    const updated: StoredMeeting = { ...guestMeeting, snapshot: { ...guestMeeting.snapshot, participants: updatedParticipants }, updatedAt: new Date().toISOString() };
    try {
      const local = JSON.parse(window.localStorage.getItem("soberu-meetings") || "[]") as StoredMeeting[];
      window.localStorage.setItem("soberu-meetings", JSON.stringify([updated, ...local.filter((meeting) => meeting.id !== updated.id)].slice(0, 20)));
    } catch { window.localStorage.setItem("soberu-meetings", JSON.stringify([updated])); }
    try {
      await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(updated) });
    } catch { /* local vote is still available to the host in this browser */ }
    setGuestMeeting(updated);
    setGuestError("");
    setGuestStage("done");
  }

  async function finishMeeting() {
    const id = meetingId || `SPB-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const meetingParticipants = participants.length === size ? participants : makeParticipants(size);
    const snapshot = { goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPoint: meetingCenter, prefs, meetingName, selectedPlan, participants: meetingParticipants };
    const meeting = { id, name: meetingName.trim(), status: "collecting", snapshot, updatedAt: new Date().toISOString() };
    setParticipants(meetingParticipants);
    setMeetingId(id);
    setSaveState("saving");
    setMode("room");

    try {
      const existing = JSON.parse(window.localStorage.getItem("soberu-meetings") || "[]") as Array<{ id?: string }>;
      window.localStorage.setItem("soberu-meetings", JSON.stringify([meeting, ...existing.filter((item) => item.id !== id)].slice(0, 20)));
    } catch { window.localStorage.setItem("soberu-meetings", JSON.stringify([meeting])); }

    try {
      const response = await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meeting) });
      if (!response.ok) throw new Error("Database unavailable");
      setSaveState("saved");
    } catch { setSaveState("local"); }
  }

  function resetMeeting() {
    setMode("builder"); setStep(1); setGoal("talk"); setCompany("Друзья"); setSize(4);
    setSelectedDates(getInitialDates()); setAvailability(getInitialAvailability()); setDateDraft("");
    setBudgetLimit(2500); setBudgetUnlimited(false); setBudgetScope("person"); setCity("moscow"); setDistrict(cityConfigs.moscow.defaultDistrict);
    setLocationView("map"); setPlaceQuery(""); setRemotePlaceResults([]); setPlaceSearchState("idle"); setSearchOpen(false); setCustomMeetingPoint(null); setPendingMeetingPoint(null); setMeetingPointConfirmed(false); setSelectedVenue(""); setShareCardUrl(""); setShareCardLoading(false); setMeetingId(""); setSaveState("idle"); setPrefs(["Прогулка", "Новая кухня"]); setPreferenceQuery(""); setMeetingName("Августовский вечер"); setParticipants([]); setStopAlternativeSelections({});
  }

  if (guestStage !== "idle") {
    const meetingDates = Array.isArray(guestMeeting?.snapshot.selectedDates) ? guestMeeting.snapshot.selectedDates as string[] : [];
    return <main className="app-shell guest-shell">
      <header className="topbar guest-topbar"><div className="brand"><span className="brand-mark"><i />S</span><span>Soberu</span><small>гость</small></div></header>
      <section className="guest-page">
        {guestStage === "name" && <div className="guest-card guest-name-card"><p className="eyebrow"><span /> Вас пригласили</p><h1>{guestMeeting?.name || "Встреча друзей"}</h1><p>Сначала представьтесь. Имя увидит только организатор встречи — так будет понятно, чей ответ уже учтён.</p><label className="name-field"><span>Ваше имя</span><input value={guestName} onChange={(event) => setGuestName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") beginGuestVote(); }} maxLength={28} placeholder="Например, Андрей" /></label>{guestError && <div className="guest-error">{guestError}</div>}<button className="primary-button full" type="button" onClick={beginGuestVote} disabled={!guestMeeting}>Перейти к голосованию <b>→</b></button></div>}
        {guestStage === "vote" && <div className="guest-card guest-vote-card"><p className="eyebrow"><span /> Ответ для {guestName}</p><h1>Когда и чего хочется?</h1><div className="guest-question"><span>Подходящие даты</span><div className="guest-date-grid">{meetingDates.map((date) => <button type="button" className={guestDates.includes(date) ? "active" : ""} onClick={() => setGuestDates((dates) => dates.includes(date) ? dates.filter((item) => item !== date) : [...dates, date])} key={date}>{formatDate(date)}</button>)}</div></div><div className="guest-question"><span>Что добавить в план</span><div className="preference-grid guest-preferences">{preferences.map((item) => <button className={guestPrefs.includes(item.name) ? "preference active" : "preference"} onClick={() => toggleFromList(item.name, guestPrefs, setGuestPrefs)} type="button" key={item.name}><span>{guestPrefs.includes(item.name) ? "✓" : item.icon}</span><b>{item.name}</b></button>)}</div></div><div className="guest-question"><span>Комфортный бюджет — до {guestBudget.toLocaleString("ru-RU")} ₽ / чел.</span><input className="guest-budget" aria-label="Бюджет гостя" type="range" min="500" max="10000" step="500" value={guestBudget} onChange={(event) => setGuestBudget(Number(event.target.value))} /></div>{guestError && <div className="guest-error">{guestError}</div>}<button className="primary-button full" type="button" onClick={() => void submitGuestVote()} disabled={guestDates.length === 0}>Отправить ответ <b>✓</b></button></div>}
        {guestStage === "done" && <div className="guest-card guest-done"><div className="success-mark">✓</div><p className="eyebrow">Ответ учтён</p><h1>Спасибо, {guestName}!</h1><p>Организатор уже увидит ваш голос и сможет открыть предварительный результат, не дожидаясь остальных.</p></div>}
      </section>
    </main>;
  }

  return (
    <main className={`app-shell mode-${mode}`}>
      <header className="topbar">
        <button className="brand brand-button" onClick={resetMeeting} type="button" aria-label="Soberu — на главную">
          <span className="brand-mark"><i />S</span><span>Soberu</span><small>beta</small>
        </button>
        <div className="city-switch" aria-label="Город встречи"><span className="city-switch-label"><i />Город встречи</span><div>{(["moscow", "spb"] as CityId[]).map((item) => <button key={item} type="button" className={city === item ? "active" : ""} onClick={() => chooseCity(item)}><span>{item === "moscow" ? "МСК" : "СПБ"}</span>{cityConfigs[item].shortName}</button>)}</div></div>
        <button className="quiet-button" onClick={resetMeeting} type="button">+ Новая встреча</button>
      </header>

      {mode === "builder" && (
        <section className="builder-layout">
          <aside className="builder-aside">
            <p className="eyebrow"><span /> Встреча начинается здесь</p>
            <h1>{step === 1 ? <>Собраться —<br /><em>это легко.</em></> : <>Одна компания.<br /><em>Один классный план.</em></>}</h1>
            <p className="lede">
              {step === 1
                ? `Ответьте на несколько простых вопросов. Soberu совместит пожелания друзей и предложит три готовых плана в ${city === "moscow" ? "Москве" : "Санкт-Петербурге"}.`
                : "Задайте основу сейчас. Друзья добавят своё время и пожелания по одной короткой ссылке."}
            </p>
            <div className="aside-summary">
              <span className="summary-kicker"><i /> Черновик встречи</span>
              <strong>{meetingName || "Без названия"}</strong>
              <div className="summary-line"><span>{selectedGoal.icon}</span>{selectedGoal.title}</div>
              <div className="summary-line"><span>⌁</span>{company} · {sizeLabel} чел.</div>
              <div className="summary-line"><span>◷</span>{selectedDates.length || "Нет"} {selectedDates.length === 1 ? "дата" : "даты"} · {selectedHoursCount} ч.</div>
            </div>
            <div className="trust-row">
              <div className="faces" aria-hidden="true"><span>А</span><span>М</span><span>К</span></div>
              <p><strong>Никаких анкет и регистрации</strong><br />друзья ответят меньше чем за минуту</p>
            </div>
          </aside>

          <section className="planner-card" aria-live="polite">
            <div className="step-meta">
              <span>Шаг {String(step).padStart(2, "0")}</span>
              <div className="progress"><i style={{ width: `${step * (100 / 6)}%` }} /></div>
              <span>из 06</span>
            </div>

            {step === 1 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Первым делом</p><h2>Зачем встречаемся?</h2></div><span className="sun-mark">＊</span></div>
                <p className="field-hint">Выберите главную цель — она повлияет на темп и формат планов.</p>
                <div className="goal-grid goal-grid-seven">
                  {goals.map((item) => (
                    <button className={`goal-card ${goal === item.id ? "is-active" : ""}`} key={item.id} onClick={() => chooseGoal(item.id)} type="button">
                      <span className="goal-icon">{item.icon}</span><strong>{item.title}</strong><small>{item.text}</small><span className="goal-check">✓</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Состав компании</p><h2>Кто будет?</h2></div><span className="sun-mark">⌁</span></div>
                <div className="field-group"><span className="field-label">Вы встречаетесь как</span><div className="choice-row">{companies.map((item) => <button className={company === item ? "choice active" : "choice"} onClick={() => chooseCompany(item)} type="button" key={item}>{item}</button>)}</div></div>
                <div className="field-group"><span className="field-label">Сколько вас будет</span><div className={`people-range-box ${fixedDateSize ? "locked" : ""}`}><div className="people-range-head"><span><small>Размер компании</small><strong>{sizeLabel} {sizeWord}</strong></span><b>{company === "Свидание" ? "Свидание — всегда вдвоём" : company === "Парное свидание" ? "Две пары — четыре человека" : size <= 5 ? "Небольшая компания" : size <= 10 ? "Можно одним столом" : "Большая компания"}</b></div><input aria-label="Количество участников" type="range" min="2" max="20" step="1" value={size} disabled={Boolean(fixedDateSize)} style={{ background: `linear-gradient(90deg, var(--violet) 0%, var(--lime) ${peopleProgress}%, rgba(255,255,255,.08) ${peopleProgress}%, rgba(255,255,255,.08) 100%)` }} onChange={(event) => setSize(Number(event.target.value))} /><div className="people-range-foot"><span>2</span><small>{fixedDateSize ? "количество зафиксировано форматом" : "проведите ползунок"}</small><span>20+</span></div></div></div>
                <div className="notice"><span>i</span><p><strong>Участники смогут уточнить это сами.</strong><br />По ссылке мы спросим про детей, алкоголь, доступность и сколько можно ходить.</p></div>
              </div>
            )}

            {step === 3 && (
              <div className="step-panel schedule-panel">
                <div className="planner-heading"><div><p>Общие окна</p><h2>Когда получится?</h2></div><span className="sun-mark">◷</span></div>
                <p className="field-hint">Добавьте до семи дат, затем нажмите на час и проведите пальцем или мышью до конца свободного окна.</p>
                <div className="date-adder">
                  <label><span>Новая дата</span><input type="date" min={dateLimits.min} max={dateLimits.max} value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} /></label>
                  <button type="button" onClick={addDate} disabled={!dateDraft || selectedDates.includes(dateDraft) || selectedDates.length >= 7}>Добавить <b>+</b></button>
                </div>
                <div className="date-limit"><span>{selectedDates.length}/7 дат</span><small>Доступно до {formatDate(dateLimits.max, "long")}</small></div>
                {selectedDates.length > 0 ? (
                  <div className="availability-wrap" onPointerMove={moveHourDrag}>
                    <div className="availability-grid" style={{ gridTemplateColumns: `58px repeat(${selectedDates.length}, minmax(78px, 1fr))` }}>
                      <div className="availability-corner">Время</div>
                      {selectedDates.map((date) => <div className="availability-date" key={date}><strong>{formatDate(date)}</strong><button type="button" onClick={() => removeDate(date)} aria-label={`Удалить ${formatDate(date, "long")}`}>×</button></div>)}
                      {hourSlots.map((hour) => (
                        <div className="availability-row" key={hour} style={{ gridColumn: `1 / span ${selectedDates.length + 1}` }}>
                          <span>{String(hour).padStart(2, "0")}:00</span>
                          {selectedDates.map((date) => {
                            const active = availability[date]?.includes(hour);
                            return <button type="button" key={`${date}-${hour}`} data-date={date} data-hour={hour} className={active ? "hour-cell active" : "hour-cell"} aria-pressed={active} aria-label={`${formatDate(date, "long")}, ${hour}:00`} onPointerDown={(event) => beginHourDrag(event, date, hour)} onPointerEnter={() => continueHourDrag(date, hour)} onClick={(event) => { if (event.detail === 0) toggleHour(date, hour); }}><i /></button>;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div className="empty-schedule"><span>◷</span><p><strong>Добавьте хотя бы одну дату</strong><small>Она появится колонкой в таблице доступности.</small></p></div>}
                <div className="schedule-legend"><span><i /> Свободен</span><span><i /> Не отмечено</span><small>{selectedHoursCount} выбранных часов</small></div>
                {hasDayProgram && <div className="day-program-note"><span>☀</span><p><strong>Есть окно на целый день</strong><small>{formatDate(longestWindow.date)} · {timeWindowLabel}. В подборке появятся программы с несколькими этапами.</small></p></div>}
              </div>
            )}

            {step === 4 && (
              <div className="step-panel geography-panel">
                <div className="planner-heading"><div><p>Район и ориентиры</p><h2>Где начнём?</h2></div><span className="sun-mark">⌖</span></div>
                <p className="field-hint">Найдите адрес, метро, район или достопримечательность — либо поставьте точку прямо на карте. Поиск ограничен городом {activeCity.name}.</p>
                <div className="field-group compact"><span className="field-label">Предпочтительный район</span><div className="choice-row wrap">{districts.map((item) => <button className={district === item ? "choice active" : "choice"} onClick={() => chooseDistrict(item)} type="button" key={item}>{item}</button>)}</div></div>
                <div className="location-toolbar">
                  <div className="location-search-shell">
                    <label><span>⌕</span><input value={placeQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setPlaceQuery(event.target.value); setSearchOpen(true); }} placeholder="Адрес, метро, район или название места" aria-label={`Поиск места встречи в ${city === "moscow" ? "Москве" : "Санкт-Петербурге"}`} autoComplete="off" />{placeSearchState === "loading" ? <i className="search-loader" /> : placeQuery ? <button type="button" onClick={() => { setPlaceQuery(""); setRemotePlaceResults([]); }} aria-label="Очистить поиск">×</button> : null}</label>
                    {searchOpen && placeQuery.trim().length >= 2 && <div className="meeting-search-results">
                      {searchItems.map((item) => <button type="button" key={item.id} onClick={() => selectLocationCandidate(item.id)}><b>{item.kind}</b><p><strong>{item.label}</strong><small>{item.address}</small></p><span>Выбрать →</span></button>)}
                      {placeSearchState === "loading" && searchItems.length === 0 && <div className="meeting-search-status">Ищем только в пределах {activeCity.name}…</div>}
                      {placeSearchState !== "loading" && searchItems.length === 0 && <div className="meeting-search-status">Ничего не нашли. Добавьте улицу, номер дома или название метро.</div>}
                    </div>}
                  </div>
                  <div className="view-switch" aria-label="Вид мест"><button className={locationView === "map" ? "active" : ""} onClick={() => setLocationView("map")} type="button">Карта</button><button className={locationView === "list" ? "active" : ""} onClick={() => setLocationView("list")} type="button">Список <i>{visiblePlaces.length}</i></button></div>
                </div>
                {pendingMeetingPoint ? <div className="meeting-start-card candidate"><span>?</span><p><small>Найдена точка — подтвердите</small><strong>{pendingMeetingPoint.label}</strong><em>{pendingMeetingPoint.address}</em></p><div className="meeting-start-actions"><button type="button" onClick={() => confirmMeetingPoint(pendingMeetingPoint)}>Выбрать местом встречи ✓</button><button type="button" onClick={() => setPendingMeetingPoint(null)}>Отмена</button></div></div>
                  : <div className={`meeting-start-card ${meetingPointConfirmed ? "confirmed" : ""}`}><span>{meetingPointConfirmed ? "✓" : "М"}</span><p><small>{meetingPointConfirmed ? "Точка подтверждена" : "Предложение по району"}</small><strong>{meetingPointConfirmed ? "Место встречи" : meetingCenter.label}</strong><em>{meetingPointConfirmed ? [meetingCenter.label, meetingCenter.address].filter(Boolean).join(" · ") : "Можно выбрать её или найти точный адрес"}</em></p>{meetingPointConfirmed ? <b>Готово ✓</b> : <div className="meeting-start-actions"><button type="button" onClick={() => confirmMeetingPoint(meetingCenter)}>Использовать эту точку</button></div>}</div>}
                {locationView === "map" ? (
                  <SoberuMap cityName={activeCity.name} cityCenter={activeCity.center} cityBounds={activeCity.bounds} meetingPoint={mapMeetingPoint} meetingState={meetingPointConfirmed && !pendingMeetingPoint ? "confirmed" : "candidate"} onMapPick={pickPointOnMap} pickable />
                ) : (
                  <div className="place-browser-list">{visiblePlaces.map((place) => <button className={pendingMeetingPoint?.id === place.id ? "active" : ""} type="button" key={place.id} onClick={() => selectLocationCandidate(place.id)}><span>⌖</span><p><strong>{place.label}</strong><small>{place.address}</small><em>{place.kind} · {place.source}</em></p><b>→</b></button>)}</div>
                )}
                {placeQuery.trim().length >= 2 && placeSearchState !== "loading" && visiblePlaces.length === 0 && <div className="empty-search">Ничего не нашли в границах {activeCity.name}.</div>}
                <p className="place-sources">Адресный поиск: <a href="https://github.com/komoot/photon" target="_blank" rel="noreferrer">Photon</a> и OpenStreetMap. Места для сценариев: OpenStreetMap и городские площадки.{placeSearchState === "offline" ? " Онлайн-поиск временно недоступен — локальные места продолжают работать." : ""}</p>
              </div>
            )}

            {step === 5 && (
              <div className="step-panel wishes-panel">
                <div className="planner-heading"><div><p>Характер встречи</p><h2>Чего точно хочется?</h2></div><span className="sun-mark">✦</span></div>
                <div className="budget-box">
                  <div className="budget-head"><span><small>Ограничение по бюджету</small><strong>{budget}</strong></span><button type="button" className={budgetUnlimited ? "budget-toggle active" : "budget-toggle"} onClick={() => setBudgetUnlimited((value) => !value)}>{budgetUnlimited ? "Лимита нет" : "Без лимита"}</button></div>
                  <input aria-label="Ограничение по бюджету" type="range" min="500" max="10000" step="500" value={budgetLimit} disabled={budgetUnlimited} style={{ background: `linear-gradient(90deg, var(--violet) 0%, var(--lime) ${budgetProgress}%, rgba(255,255,255,.08) ${budgetProgress}%, rgba(255,255,255,.08) 100%)` }} onChange={(event) => setBudgetLimit(Number(event.target.value))} />
                  <div className="budget-foot"><span>500 ₽</span><div className="scope-switch"><button type="button" className={budgetScope === "person" ? "active" : ""} onClick={() => setBudgetScope("person")}>На человека</button><button type="button" className={budgetScope === "group" ? "active" : ""} onClick={() => setBudgetScope("group")}>На всех</button></div><span>10 000 ₽</span></div>
                </div>
                {goal === "surprise" ? <div className="surprise-note"><span>?</span><p><strong>Темы выбирать не нужно</strong><small>Soberu сам смешает разные форматы и соберёт три непохожих компактных маршрута.</small></p></div> : <>
                  <div className="preference-tools"><label><span>⌕</span><input value={preferenceQuery} onChange={(event) => setPreferenceQuery(event.target.value)} placeholder="Найти занятие, место или формат" /></label><small>{prefs.length} выбрано</small></div>
                  <div className="preference-grid expanded">{filteredPreferences.map((item) => <button className={prefs.includes(item.name) ? "preference active" : "preference"} onClick={() => toggleFromList(item.name, prefs, setPrefs)} type="button" key={item.name}><span>{prefs.includes(item.name) ? "✓" : item.icon}</span><b>{item.name}</b><small>{item.group}</small></button>)}</div>
                  {filteredPreferences.length === 0 && <div className="empty-search">Ничего не нашли. Попробуйте более общее слово.</div>}
                </>}
              </div>
            )}

            {step === 6 && (
              <div className="step-panel review-panel">
                <div className="planner-heading"><div><p>Почти готово</p><h2>Назовём встречу</h2></div><span className="sun-mark">✓</span></div>
                <label className="name-field"><span>Название</span><input value={meetingName} onChange={(event) => setMeetingName(event.target.value)} maxLength={42} /></label>
                <div className="review-card">
                  <div><span className="review-icon">{selectedGoal.icon}</span><p><small>Цель</small><strong>{selectedGoal.title}</strong></p></div>
                  <div><span className="review-icon">⌁</span><p><small>Компания</small><strong>{company} · {sizeLabel} чел.</strong></p></div>
                  <div><span className="review-icon">◷</span><p><small>Время</small><strong>{hasDayProgram ? `Целый день · ${timeWindowLabel}` : `${selectedDates.length} даты · ${selectedHoursCount} ч.`}</strong></p></div>
                  <div><span className="review-icon">₽</span><p><small>Бюджет</small><strong>{budget}</strong></p></div>
                  <div><span className="review-icon">⌖</span><p><small>Место встречи</small><strong>{meetingCenter.label}</strong></p></div>
                  <div><span className="review-icon">✦</span><p><small>{goal === "surprise" ? "Подбор" : "Хочется"}</small><strong>{prefs.length ? prefs.slice(0, 2).join(", ") : "Довериться Soberu"}</strong></p></div>
                </div>
                <p className="privacy-note">Мы не собираем адреса участников. Маршрут начнётся от общей точки «Место встречи» и пройдёт только по программе прогулки.</p>
              </div>
            )}

            <div className="planner-footer">
              <button className={`back-button ${step === 1 ? "is-hidden" : ""}`} onClick={() => setStep((value) => Math.max(1, value - 1))} type="button">← Назад</button>
              <button className="primary-button" disabled={(step === 3 && (selectedDates.length === 0 || selectedHoursCount === 0)) || (step === 4 && (!meetingPointConfirmed || Boolean(pendingMeetingPoint))) || (step === 6 && !meetingName.trim())} onClick={() => step < 6 ? setStep(step + 1) : void finishMeeting()} type="button">
                {step === 6 ? "Создать встречу" : "Продолжить"}<b>→</b>
              </button>
            </div>
          </section>
        </section>
      )}

      {mode === "room" && (
        <section className="room-page">
          <div className="success-mark">✓</div><p className="eyebrow">Комната создана</p><h1>{meetingName}</h1>
          <p className="room-lede">Отправьте ссылку друзьям. Они отметят время, бюджет и пожелания — без регистрации.</p>
          <div className="share-bar"><span><small>{saveState === "saved" ? "Сохранено в локальной базе" : saveState === "saving" ? "Сохраняем встречу…" : "Сохранено на этом устройстве"}</small><strong>localhost · {meetingId || "черновик"}</strong></span><button onClick={shareMeeting} type="button">{copied ? "Скопировано ✓" : "Поделиться ↗"}</button></div>
          <div className="room-grid">
            <section className="response-card"><div className="section-title"><div><p>Ответы участников</p><h2>{votedCount} из {size} готовы</h2></div><span className="live-pill">● обновляется</span></div>
              <div className="people-list">{roomParticipants.map((participant, index) => <div className={participant.status === "waiting" ? "waiting" : ""} key={participant.id}><span className={`person-avatar ${participant.role === "host" ? "you" : index % 2 ? "anna" : "misha"}`}>{participant.name.slice(0, 1).toUpperCase()}</span><p><strong>{participant.name}</strong><small>{participant.role === "host" ? "Организатор" : participant.status === "ready" ? "Ответ учтён" : "Ещё не голосовал(а)"}</small></p>{participant.status === "ready" ? <b>Готово ✓</b> : <button onClick={shareMeeting} type="button">Напомнить</button>}</div>)}</div>
            </section>
            <aside className="intersection-card"><p>{votedCount < size ? "Предварительный результат" : hasDayProgram ? "Есть большой общий день" : "Все ответы собраны"}</p><div className="intersection-date"><span>{new Date(`${(hasDayProgram ? longestWindow.date : firstMeetingDate)}T12:00:00`).getDate()}</span><p><strong>{formatDate(hasDayProgram ? longestWindow.date : firstMeetingDate).split(",")[0]}</strong><small>{hasDayProgram ? timeWindowLabel : "18:00–22:00"}</small></p></div><div className="mini-tags"><span>{budget}</span><span>{district}</span><span>{combinedPrefs[0] || "Сюрприз"}</span></div><p className="muted-copy">{votedCount < 2 ? "Нужен ещё хотя бы один ответ, чтобы сравнение было полезным." : votedCount < size ? `Уже ответили ${votedCount} из ${size}. Можно построить предварительные планы сейчас — новые голоса уточнят результат позже.` : hasDayProgram ? "Окно достаточно длинное, поэтому Soberu соберёт цельные программы на день — с понятным темпом и остановками по пути." : "Все ответы учтены — можно сравнить три готовых маршрута."}</p><button className="primary-button full" disabled={votedCount < 2} onClick={() => setMode("plans")} type="button">{votedCount < size ? "Показать предварительный результат" : hasDayProgram ? "Показать программы дня" : "Показать 3 плана"} <b>→</b></button></aside>
          </div>
        </section>
      )}

      {mode === "plans" && (
        <section className="plans-page">
          <div className="plans-header"><div><p className="eyebrow">{formatDate(hasDayProgram ? longestWindow.date : firstMeetingDate)} · {hasDayProgram ? timeWindowLabel : "после 18:00"}</p><h1>{hasDayProgram ? "Три программы на целый день" : "Три плана для вашей компании"}</h1><p>{catalogState === "ready" ? `Маршрут собран из актуальных мест и событий ${activeCity.name}. Нажмите на карточку или точку на карте, чтобы сравнить программу.` : catalogState === "loading" ? `Обновляем актуальные места и события ${activeCity.name}…` : hasDayProgram ? "Длинное общее окно позволило собрать маршруты из нескольких этапов. Нажмите на карточку или точку на карте, чтобы сравнить программу." : "Все варианты проходят по времени и бюджету. Нажмите на карточку или точку на карте, чтобы сравнить маршрут."}</p></div><button className="edit-link" onClick={() => { setMode("builder"); setStep(4); }} type="button">Изменить условия</button></div>
          <section className="routes-overview">
            <SoberuMap cityName={activeCity.name} cityCenter={activeCity.center} cityBounds={activeCity.bounds} meetingPoint={meetingCenter} stops={finalStops} showRoute activeStopId={selectedVenue || finalStops[0]?.id} onStopSelect={setSelectedVenue} height="large" />
            <div className="route-summary"><span className={`plan-number ${currentPlan.color}`}>{currentPlan.number}</span><p><small>Выбранный маршрут</small><strong>{currentPlanTitle}</strong><em>≈ {planDistances[currentPlan.id].toFixed(1)} км весь маршрут</em></p><div><span>{currentPlan.score}</span><small>совпадение</small></div></div>
          </section>
          <div className="plan-list">{availablePlans.map((plan) => (
            <article className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} key={plan.id}>
              <button className="plan-select-area" onClick={() => choosePlan(plan.id)} type="button" aria-label={`Выбрать план ${planTitle(plan)}`}>
                <span className={`plan-number ${plan.color}`}>{plan.number}</span><span className="plan-main"><small className="plan-badge">{plan.badge}</small><strong>{planTitle(plan)}</strong><em>{plan.subtitle}</em></span>
                <span className="plan-meta"><small>≈ {planDistances[plan.id].toFixed(1)} км весь маршрут</small><strong>{plan.price}</strong></span><span className="plan-score"><strong>{plan.score}</strong><small>совпадение</small></span><span className="radio-dot" />
              </button>
              {selectedPlan === plan.id && <div className="plan-details"><p><span>Почему подходит</span>{plan.reason}</p><ol>{plan.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>}
            </article>
          ))}</div>
          <div className="plan-action"><p>{finalStops.length === 0 ? "Для этой точки пока не нашлось компактного маршрута. Вернитесь к условиям и выберите соседний район или точку на карте." : hasDayProgram ? "Остановки уже выстроены от места встречи без возвратов и кругов. Этап можно пропустить, не ломая всю программу." : "На карте показан только общий маршрут прогулки — без поездок каждого участника до места встречи."}</p><button className="primary-button" disabled={finalStops.length === 0} onClick={() => { setSelectedVenue(finalStops[0]?.id || ""); setMode("final"); }} type="button">{hasDayProgram ? "Выбрать программу" : "Выбрать этот план"} <b>→</b></button></div>
        </section>
      )}

      {mode === "final" && (
        <section className="final-page">
          <div className="final-confetti">✦</div><p className="eyebrow">Решено!</p><h1>{currentPlanTitle}</h1><p className="room-lede">{formatDate(hasDayProgram ? longestWindow.date : firstMeetingDate, "long")} · {hasDayProgram ? timeWindowLabel : "встречаемся в 18:30"}</p>
          <div className="final-map-block"><SoberuMap cityName={activeCity.name} cityCenter={activeCity.center} cityBounds={activeCity.bounds} meetingPoint={meetingCenter} stops={displayStops} showRoute activeStopId={selectedVenue || displayStops[0]?.id} onStopSelect={setSelectedVenue} height="large" /></div>
          <div className="final-card"><div className="final-card-head"><span className={`plan-number ${currentPlan.color}`}>{currentPlan.number}</span><div><small>{meetingName}</small><strong>{currentPlan.subtitle}</strong></div><span className="confirmed-pill">План выбран ✓</span></div>
            <div className="route-list interactive">{finalStops.map((sourceStop, index) => { const stop = displayStops[index] ?? sourceStop; const selection = stopAlternativeSelections[`${selectedPlan}:${sourceStop.id}`] ?? 0; return <div className={selectedVenue === sourceStop.id ? "route-stop selected" : "route-stop"} key={sourceStop.id}>
              <button className="route-stop-main" type="button" onClick={() => setSelectedVenue(sourceStop.id)} aria-label={`Показать на карте ${stop.name}`}><span>{stop.time}</span><i>{index + 1}</i><p><strong>{stop.name}</strong><small>{stop.address} · {stop.note}</small></p><b>Изменить ↗</b></button>
              {selectedVenue === sourceStop.id && <div className="venue-more venue-switcher"><div><span>Выберите точку маршрута</span><button className={selection === 0 ? "active" : ""} type="button" onClick={() => chooseStopAlternative(sourceStop, 0)}><strong>{sourceStop.name}</strong><small>Основной вариант</small></button>{sourceStop.analogs.map((analog, analogIndex) => <button className={selection === analogIndex + 1 ? "active" : ""} type="button" disabled={!analog.coords} onClick={() => chooseStopAlternative(sourceStop, analogIndex + 1)} key={`${sourceStop.id}:${analog.name}`}><strong>{analog.name}</strong><small>{analog.distance}</small></button>)}</div><a className="venue-site resource-link" href={stop.website} target="_blank" rel="noreferrer"><span aria-hidden="true">◎</span><em>Ресурс</em></a></div>}
            </div>; })}</div>
            <div className="final-bottom"><span><small>Ориентир по бюджету</small><strong>{currentPlan.price}</strong></span><button onClick={createShareCard} disabled={shareCardLoading} type="button">{shareCardLoading ? `Рисуем карту ${activeCity.shortName}…` : "Поделиться красивой карточкой ↗"}</button></div>
          </div>
          <section className="rejected-plans"><div><small>Остались в подборке</small><h2>Другие варианты</h2><p>Нажмите «Сравнить» — финальная программа сразу заменится выбранной.</p></div><div>{availablePlans.filter((plan) => plan.id !== selectedPlan).map((plan) => <article key={plan.id}><span className={`plan-number ${plan.color}`}>{plan.number}</span><p><small>{plan.badge}</small><strong>{planTitle(plan)}</strong><em>{plan.subtitle} · ≈ {planDistances[plan.id].toFixed(1)} км весь маршрут</em></p><div><strong>{plan.score}</strong><small>{plan.price}</small></div><button type="button" onClick={() => choosePlan(plan.id, true)}>Сравнить ↗</button></article>)}</div></section>
          <div className="final-actions"><button className="back-button" onClick={() => setMode("plans")} type="button">← Вернуться к планам</button><button className="quiet-button" onClick={resetMeeting} type="button">Создать ещё одну встречу</button></div>
        </section>
      )}
      {shareCardUrl && <div className="share-card-modal" role="dialog" aria-modal="true" aria-label="Карточка маршрута"><button className="share-modal-close" type="button" onClick={() => setShareCardUrl("")} aria-label="Закрыть">×</button><div><p>Карточка готова</p><h2>Можно отправить друзьям</h2><img src={shareCardUrl} alt={`Маршрут ${currentPlanTitle}`} /><div><button className="back-button" type="button" onClick={() => setShareCardUrl("")}>Назад</button><button className="primary-button" type="button" onClick={shareGeneratedCard}>Поделиться / скачать <b>↗</b></button></div></div></div>}
    </main>
  );
}
