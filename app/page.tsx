"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SoberuMap from "./components/SoberuMap";
import { cityConfigs, type CityId, type CityPlace } from "./data/places";
import { addContact, createDefaultMemory, MEMORY_STORAGE_KEY, preferenceBoost, readMemory, updateWeights, type MeetingTemplate, type PlaceReaction, type SoberuMemory } from "./lib/soberu-memory";
import { DEFAULT_MEETING_SIGNALS, inferTraits, placeFamily, routeSlots, signalScore, signalSummary, type MeetingSignals } from "./lib/recommendation";

type Mode = "builder" | "room" | "plans" | "final";
type VenueAlternative = { name: string; distance: string; website: string; address?: string; coords?: [number, number]; note?: string };
type VenueStop = { id: string; time: string; name: string; address: string; coords: [number, number]; website: string; note: string; analogs: VenueAlternative[]; tags?: string[] };
type LocationCandidate = { id: string; label: string; address: string; coords: [number, number]; kind: string; source: string; website?: string; description?: string };
type MeetingLocation = { label: string; address?: string; coords: [number, number]; kind?: string; source?: string };
type SaveState = "idle" | "saving" | "saved" | "local";
type CatalogItem = { id: string; type: "place" | "event"; name: string; description?: string | null; place?: string; address?: string | null; coords: [number, number]; categories: string[]; traits?: string[]; qualityScore?: number; popularity?: number; trusted?: boolean; startsAt?: number; price?: string | null; isFree?: boolean; website?: string | null; distanceKm: number };
type Participant = { id: string; name: string; role: "host" | "guest"; status: "ready" | "waiting"; votedAt?: string; prefs?: string[]; dates?: string[]; budgetLimit?: number; signals?: Partial<MeetingSignals> };
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

const signalChoices = {
  pace: [["relaxed", "Без спешки"], ["balanced", "Средний темп"], ["dynamic", "Плотная программа"]],
  noise: [["quiet", "Тише, поговорить"], ["balanced", "Можно по-разному"], ["lively", "Живо и громко"]],
  walking: [["low", "До 15 минут"], ["balanced", "Гулять в меру"], ["high", "Ходить — часть плана"]],
  space: [["indoor", "Только под крышей"], ["mixed", "Смешанный план"], ["outdoor", "Больше воздуха"]],
  food: [["light", "Только перекус"], ["balanced", "Один хороший приём"], ["main", "Еда — центр вечера"]],
  alcohol: [["avoid", "Без алкоголя"], ["neutral", "Неважно"], ["yes", "Можно бар"]],
  spontaneity: [["planned", "Брони и билеты — ок"], ["flexible", "Без разницы"], ["spontaneous", "Без обязательств"]],
  ending: [["dessert", "Десерт и кофе"], ["view", "Красивый вид"], ["bar", "Бар"], ["free", "Решим на месте"]],
} as const;
type SignalChoiceKey = keyof typeof signalChoices;
const signalLabels: Record<SignalChoiceKey, string> = { pace: "Темп", noise: "Атмосфера", walking: "Сколько ходить", space: "Погода и пространство", food: "Роль еды", alcohol: "Алкоголь", spontaneity: "Насколько спонтанно", ending: "Как закончить" };

function mergeMeetingSignals(host: MeetingSignals, participants: Participant[]): MeetingSignals {
  const votes = participants.filter((participant) => participant.status === "ready" && participant.signals).map((participant) => participant.signals!);
  const values = [host, ...votes];
  const mode = <K extends keyof MeetingSignals>(key: K): MeetingSignals[K] => {
    const counts = new Map<MeetingSignals[K], number>();
    values.forEach((value) => { const option = value[key]; if (option !== undefined) counts.set(option as MeetingSignals[K], (counts.get(option as MeetingSignals[K]) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? host[key];
  };
  return {
    ...host,
    pace: mode("pace"), noise: mode("noise"), space: mode("space"), food: mode("food"), spontaneity: mode("spontaneity"), ending: mode("ending"),
    walking: values.some((value) => value.walking === "low") ? "low" : mode("walking"),
    alcohol: values.some((value) => value.alcohol === "avoid") ? "avoid" : mode("alcohol"),
    accessibility: values.some((value) => value.accessibility === true),
    kids: values.some((value) => value.kids === true),
    pets: values.some((value) => value.pets === true),
    avoidCrowds: values.some((value) => value.avoidCrowds === true),
  };
}

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

function makeParticipants(total: number, contactNames: string[] = []): Participant[] {
  return [
    { id: "host", name: "Вы", role: "host", status: "ready", votedAt: new Date().toISOString() },
    ...Array.from({ length: Math.max(1, total) - 1 }, (_, index) => ({ id: `slot-${index + 1}`, name: contactNames[index] || `Гость ${index + 1}`, role: "guest" as const, status: "waiting" as const })),
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

function distanceKm(first: [number, number], second: [number, number]) {
  const toRad = Math.PI / 180;
  const dLat = (second[0] - first[0]) * toRad;
  const dLon = (second[1] - first[1]) * toRad;
  const lat1 = first[0] * toRad;
  const lat2 = second[0] * toRad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function catalogPlaceKey(item: Pick<CatalogItem, "coords">) {
  return `${item.coords[0].toFixed(4)}:${item.coords[1].toFixed(4)}`;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function stopMemoryId(stop: Pick<VenueStop, "name" | "coords">) {
  return `${normalizeSearch(stop.name)}:${stop.coords.map((value) => value.toFixed(4)).join(":")}`;
}

function placeToCandidate(place: CityPlace): LocationCandidate {
  return { id: place.id, label: place.name, address: place.address, coords: place.coords, kind: place.categories[0] || "Место", source: place.source, website: place.website, description: place.description };
}

function cityPlaceCategories(place: CityPlace) {
  const source = place.categories.join(" ").toLowerCase();
  const categories = [...place.categories];
  const mappings: Array<[RegExp, string]> = [
    [/еда|ресторан|стритфуд|рынок/, "restaurants"], [/кофе|кафе/, "cafe"], [/бар|коктейл|вино/, "bars"],
    [/музей|истор|литератур/, "museums"], [/выстав|искус|дизайн/, "exhibition"], [/театр/, "theater"], [/кино/, "cinema"],
    [/парк|сад/, "parks"], [/прогул|архитект|вид|воды/, "attractions"], [/музык|концерт/, "concert"], [/игр|квиз/, "games"],
    [/спорт/, "sport"], [/семья|дет/, "kids"],
  ];
  mappings.forEach(([matcher, category]) => { if (matcher.test(source)) categories.push(category); });
  return Array.from(new Set(categories));
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
  const [meetingSignals, setMeetingSignals] = useState<MeetingSignals>(DEFAULT_MEETING_SIGNALS);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
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
  const [guestSignals, setGuestSignals] = useState<Partial<MeetingSignals>>({ noise: "balanced", walking: "balanced", alcohol: "neutral" });
  const [guestStage, setGuestStage] = useState<"idle" | "name" | "vote" | "done">("idle");
  const [guestError, setGuestError] = useState("");
  const [stopAlternativeSelections, setStopAlternativeSelections] = useState<Record<string, number>>({});
  const [memory, setMemory] = useState<SoberuMemory>(createDefaultMemory);
  const [memoryReady, setMemoryReady] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [routeLayouts, setRouteLayouts] = useState<Record<string, VenueStop[]>>({});
  const [routeSearchOpen, setRouteSearchOpen] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [rebuildIntent, setRebuildIntent] = useState<"compact" | "budget" | "food" | "novelty" | "calm" | "">("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackPositives, setFeedbackPositives] = useState<string[]>([]);
  const [feedbackIssues, setFeedbackIssues] = useState<string[]>([]);
  const [placeReactions, setPlaceReactions] = useState<Record<string, PlaceReaction>>({});
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const hourDragRef = useRef({ active: false, selecting: true, lastKey: "" });
  const autoPlanSelectionRef = useRef("");

  const activeCity = cityConfigs[city];
  const cityPlaces = activeCity.places;
  const districts = activeCity.districts;
  const districtCenters = activeCity.districtCenters;
  const selectedGoal = useMemo(() => goals.find((item) => item.id === goal) ?? goals[0], [goal]);
  const sizeLabel = size >= 20 ? "20+" : String(size);
  const sizeWord = size === 2 || size === 3 || size === 4 ? "человека" : "человек";
  const fixedDateSize = company === "Свидание" ? 2 : company === "Парное свидание" ? 4 : null;
  const budgetScale = budgetScope === "person" ? { min: 500, max: 100000, step: 500 } : { min: 1000, max: 500000, step: 1000 };
  const budget = budgetUnlimited ? "Без ограничений" : `До ${budgetLimit.toLocaleString("ru-RU")} ₽ ${budgetScope === "person" ? "/ чел." : "на всех"}`;
  const budgetProgress = ((budgetLimit - budgetScale.min) / (budgetScale.max - budgetScale.min)) * 100;
  const peopleProgress = ((size - 2) / (20 - 2)) * 100;
  const selectedHoursCount = Object.values(availability).reduce((total, hours) => total + hours.length, 0);
  const selectedContacts = memory.contacts.filter((contact) => selectedContactIds.includes(contact.id));
  const roomParticipants = participants.length ? participants : makeParticipants(size, selectedContacts.map((contact) => contact.name));
  const votedCount = roomParticipants.filter((participant) => participant.status === "ready").length;
  const hostBudgetPerPerson = budgetUnlimited ? Number.POSITIVE_INFINITY : budgetScope === "group" ? budgetLimit / Math.max(1, size) : budgetLimit;
  const guestBudgetLimits = roomParticipants.filter((participant) => participant.status === "ready" && participant.budgetLimit).map((participant) => participant.budgetLimit!);
  const effectiveBudgetLimit = Math.min(hostBudgetPerPerson, ...guestBudgetLimits, hostBudgetPerPerson);
  const combinedPrefs = useMemo(() => Array.from(new Set([
    ...prefs,
    ...participants.filter((participant) => participant.status === "ready").flatMap((participant) => participant.prefs ?? []),
  ])), [participants, prefs]);
  const combinedSignals = useMemo(() => mergeMeetingSignals(meetingSignals, participants), [meetingSignals, participants]);
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
    const pickedByPlan: Record<string, CatalogItem[]> = {};
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
      .map((item) => ({ ...item, traits: item.traits?.length ? item.traits : inferTraits(item.categories, [], `${item.name} ${item.description ?? ""}`) }))
      .filter((item) => item.distanceKm <= (hasDayProgram ? 5.5 : combinedSignals.walking === "low" ? 2.2 : combinedSignals.walking === "high" ? 4.5 : 3.5));

    availablePlans.forEach((plan) => {
      const picked: CatalogItem[] = [];
      const routeUsed = new Set<string>();
      let cursor = meetingCenter.coords;
      let travelled = 0;
      const routeDistanceLimit = hasDayProgram ? (combinedSignals.walking === "low" ? 4 : 6.5) : combinedSignals.walking === "low" ? 2.5 : combinedSignals.walking === "high" ? 5 : 3.6;
      const legLimit = hasDayProgram ? (combinedSignals.walking === "low" ? 1.35 : 2.4) : combinedSignals.walking === "low" ? .85 : combinedSignals.walking === "high" ? 1.8 : 1.25;
      const slots = routeSlots(goal, plan.id, hasDayProgram, wantedCategories);
      for (let index = 0; index < routeSize; index += 1) {
        const slot = slots[Math.min(index, slots.length - 1)];
        const candidates = basePool.filter((item) => {
          const leg = distanceKm(cursor, item.coords);
          return !routeUsed.has(catalogPlaceKey(item)) && !usedAcrossPlans.has(catalogPlaceKey(item)) && leg <= (index === 0 ? legLimit * 1.25 : legLimit) && travelled + leg <= routeDistanceLimit;
        });
        const matching = candidates.filter((item) => item.categories.some((category) => slot.includes(category)) || (item.type === "event" && slot.some((category) => item.name.toLowerCase().includes(category))));
        const source = matching.length ? matching : candidates;
        source.sort((first, second) => {
          const score = (item: CatalogItem) => {
            const categories = item.categories;
            const traits = item.traits ?? [];
            const preferenceScore = wantedCategories.filter((category) => categories.includes(category)).length * 22;
            const goalScore = [...goalCategories, ...companyCategories].filter((category) => categories.includes(category)).length * 10;
            const slotScore = slot.filter((category) => categories.includes(category)).length * 16;
            const leg = distanceKm(cursor, item.coords);
            const personalScore = preferenceBoost(memory.preferenceWeights, [...categories, ...traits]) * 20;
            const favoriteScore = memory.favoritePlaces.some((place) => normalizeSearch(place.name) === normalizeSearch(item.name)) ? 24 : 0;
            const visitedPenalty = memory.visitedPlaceIds.some((id) => id.includes(item.id) || id.includes(normalizeSearch(item.name))) ? (goal === "surprise" || rebuildIntent === "novelty" ? 36 : 7) : 0;
            const compactBonus = rebuildIntent === "compact" || rebuildIntent === "calm" ? -leg * 16 : 0;
            const foodBonus = rebuildIntent === "food" && categories.some((category) => ["restaurants", "cafe", "bars"].includes(category)) ? 24 : 0;
            const budgetBonus = rebuildIntent === "budget" && (item.isFree || !item.price) ? 18 : 0;
            const familyPenalty = goal !== "food" && picked.some((selected) => placeFamily(selected.categories, selected.name) === placeFamily(categories, item.name)) ? 24 : 0;
            const planBias = plan.id === "petro" ? (traits.includes("quiet") ? 12 : 0) - leg * 7 : plan.id === "island" ? (item.type === "event" ? 12 : 0) + (traits.includes("romantic") || traits.includes("lively") ? 8 : 0) : preferenceScore * .2;
            const backtrackPenalty = picked.length && distanceKm(meetingCenter.coords, item.coords) + .2 < distanceKm(meetingCenter.coords, cursor) ? 10 : 0;
            return preferenceScore + goalScore + slotScore + signalScore(combinedSignals, traits, item.type === "event") + personalScore + favoriteScore + foodBonus + budgetBonus + compactBonus + planBias + (item.qualityScore ?? 0) * .18 + (item.trusted ? 24 : 0) + (item.type === "event" ? 5 : 0) - item.distanceKm * 7 - leg * 20 - pricePenalty(item) - visitedPenalty - familyPenalty - backtrackPenalty;
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
        const fillers = basePool.filter((item) => !routeUsed.has(catalogPlaceKey(item)) && !usedAcrossPlans.has(catalogPlaceKey(item)) && distanceKm(cursor, item.coords) <= legLimit * 1.35 && travelled + distanceKm(cursor, item.coords) <= routeDistanceLimit).sort((a, b) => distanceKm(cursor, a.coords) - distanceKm(cursor, b.coords));
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
      pickedByPlan[plan.id] = picked;
    });

    const allPrimaryKeys = new Set(Object.values(pickedByPlan).flat().map(catalogPlaceKey));
    Object.entries(pickedByPlan).forEach(([planId, picked]) => {
      const usedAnalogs = new Set<string>();
      result[planId] = picked.map((item, index) => {
        const family = placeFamily(item.categories, item.name);
        const analogs = basePool.filter((candidate) => {
          const key = catalogPlaceKey(candidate);
          return candidate.type === "place" && !allPrimaryKeys.has(key) && !usedAnalogs.has(key) && placeFamily(candidate.categories, candidate.name) === family && distanceKm(item.coords, candidate.coords) <= (city === "moscow" ? 1.1 : 1.25);
        }).sort((a, b) => {
          const score = (candidate: CatalogItem) => distanceKm(item.coords, candidate.coords) * 8 - (candidate.qualityScore ?? 0) * .08 - signalScore(combinedSignals, candidate.traits ?? [], false) * .08;
          return score(a) - score(b);
        }).slice(0, 3);
        analogs.forEach((analog) => usedAnalogs.add(catalogPlaceKey(analog)));
        const eventTime = item.startsAt ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(item.startsAt * 1000)) : null;
        return { id: `${planId}:${item.id}`, time: eventTime || schedule[index] || schedule.at(-1)!, name: item.name, address: [item.place, item.address].filter(Boolean).join(" · ") || activeCity.name, coords: item.coords, website: item.website || "https://kudago.com/", note: item.type === "event" ? `${item.price || (item.isFree ? "Бесплатно" : "Актуальное событие")} · KudaGo` : item.description?.slice(0, 80) || "Место из городского каталога", tags: [...item.categories, ...(item.traits ?? [])], analogs: analogs.map((analog) => ({ name: analog.name, distance: `${distanceKm(item.coords, analog.coords).toFixed(1)} км`, website: analog.website || "https://kudago.com/", address: [analog.place, analog.address].filter(Boolean).join(" · ") || activeCity.name, coords: analog.coords, note: analog.description?.slice(0, 80) || "Похожее место той же роли" })) } satisfies VenueStop;
      });
    });
    return result;
  }, [activeCity.name, availability, availablePlans, budgetUnlimited, catalogItems, city, combinedPrefs, combinedSignals, company, effectiveBudgetLimit, goal, hasDayProgram, meetingCenter.coords, memory.favoritePlaces, memory.preferenceWeights, memory.visitedPlaceIds, rebuildIntent]);
  const localFallbackStops = useMemo(() => {
    const schedule = hasDayProgram ? ["11:30", "14:00", "17:00", "20:00"] : ["18:30", "20:00", "21:30"];
    const routeSize = hasDayProgram ? 4 : 3;
    const wantedCategories = combinedPrefs.map((item) => catalogCategoryMap[item]).filter(Boolean);
    const traitsById = new Map(cityPlaces.map((place) => [place.id, inferTraits(place.categories, [], `${place.name} ${place.description}`)]));
    const pickedByPlan: Record<string, CityPlace[]> = {};
    const usedAcrossPlans = new Set<string>();
    const startLimit = hasDayProgram ? (combinedSignals.walking === "low" ? 1.6 : 2.6) : combinedSignals.walking === "low" ? .9 : combinedSignals.walking === "high" ? 1.8 : 1.25;
    const legLimit = hasDayProgram ? (combinedSignals.walking === "low" ? 1.1 : 1.8) : combinedSignals.walking === "low" ? .7 : combinedSignals.walking === "high" ? 1.35 : .95;
    const totalLimit = hasDayProgram ? (combinedSignals.walking === "low" ? 3.6 : 5.2) : combinedSignals.walking === "low" ? 2 : combinedSignals.walking === "high" ? 4.2 : 2.9;

    availablePlans.forEach((plan) => {
      const route: CityPlace[] = [];
      const used = new Set<string>();
      let cursor = meetingCenter.coords;
      let travelled = 0;
      const slots = routeSlots(goal, plan.id, hasDayProgram, wantedCategories);
      for (let index = 0; index < routeSize; index += 1) {
        const slot = slots[Math.min(index, slots.length - 1)];
        const candidates = cityPlaces.map((place) => ({ place, leg: distanceKm(cursor, place.coords), start: distanceKm(meetingCenter.coords, place.coords), traits: traitsById.get(place.id) ?? [] }))
          .filter((item) => !used.has(item.place.id) && !usedAcrossPlans.has(item.place.id) && item.leg <= (index === 0 ? startLimit : legLimit) && travelled + item.leg <= totalLimit);
        const score = (item: typeof candidates[number]) => {
          const normalized = item.place.categories.map(normalizeSearch);
          const slotMatch = slot.filter((category) => normalized.some((value) => value.includes(normalizeSearch(category)) || normalizeSearch(category).includes(value))).length * 14;
          const prefMatch = combinedPrefs.filter((pref) => normalized.some((value) => value.includes(normalizeSearch(pref)) || normalizeSearch(pref).includes(value))).length * 18;
          const familyPenalty = goal !== "food" && route.some((selected) => placeFamily(selected.categories, selected.name) === placeFamily(item.place.categories, item.place.name)) ? 20 : 0;
          const personal = preferenceBoost(memory.preferenceWeights, [...item.place.categories, ...item.traits]) * 18;
          const favorite = memory.favoritePlaces.some((favoritePlace) => normalizeSearch(favoritePlace.name) === normalizeSearch(item.place.name)) ? 22 : 0;
          const planBias = plan.id === "petro" ? (item.traits.includes("quiet") ? 10 : 0) - item.leg * 7 : plan.id === "island" && (item.traits.includes("romantic") || item.traits.includes("lively")) ? 10 : 0;
          const intent = rebuildIntent === "food" && item.traits.includes("food") ? 20 : rebuildIntent === "calm" && item.traits.includes("quiet") ? 18 : rebuildIntent === "compact" ? -item.leg * 16 : rebuildIntent === "budget" && item.traits.includes("free") ? 18 : 0;
          const visitedPenalty = memory.visitedPlaceIds.some((id) => id.includes(normalizeSearch(item.place.name))) ? (rebuildIntent === "novelty" ? 30 : 5) : 0;
          return slotMatch + prefMatch + signalScore(combinedSignals, item.traits, false) + personal + favorite + planBias + intent - item.leg * 22 - item.start * 3 - familyPenalty - visitedPenalty;
        };
        const next = [...candidates].sort((a, b) => score(b) - score(a))[0] ?? cityPlaces
          .map((place) => ({ place, leg: distanceKm(cursor, place.coords), start: distanceKm(meetingCenter.coords, place.coords) }))
          .filter((item) => !used.has(item.place.id) && item.leg <= (index === 0 ? startLimit * 1.4 : legLimit * 1.35) && travelled + item.leg <= totalLimit * 1.2)
          .sort((a, b) => a.leg - b.leg)[0];
        if (!next) break;
        route.push(next.place); used.add(next.place.id); usedAcrossPlans.add(next.place.id); travelled += next.leg; cursor = next.place.coords;
      }
      pickedByPlan[plan.id] = route;
    });

    const allPrimaryIds = new Set(Object.values(pickedByPlan).flat().map((place) => place.id));
    const buildStop = (place: CityPlace, planId: string, index: number, usedAnalogs: Set<string>) => ({
      id: `local:${planId}:${place.id}`,
      time: schedule[index] || schedule.at(-1)!,
      name: place.name,
      address: place.address,
      coords: place.coords,
      website: place.website,
      note: place.description,
      tags: [...place.categories, ...(traitsById.get(place.id) ?? [])],
      analogs: cityPlaces.filter((candidate) => !allPrimaryIds.has(candidate.id) && !usedAnalogs.has(candidate.id) && placeFamily(candidate.categories, candidate.name) === placeFamily(place.categories, place.name)).map((candidate) => ({ candidate, distance: distanceKm(place.coords, candidate.coords) })).filter((item) => item.distance <= (city === "moscow" ? 1.1 : 1.25)).sort((a, b) => a.distance - b.distance).slice(0, 3).map(({ candidate, distance }) => { usedAnalogs.add(candidate.id); return { name: candidate.name, distance: `${distance.toFixed(1)} км`, website: candidate.website, address: candidate.address, coords: candidate.coords, note: candidate.description }; }),
    } satisfies VenueStop);
    return Object.fromEntries(availablePlans.map((plan) => {
      const usedAnalogs = new Set<string>();
      return [plan.id, (pickedByPlan[plan.id] ?? []).map((place, index) => buildStop(place, plan.id, index, usedAnalogs))];
    }));
  }, [availablePlans, city, cityPlaces, combinedPrefs, combinedSignals, goal, hasDayProgram, meetingCenter.coords, memory.favoritePlaces, memory.preferenceWeights, memory.visitedPlaceIds, rebuildIntent]);
  const resolvedStopsByPlan = useMemo(() => Object.fromEntries(availablePlans.map((plan) => {
    const catalogRoute = stopsByPlan[plan.id];
    return [plan.id, catalogRoute?.length >= 3 ? catalogRoute : localFallbackStops[plan.id]];
  })), [availablePlans, localFallbackStops, stopsByPlan]);
  const finalStops = useMemo(() => resolvedStopsByPlan[selectedPlan] ?? localFallbackStops[selectedPlan] ?? [], [localFallbackStops, resolvedStopsByPlan, selectedPlan]);
  const editableStops = routeLayouts[selectedPlan] ?? finalStops;
  const displayStops = useMemo(() => editableStops.map((stop) => {
    const selection = stopAlternativeSelections[`${selectedPlan}:${stop.id}`] ?? 0;
    const alternative = selection > 0 ? stop.analogs[selection - 1] : null;
    if (!alternative?.coords) return stop;
    return { ...stop, name: alternative.name, address: alternative.address || stop.address, coords: alternative.coords, website: alternative.website, note: alternative.note || `Альтернатива рядом · ${alternative.distance}` };
  }), [editableStops, selectedPlan, stopAlternativeSelections]);
  const planDistances = useMemo(() => Object.fromEntries(availablePlans.map((plan) => {
    const stops = resolvedStopsByPlan[plan.id] ?? [];
    let cursor = meetingCenter.coords; let total = 0;
    stops.forEach((stop) => { total += distanceKm(cursor, stop.coords); cursor = stop.coords; });
    return [plan.id, total];
  })), [availablePlans, resolvedStopsByPlan, meetingCenter.coords]);
  const planMatches = useMemo(() => Object.fromEntries(availablePlans.map((plan) => {
    const stops = resolvedStopsByPlan[plan.id] ?? [];
    const tags = stops.flatMap((stop) => stop.tags ?? []);
    const families = new Set(stops.map((stop) => placeFamily(stop.tags ?? [], stop.name)));
    const preferenceHits = combinedPrefs.filter((preference) => tags.some((tag) => normalizeSearch(tag).includes(normalizeSearch(preference)) || normalizeSearch(preference).includes(normalizeSearch(tag)))).length;
    const distanceTarget = combinedSignals.walking === "low" ? 2.2 : combinedSignals.walking === "high" ? 5 : 3.5;
    const distanceFit = Math.max(-14, 12 - Math.max(0, planDistances[plan.id] - distanceTarget) * 8);
    const signalFit = stops.length ? stops.reduce((total, stop) => total + signalScore(combinedSignals, stop.tags ?? [], false), 0) / stops.length * .28 : -20;
    const completeness = stops.length >= (hasDayProgram ? 4 : 3) ? 8 : -18;
    const diversity = families.size >= Math.min(3, stops.length) ? 8 : 0;
    const personal = preferenceBoost(memory.preferenceWeights, tags) * 3;
    const raw = 68 + preferenceHits * 5 + distanceFit + signalFit + completeness + diversity + personal + (plan.id === "fontanka" ? 2 : plan.id === "petro" ? 0 : -2);
    const percent = Math.round(Math.max(61, Math.min(97, raw)));
    const why = [
      preferenceHits ? `${preferenceHits} совпад. по желаниям` : "сбалансирован по формату",
      `${planDistances[plan.id].toFixed(1)} км по программе`,
      families.size > 1 ? `${families.size} разных типа остановок` : "единый спокойный формат",
    ];
    return [plan.id, { percent, why }];
  })), [availablePlans, combinedPrefs, combinedSignals, hasDayProgram, memory.preferenceWeights, planDistances, resolvedStopsByPlan]);
  const bestPlanId = useMemo(() => [...availablePlans].sort((a, b) => (planMatches[b.id]?.percent ?? 0) - (planMatches[a.id]?.percent ?? 0))[0]?.id ?? availablePlans[0]?.id, [availablePlans, planMatches]);
  const planBadge = useCallback((plan: (typeof availablePlans)[number]) => plan.id === bestPlanId ? "Лучшее совпадение" : plan.id === "petro" ? "Больше общения" : plan.id === "island" ? "Больше впечатлений" : "Сбалансированный план", [bestPlanId]);
  const planTitle = useCallback((plan: (typeof availablePlans)[number]) => livePlanTitles[plan.id]?.[hasDayProgram ? "day" : "evening"] || plan.title, [hasDayProgram]);
  const currentPlanTitle = planTitle(currentPlan);
  const routeReasons = useMemo(() => {
    const reasons = [...(planMatches[currentPlan.id]?.why ?? [`${planDistances[currentPlan.id].toFixed(1)} км от старта по всей программе`])];
    if (combinedPrefs.length) reasons.push(`учтены желания: ${combinedPrefs.slice(0, 2).join(", ")}`);
    if (memory.favoritePlaces.some((favorite) => displayStops.some((stop) => normalizeSearch(stop.name) === normalizeSearch(favorite.name)))) reasons.push("в маршруте есть ваше избранное");
    if (!budgetUnlimited) reasons.push(`укладывается в ориентир ${budgetLimit.toLocaleString("ru-RU")} ₽`);
    if (selectedContacts.length) reasons.push(`приглашены контакты: ${selectedContacts.map((contact) => contact.name).join(", ")}`);
    return reasons.slice(0, 4);
  }, [budgetLimit, budgetUnlimited, combinedPrefs, currentPlan.id, displayStops, memory.favoritePlaces, planDistances, planMatches, selectedContacts]);
  const currentRouteMemoryId = `${selectedPlan}:${displayStops.map(stopMemoryId).join("|")}`;
  const currentRouteSaved = memory.savedRoutes.some((route) => route.id === currentRouteMemoryId);
  const currentMeetingSaved = memory.savedMeetings.some((meeting) => meeting.id === (meetingId || `draft:${normalizeSearch(meetingName)}`));
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
  const routeSearchResults = useMemo(() => {
    const query = normalizeSearch(routeSearchQuery);
    const used = new Set(displayStops.map((stop) => catalogPlaceKey(stop)));
    return catalogItems.filter((item) => !used.has(catalogPlaceKey(item)) && (query.length < 2 || normalizeSearch(`${item.name} ${item.place ?? ""} ${item.address ?? ""} ${item.categories.join(" ")}`).includes(query)))
      .map((item) => ({ item, near: Math.min(distanceKm(meetingCenter.coords, item.coords), ...displayStops.map((stop) => distanceKm(stop.coords, item.coords))) }))
      .filter(({ near }) => near <= (combinedSignals.walking === "low" ? .9 : 1.5))
      .sort((a, b) => a.near - b.near || (b.item.qualityScore ?? 0) - (a.item.qualityScore ?? 0)).slice(0, 8);
  }, [catalogItems, combinedSignals.walking, displayStops, meetingCenter.coords, routeSearchQuery]);
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
    const restoreMemory = window.setTimeout(() => {
      setMemory(readMemory(window.localStorage.getItem(MEMORY_STORAGE_KEY)));
      setMemoryReady(true);
    }, 0);
    return () => window.clearTimeout(restoreMemory);
  }, []);

  useEffect(() => {
    if (!memoryReady) return;
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
  }, [memory, memoryReady]);

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
           if (draft.meetingSignals && typeof draft.meetingSignals === "object") setMeetingSignals({ ...DEFAULT_MEETING_SIGNALS, ...(draft.meetingSignals as Partial<MeetingSignals>) });
          if (typeof draft.meetingName === "string") setMeetingName(draft.meetingName);
        }
      } catch { /* keep a fresh local draft if old data is damaged */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const draft = { goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPoint: meetingPointConfirmed ? meetingCenter : null, prefs, meetingSignals, meetingName };
    window.localStorage.setItem("soberu-draft", JSON.stringify(draft));
  }, [storageReady, goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPointConfirmed, meetingCenter, prefs, meetingSignals, meetingName]);

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
    if (mode !== "plans" || !bestPlanId || !resolvedStopsByPlan[bestPlanId]?.length) return;
    const key = `${meetingId}:${catalogState}:${catalogItems.length}`;
    if (autoPlanSelectionRef.current === key) return;
    autoPlanSelectionRef.current = key;
    setSelectedPlan(bestPlanId);
    setSelectedVenue(resolvedStopsByPlan[bestPlanId]?.[0]?.id || "");
  }, [bestPlanId, catalogItems.length, catalogState, meetingId, mode, resolvedStopsByPlan]);

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
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogState("loading");
      const dates = selectedDates.length ? [...selectedDates].sort() : [toIsoDate(new Date())];
      const from = Math.floor(new Date(`${dates[0]}T00:00:00+03:00`).getTime() / 1000);
      const to = Math.floor(new Date(`${dates.at(-1)}T23:59:59+03:00`).getTime() / 1000);
      const categories = prefs.map((item) => catalogCategoryMap[item]).filter(Boolean).join(",");
      try {
        const params = new URLSearchParams({ city, lat: String(meetingCenter.coords[0]), lon: String(meetingCenter.coords[1]), from: String(from), to: String(to), categories, limit: "140" });
        const response = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        const payload = await response.json() as { places?: CatalogItem[]; events?: CatalogItem[] };
        const curated: CatalogItem[] = cityPlaces.map((place) => {
          const categories = cityPlaceCategories(place);
          return { id: `curated:${place.id}`, type: "place", name: place.name, description: place.description, address: place.address, coords: place.coords, categories, traits: inferTraits(categories, [], `${place.name} ${place.description}`), qualityScore: 100, trusted: true, website: place.website, distanceKm: distanceKm(meetingCenter.coords, place.coords) };
        });
        const items = [...(payload.events ?? []), ...curated, ...(payload.places ?? [])].filter((item, index, source) => source.findIndex((candidate) => normalizeSearch(candidate.name) === normalizeSearch(item.name) && distanceKm(candidate.coords, item.coords) < .2) === index);
        setCatalogItems(items);
        setCatalogState(items.length >= 3 ? "ready" : "fallback");
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setCatalogItems([]); setCatalogState("fallback"); }
      }
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [storageReady, mode, selectedDates, prefs, meetingCenter, city, cityPlaces]);

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
    if (mode !== "builder") { setMode("builder"); setStep(4); }
  }

  function choosePlan(planId: string, stayOnFinal = false) {
    autoPlanSelectionRef.current = `${meetingId}:${catalogState}:${catalogItems.length}`;
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

  function createContact() {
    const name = newContactName.trim();
    if (name.length < 2) return;
    const result = addContact(memory, name);
    setMemory(result.memory);
    const canSelect = !fixedDateSize || selectedContactIds.length < fixedDateSize - 1;
    if (canSelect) {
      setSelectedContactIds((ids) => ids.includes(result.contactId) ? ids : [...ids, result.contactId]);
      if (!fixedDateSize) setSize((current) => Math.max(current, Math.min(20, selectedContactIds.length + 2)));
    }
    setNewContactName("");
  }

  function toggleContact(contactId: string) {
    setSelectedContactIds((ids) => {
      if (!ids.includes(contactId) && fixedDateSize && ids.length >= fixedDateSize - 1) return ids;
      const next = ids.includes(contactId) ? ids.filter((id) => id !== contactId) : [...ids, contactId];
      if (!ids.includes(contactId)) setSize((current) => Math.max(current, Math.min(20, next.length + 1)));
      return next;
    });
  }

  function toggleFavoritePlace(stop: VenueStop) {
    const id = stopMemoryId(stop);
    const exists = memory.favoritePlaces.some((place) => place.id === id);
    setMemory((current) => ({
      ...current,
      favoritePlaces: exists ? current.favoritePlaces.filter((place) => place.id !== id) : [...current.favoritePlaces, { id, name: stop.name, address: stop.address, city: activeCity.name, tags: stop.tags ?? [], savedAt: new Date().toISOString() }],
      preferenceWeights: updateWeights(current.preferenceWeights, stop.tags ?? [], exists ? -.25 : .25),
    }));
  }

  function saveCurrentRoute() {
    const id = `${selectedPlan}:${displayStops.map(stopMemoryId).join("|")}`;
    setMemory((current) => ({ ...current, savedRoutes: current.savedRoutes.some((route) => route.id === id) ? current.savedRoutes.filter((route) => route.id !== id) : [...current.savedRoutes, { id, title: currentPlanTitle, city: activeCity.name, stopNames: displayStops.map((stop) => stop.name), stopIds: displayStops.map(stopMemoryId), savedAt: new Date().toISOString() }] }));
  }

  function saveCurrentMeeting() {
    const id = meetingId || `draft:${normalizeSearch(meetingName)}`;
    setMemory((current) => ({ ...current, savedMeetings: current.savedMeetings.some((meeting) => meeting.id === id) ? current.savedMeetings.filter((meeting) => meeting.id !== id) : [...current.savedMeetings, { id, name: meetingName, city: activeCity.name, goal, people: size, savedAt: new Date().toISOString() }] }));
  }

  function saveMeetingTemplate() {
    const id = `template:${city}:${normalizeSearch(meetingName || `${company}-${goal}`)}`;
    const template: MeetingTemplate = { id, name: meetingName.trim() || `${company}: новый план`, city, goal, company, size, prefs, signals: meetingSignals, budgetLimit, budgetScope, createdAt: new Date().toISOString() };
    setMemory((current) => ({ ...current, templates: [...current.templates.filter((item) => item.id !== id), template] }));
  }

  function applyMeetingTemplate(template: MeetingTemplate) {
    const config = cityConfigs[template.city];
    setCity(template.city); setDistrict(config.defaultDistrict); setGoal(template.goal); setCompany(template.company); setSize(template.size); setPrefs(template.prefs); setMeetingSignals({ ...DEFAULT_MEETING_SIGNALS, ...template.signals }); setBudgetLimit(template.budgetLimit); setBudgetScope(template.budgetScope); setMeetingName(template.name); setCustomMeetingPoint(null); setMeetingPointConfirmed(false); setPendingMeetingPoint(null); setMode("builder"); setStep(3); setMemoryOpen(false);
  }

  function removeMemoryItem(kind: "contact" | "place" | "route" | "meeting" | "template", id: string) {
    setMemory((current) => ({
      ...current,
      contacts: kind === "contact" ? current.contacts.filter((item) => item.id !== id) : current.contacts,
      favoritePlaces: kind === "place" ? current.favoritePlaces.filter((item) => item.id !== id) : current.favoritePlaces,
      savedRoutes: kind === "route" ? current.savedRoutes.filter((item) => item.id !== id) : current.savedRoutes,
      savedMeetings: kind === "meeting" ? current.savedMeetings.filter((item) => item.id !== id) : current.savedMeetings,
      templates: kind === "template" ? current.templates.filter((item) => item.id !== id) : current.templates,
    }));
  }

  function moveRouteStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= editableStops.length) return;
    const next = [...editableStops];
    [next[index], next[target]] = [next[target], next[index]];
    const times = editableStops.map((stop) => stop.time);
    setRouteLayouts((current) => ({ ...current, [selectedPlan]: next.map((stop, stopIndex) => ({ ...stop, time: times[stopIndex] })) }));
    setShareCardUrl("");
  }

  function removeRouteStop(index: number) {
    if (editableStops.length <= 2) return;
    setRouteLayouts((current) => ({ ...current, [selectedPlan]: editableStops.filter((_, stopIndex) => stopIndex !== index) }));
    setSelectedVenue("");
    setShareCardUrl("");
  }

  function addCatalogPlaceToRoute(item: CatalogItem) {
    const lastTime = editableStops.at(-1)?.time || "18:30";
    const [hours, minutes] = lastTime.split(":").map(Number);
    const totalMinutes = (hours * 60 + minutes + 90) % (24 * 60);
    const time = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
    const primaryKeys = new Set([...editableStops.map(catalogPlaceKey), catalogPlaceKey(item)]);
    const family = placeFamily(item.categories, item.name);
    const analogs = catalogItems.filter((candidate) => candidate.type === "place" && !primaryKeys.has(catalogPlaceKey(candidate)) && placeFamily(candidate.categories, candidate.name) === family && distanceKm(item.coords, candidate.coords) <= 1.25).sort((a, b) => distanceKm(item.coords, a.coords) - distanceKm(item.coords, b.coords)).slice(0, 3);
    const stop: VenueStop = { id: `manual:${selectedPlan}:${item.id}`, time, name: item.name, address: [item.place, item.address].filter(Boolean).join(" · ") || activeCity.name, coords: item.coords, website: item.website || "https://kudago.com/", note: item.description?.slice(0, 90) || "Добавлено вами", tags: [...item.categories, ...(item.traits ?? [])], analogs: analogs.map((analog) => ({ name: analog.name, distance: `${distanceKm(item.coords, analog.coords).toFixed(1)} км`, website: analog.website || "https://kudago.com/", address: [analog.place, analog.address].filter(Boolean).join(" · "), coords: analog.coords, note: analog.description?.slice(0, 80) || "Похожее место той же роли" })) };
    setRouteLayouts((current) => ({ ...current, [selectedPlan]: [...editableStops.map((existing) => ({ ...existing, analogs: existing.analogs.filter((analog) => !analog.coords || catalogPlaceKey({ coords: analog.coords }) !== catalogPlaceKey(item)) })), stop] }));
    setSelectedVenue(stop.id); setRouteSearchOpen(false); setRouteSearchQuery(""); setShareCardUrl("");
  }

  function rebuildRoute(intent: typeof rebuildIntent) {
    setRebuildIntent(intent);
    setRouteLayouts((current) => Object.fromEntries(Object.entries(current).filter(([planId]) => planId !== selectedPlan)));
    setStopAlternativeSelections({});
    setFeedbackSaved(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function saveFeedback() {
    if (feedbackRating < 1) return;
    const routeTags = Array.from(new Set(displayStops.flatMap((stop) => stop.tags ?? [])));
    let weights = updateWeights(memory.preferenceWeights, routeTags, (feedbackRating - 3) * .04);
    displayStops.forEach((stop) => {
      const reaction = placeReactions[stopMemoryId(stop)];
      const delta = reaction === "love" ? .2 : reaction === "like" ? .1 : reaction === "dislike" ? -.2 : 0;
      if (delta) weights = updateWeights(weights, stop.tags ?? [], delta);
    });
    if (feedbackIssues.includes("too-far")) weights = updateWeights(weights, ["walking"], -.15);
    if (feedbackPositives.includes("distance")) weights = updateWeights(weights, ["walking"], .1);
    const feedback = { id: `feedback-${Date.now().toString(36)}`, meetingId: meetingId || "draft", routeId: selectedPlan, rating: feedbackRating, positives: feedbackPositives, issues: feedbackIssues, placeReactions, createdAt: new Date().toISOString() };
    setMemory((current) => ({ ...current, preferenceWeights: weights, feedback: [...current.feedback, feedback], visitedPlaceIds: Array.from(new Set([...current.visitedPlaceIds, ...displayStops.map(stopMemoryId)])) }));
    setFeedbackSaved(true);
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
    updatedParticipants[targetIndex] = { ...updatedParticipants[targetIndex], name: guestName.trim(), status: "ready", votedAt: new Date().toISOString(), prefs: guestPrefs, dates: guestDates, budgetLimit: guestBudget, signals: guestSignals };
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
    const id = meetingId || `${city === "moscow" ? "MSK" : "SPB"}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const contactNames = selectedContacts.map((contact) => contact.name);
    const meetingParticipants = participants.length === size ? participants : makeParticipants(size, contactNames);
    const snapshot = { goal, company, size, selectedDates, availability, budgetLimit, budgetUnlimited, budgetScope, city, district, meetingPoint: meetingCenter, prefs, meetingSignals, meetingName, selectedPlan, participants: meetingParticipants, invitedContactIds: selectedContactIds };
    const meeting = { id, name: meetingName.trim(), status: "collecting", snapshot, updatedAt: new Date().toISOString() };
    setParticipants(meetingParticipants);
    setMeetingId(id);
    setSaveState("saving");
    setMode("room");
    if (selectedContactIds.length) setMemory((current) => ({ ...current, contacts: current.contacts.map((contact) => selectedContactIds.includes(contact.id) ? { ...contact, meetingsCount: contact.meetingsCount + 1 } : contact) }));

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
    setLocationView("map"); setPlaceQuery(""); setRemotePlaceResults([]); setPlaceSearchState("idle"); setSearchOpen(false); setCustomMeetingPoint(null); setPendingMeetingPoint(null); setMeetingPointConfirmed(false); setSelectedVenue(""); setShareCardUrl(""); setShareCardLoading(false); setMeetingId(""); setSaveState("idle"); setPrefs(["Прогулка", "Новая кухня"]); setMeetingSignals(DEFAULT_MEETING_SIGNALS); setFineTuneOpen(false); setPreferenceQuery(""); setMeetingName("Августовский вечер"); setParticipants([]); setStopAlternativeSelections({}); setSelectedContactIds([]); setRouteLayouts({}); setRouteSearchOpen(false); setRouteSearchQuery(""); setRebuildIntent(""); setFeedbackRating(0); setFeedbackPositives([]); setFeedbackIssues([]); setPlaceReactions({}); setFeedbackSaved(false); autoPlanSelectionRef.current = "";
  }

  if (guestStage !== "idle") {
    const meetingDates = Array.isArray(guestMeeting?.snapshot.selectedDates) ? guestMeeting.snapshot.selectedDates as string[] : [];
    return <main className="app-shell guest-shell">
      <header className="topbar guest-topbar"><div className="brand"><span className="brand-mark"><i />S</span><span>Soberu</span><small>гость</small></div></header>
      <section className="guest-page">
        {guestStage === "name" && <div className="guest-card guest-name-card"><p className="eyebrow"><span /> Вас пригласили</p><h1>{guestMeeting?.name || "Встреча друзей"}</h1><p>Сначала представьтесь. Имя увидит только организатор встречи — так будет понятно, чей ответ уже учтён.</p><label className="name-field"><span>Ваше имя</span><input type="text" name="guest-name" autoComplete="name" inputMode="text" enterKeyHint="next" value={guestName} onTouchStart={(event) => event.currentTarget.focus()} onChange={(event) => setGuestName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") beginGuestVote(); }} maxLength={28} placeholder="Например, Андрей" /></label>{guestError && <div className="guest-error">{guestError}</div>}<button className="primary-button full" type="button" onClick={beginGuestVote} disabled={!guestMeeting}>Перейти к голосованию <b>→</b></button></div>}
        {guestStage === "vote" && <div className="guest-card guest-vote-card">
          <p className="eyebrow"><span /> Ответ для {guestName}</p><h1>Когда и чего хочется?</h1>
          <div className="guest-question"><span>Подходящие даты</span><div className="guest-date-grid">{meetingDates.map((date) => <button type="button" className={guestDates.includes(date) ? "active" : ""} onClick={() => setGuestDates((dates) => dates.includes(date) ? dates.filter((item) => item !== date) : [...dates, date])} key={date}>{formatDate(date)}</button>)}</div></div>
          <div className="guest-question"><span>Что добавить в план</span><div className="preference-grid guest-preferences">{preferences.map((item) => <button className={guestPrefs.includes(item.name) ? "preference active" : "preference"} onClick={() => toggleFromList(item.name, guestPrefs, setGuestPrefs)} type="button" key={item.name}><span>{guestPrefs.includes(item.name) ? "✓" : item.icon}</span><b>{item.name}</b></button>)}</div></div>
          <div className="guest-question"><span>Что для вас особенно важно?</span><div className="guest-signal-groups"><div>{signalChoices.noise.map(([value, label]) => <button type="button" className={guestSignals.noise === value ? "active" : ""} onClick={() => setGuestSignals((current) => ({ ...current, noise: value }))} key={value}>{label}</button>)}</div><div>{signalChoices.walking.map(([value, label]) => <button type="button" className={guestSignals.walking === value ? "active" : ""} onClick={() => setGuestSignals((current) => ({ ...current, walking: value }))} key={value}>{label}</button>)}</div><div>{signalChoices.alcohol.map(([value, label]) => <button type="button" className={guestSignals.alcohol === value ? "active" : ""} onClick={() => setGuestSignals((current) => ({ ...current, alcohol: value }))} key={value}>{label}</button>)}</div></div></div>
          <div className="guest-question"><span>Комфортный бюджет — до {guestBudget.toLocaleString("ru-RU")} ₽ / чел.</span><input className="guest-budget" aria-label="Бюджет гостя" type="range" min="500" max="100000" step="500" value={guestBudget} onChange={(event) => setGuestBudget(Number(event.target.value))} /></div>{guestError && <div className="guest-error">{guestError}</div>}<button className="primary-button full" type="button" onClick={() => void submitGuestVote()} disabled={guestDates.length === 0}>Отправить ответ <b>✓</b></button>
        </div>}
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
        <div className="top-actions"><button className="memory-button" onClick={() => setMemoryOpen(true)} type="button">♡ Моё <span>{memory.favoritePlaces.length + memory.savedRoutes.length}</span></button><button className="quiet-button" onClick={resetMeeting} type="button">+ Новая встреча</button></div>
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
                <div className="contacts-picker"><div><span className="field-label">Контакты Soberu</span><small>Выберите знакомых — их имена сразу займут места в комнате. Ссылка для остальных останется.</small></div>{memory.contacts.length > 0 && <div className="contact-chips">{memory.contacts.map((contact) => <button type="button" className={selectedContactIds.includes(contact.id) ? "active" : ""} onClick={() => toggleContact(contact.id)} key={contact.id}><span>{contact.name.slice(0, 1).toUpperCase()}</span><b>{contact.name}</b><small>{contact.meetingsCount ? `${contact.meetingsCount} встр.` : "новый"}</small></button>)}</div>}<div className="contact-adder"><input value={newContactName} onChange={(event) => setNewContactName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createContact(); }} placeholder="Имя нового контакта" aria-label="Имя нового контакта" maxLength={28} /><button type="button" onClick={createContact} disabled={newContactName.trim().length < 2}>Добавить +</button></div></div>
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
                  <div className="budget-head"><span><small>Ограничение по бюджету</small><strong>{budget}</strong></span><label className="budget-exact"><small>Точная сумма</small><input type="number" min={budgetScale.min} max={budgetScale.max} step={budgetScale.step} value={budgetLimit} disabled={budgetUnlimited} onChange={(event) => setBudgetLimit(Math.min(budgetScale.max, Math.max(budgetScale.min, Number(event.target.value) || budgetScale.min)))} /></label><button type="button" className={budgetUnlimited ? "budget-toggle active" : "budget-toggle"} onClick={() => setBudgetUnlimited((value) => !value)}>{budgetUnlimited ? "Лимита нет" : "Без лимита"}</button></div>
                  <input aria-label="Ограничение по бюджету" type="range" min={budgetScale.min} max={budgetScale.max} step={budgetScale.step} value={budgetLimit} disabled={budgetUnlimited} style={{ background: `linear-gradient(90deg, var(--violet) 0%, var(--lime) ${budgetProgress}%, rgba(255,255,255,.08) ${budgetProgress}%, rgba(255,255,255,.08) 100%)` }} onChange={(event) => setBudgetLimit(Number(event.target.value))} />
                  <div className="budget-foot"><span>{budgetScale.min.toLocaleString("ru-RU")} ₽</span><div className="scope-switch"><button type="button" className={budgetScope === "person" ? "active" : ""} onClick={() => { setBudgetScope("person"); setBudgetLimit((value) => Math.min(100000, Math.max(500, value))); }}>На человека</button><button type="button" className={budgetScope === "group" ? "active" : ""} onClick={() => { setBudgetScope("group"); setBudgetLimit((value) => Math.min(500000, Math.max(1000, value))); }}>На всех</button></div><span>{budgetScale.max.toLocaleString("ru-RU")} ₽</span></div>
                </div>
                 {goal === "surprise" ? <div className="surprise-note"><span>?</span><p><strong>Темы выбирать не нужно</strong><small>Soberu сам смешает разные форматы и соберёт три непохожих компактных маршрута.</small></p></div> : <>
                  <div className="preference-tools"><label><span>⌕</span><input value={preferenceQuery} onChange={(event) => setPreferenceQuery(event.target.value)} placeholder="Найти занятие, место или формат" /></label><small>{prefs.length} выбрано</small></div>
                  <div className="preference-grid expanded">{filteredPreferences.map((item) => <button className={prefs.includes(item.name) ? "preference active" : "preference"} onClick={() => toggleFromList(item.name, prefs, setPrefs)} type="button" key={item.name}><span>{prefs.includes(item.name) ? "✓" : item.icon}</span><b>{item.name}</b><small>{item.group}</small></button>)}</div>
                   {filteredPreferences.length === 0 && <div className="empty-search">Ничего не нашли. Попробуйте более общее слово.</div>}
                 </>}
                 <section className={`fine-tune ${fineTuneOpen ? "open" : ""}`}>
                   <button className="fine-tune-head" type="button" onClick={() => setFineTuneOpen((value) => !value)} aria-expanded={fineTuneOpen}><span>✦</span><p><small>Тонкая настройка · необязательно</small><strong>Учтём то, о чём обычно даже не спрашивают</strong><em>{signalSummary(meetingSignals).join(" · ")}</em></p><b>{fineTuneOpen ? "Свернуть −" : "Настроить +"}</b></button>
                   {fineTuneOpen && <div className="fine-tune-body">
                     <p>Ответьте только на важное. Нейтральные пункты не будут ограничивать подбор.</p>
                     <div className="signal-grid">{(Object.entries(signalChoices) as Array<[SignalChoiceKey, readonly (readonly [string, string])[]]>).map(([key, options]) => <fieldset key={key}><legend>{signalLabels[key]}</legend><div>{options.map(([value, label]) => <button type="button" className={meetingSignals[key] === value ? "active" : ""} onClick={() => setMeetingSignals((current) => ({ ...current, [key]: value } as MeetingSignals))} key={value}>{label}</button>)}</div></fieldset>)}</div>
                     <div className="need-chips"><button type="button" className={meetingSignals.accessibility ? "active" : ""} onClick={() => setMeetingSignals((current) => ({ ...current, accessibility: !current.accessibility }))}>♿ Нужен безбарьерный доступ</button><button type="button" className={meetingSignals.kids ? "active" : ""} onClick={() => setMeetingSignals((current) => ({ ...current, kids: !current.kids }))}>С детьми</button><button type="button" className={meetingSignals.pets ? "active" : ""} onClick={() => setMeetingSignals((current) => ({ ...current, pets: !current.pets }))}>С питомцем</button><button type="button" className={meetingSignals.avoidCrowds ? "active" : ""} onClick={() => setMeetingSignals((current) => ({ ...current, avoidCrowds: !current.avoidCrowds }))}>Без толп и очередей</button></div>
                   </div>}
                 </section>
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
                   <div><span className="review-icon">◎</span><p><small>Тонкие настройки</small><strong>{signalSummary(meetingSignals).slice(0, 2).join(" · ")}</strong></p></div>
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
            <div className="route-summary"><span className={`plan-number ${currentPlan.color}`}>{currentPlan.number}</span><p><small>Выбранный маршрут</small><strong>{currentPlanTitle}</strong><em>≈ {planDistances[currentPlan.id].toFixed(1)} км весь маршрут</em></p><div><span>{planMatches[currentPlan.id]?.percent ?? 0}%</span><small>живое совпадение</small></div></div>
          </section>
          <div className="plan-list">{availablePlans.map((plan) => (
            <article className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} key={plan.id}>
              <button className="plan-select-area" onClick={() => choosePlan(plan.id)} type="button" aria-label={`Выбрать план ${planTitle(plan)}`}>
                <span className={`plan-number ${plan.color}`}>{plan.number}</span><span className="plan-main"><small className="plan-badge">{planBadge(plan)}</small><strong>{planTitle(plan)}</strong><em>{plan.subtitle}</em></span>
                <span className="plan-meta"><small>≈ {planDistances[plan.id].toFixed(1)} км весь маршрут</small><strong>{plan.price}</strong></span><span className="plan-score"><strong>{planMatches[plan.id]?.percent ?? 0}%</strong><small>живое совпадение</small></span><span className="radio-dot" />
              </button>
              {selectedPlan === plan.id && <div className="plan-details"><p><span>Почему подходит</span>Оценка пересчитана по ответам компании, расстояниям, бюджету и вашим тонким настройкам — это не заранее заданное число.</p><div className="match-reasons">{routeReasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div><ol>{(resolvedStopsByPlan[plan.id] ?? []).map((stop) => <li key={stop.id}>{stop.time} · {stop.name}</li>)}</ol></div>}
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
            <div className="route-editor"><div><small>Хозяин маршрута — вы</small><strong>Пересобрать программу</strong></div><div>{([['compact','Меньше ходить'],['budget','Дешевле'],['food','Больше еды'],['calm','Спокойнее'],['novelty','Необычнее']] as const).map(([intent,label]) => <button type="button" className={rebuildIntent === intent ? "active" : ""} onClick={() => rebuildRoute(intent)} key={intent}>{label}</button>)}<button type="button" className={routeSearchOpen ? "active add-route-place" : "add-route-place"} onClick={() => setRouteSearchOpen((value) => !value)}>+ Своя точка</button></div></div>
            {routeSearchOpen && <div className="route-place-search"><label><span>⌕</span><input value={routeSearchQuery} onChange={(event) => setRouteSearchQuery(event.target.value)} placeholder="Название, категория или адрес рядом с маршрутом" aria-label="Найти точку рядом с маршрутом" /></label><div>{routeSearchResults.map(({ item, near }) => <button type="button" onClick={() => addCatalogPlaceToRoute(item)} key={item.id}><p><strong>{item.name}</strong><small>{[item.place, item.address].filter(Boolean).join(" · ")}</small></p><span>{near.toFixed(1)} км</span><b>Добавить +</b></button>)}</div>{routeSearchResults.length === 0 && <p>Подходящих точек рядом не найдено. Попробуйте более общее название или пересоберите маршрут с обычной дистанцией.</p>}</div>}
            <div className="route-list interactive">{editableStops.map((sourceStop, index) => { const stop = displayStops[index] ?? sourceStop; const selection = stopAlternativeSelections[`${selectedPlan}:${sourceStop.id}`] ?? 0; const favorite = memory.favoritePlaces.some((place) => place.id === stopMemoryId(stop)); return <div className={selectedVenue === sourceStop.id ? "route-stop selected" : "route-stop"} key={sourceStop.id}>
              <button className="route-stop-main" type="button" onClick={() => setSelectedVenue(sourceStop.id)} aria-label={`Показать на карте ${stop.name}`}><span>{stop.time}</span><i>{index + 1}</i><p><strong>{stop.name}</strong><small>{stop.address} · {stop.note}</small></p><b>Изменить ↗</b></button>
              <div className="route-edit-actions"><button className={favorite ? "favorite" : ""} type="button" onClick={() => toggleFavoritePlace(stop)} aria-label={favorite ? `Убрать ${stop.name} из избранного` : `Добавить ${stop.name} в избранное`}>{favorite ? "♥" : "♡"}</button><button type="button" onClick={() => moveRouteStop(index, -1)} disabled={index === 0} aria-label="Переместить выше">↑</button><button type="button" onClick={() => moveRouteStop(index, 1)} disabled={index === editableStops.length - 1} aria-label="Переместить ниже">↓</button><button type="button" onClick={() => removeRouteStop(index)} disabled={editableStops.length <= 2} aria-label="Удалить точку">×</button></div>
              {selectedVenue === sourceStop.id && <div className="venue-more venue-switcher"><div><span>Выберите точку той же роли</span><button className={selection === 0 ? "active" : ""} type="button" onClick={() => chooseStopAlternative(sourceStop, 0)}><strong>{sourceStop.name}</strong><small>Основной вариант</small></button>{sourceStop.analogs.map((analog, analogIndex) => <button className={selection === analogIndex + 1 ? "active" : ""} type="button" disabled={!analog.coords} onClick={() => chooseStopAlternative(sourceStop, analogIndex + 1)} key={`${sourceStop.id}:${analog.name}`}><strong>{analog.name}</strong><small>{analog.distance}</small></button>)}{sourceStop.analogs.length === 0 && <p className="no-alternatives">Других мест той же роли рядом нет — дальние варианты специально скрыты, чтобы не ломать маршрут.</p>}</div><a className="venue-site resource-link" href={stop.website} target="_blank" rel="noreferrer"><span aria-hidden="true">◎</span><em>Ресурс</em></a></div>}
            </div>; })}</div>
            <div className="save-strip"><button className={currentRouteSaved ? "active" : ""} type="button" onClick={saveCurrentRoute}>{currentRouteSaved ? "♥ Маршрут сохранён" : "♡ Сохранить маршрут"}</button><button className={currentMeetingSaved ? "active" : ""} type="button" onClick={saveCurrentMeeting}>{currentMeetingSaved ? "♥ Встреча сохранена" : "♡ Сохранить встречу"}</button><button type="button" onClick={saveMeetingTemplate}>↻ Сохранить как шаблон</button></div>
            <div className="final-bottom"><span><small>Ориентир по бюджету</small><strong>{currentPlan.price}</strong></span><button onClick={createShareCard} disabled={shareCardLoading} type="button">{shareCardLoading ? `Рисуем карту ${activeCity.shortName}…` : "Поделиться красивой карточкой ↗"}</button></div>
          </div>
          <section className="feedback-card"><div className="feedback-head"><div><small>После встречи</small><h2>{feedbackSaved ? "Спасибо — следующая подборка станет точнее" : "Ну как вам маршрут?"}</h2></div><div className="rating-row" aria-label="Оценка маршрута">{[1,2,3,4,5].map((rating) => <button type="button" className={feedbackRating >= rating ? "active" : ""} onClick={() => { setFeedbackRating(rating); setFeedbackSaved(false); }} aria-label={`${rating} из 5`} key={rating}>★</button>)}</div></div>{!feedbackSaved && <><div className="feedback-columns"><div><span>Что понравилось?</span>{[['places','Места'],['sequence','Последовательность'],['distance','Расстояния'],['atmosphere','Атмосфера'],['price','Цена']].map(([id,label]) => <button type="button" className={feedbackPositives.includes(id) ? "active" : ""} onClick={() => toggleFromList(id, feedbackPositives, setFeedbackPositives)} key={id}>✓ {label}</button>)}</div><div><span>Что было не очень?</span>{[['too-far','Слишком далеко'],['too-expensive','Слишком дорого'],['too-many','Слишком много мест'],['bad-place','Место не понравилось']].map(([id,label]) => <button type="button" className={feedbackIssues.includes(id) ? "active issue" : ""} onClick={() => toggleFromList(id, feedbackIssues, setFeedbackIssues)} key={id}>{label}</button>)}</div></div><div className="place-feedback"><span>Отдельные места</span>{displayStops.map((stop) => <div key={stopMemoryId(stop)}><p><strong>{stop.name}</strong><small>{stop.address}</small></p><div>{([['love','♥'],['like','👍'],['neutral','•'],['dislike','−']] as const).map(([reaction,icon]) => <button type="button" className={placeReactions[stopMemoryId(stop)] === reaction ? "active" : ""} onClick={() => setPlaceReactions((current) => ({ ...current, [stopMemoryId(stop)]: reaction }))} aria-label={`${reaction}: ${stop.name}`} key={reaction}>{icon}</button>)}</div></div>)}</div><button className="primary-button feedback-submit" type="button" disabled={feedbackRating < 1} onClick={saveFeedback}>Сохранить отзыв <b>→</b></button></>}</section>
          <section className="rejected-plans"><div><small>Остались в подборке</small><h2>Другие варианты</h2><p>Нажмите «Сравнить» — финальная программа сразу заменится выбранной.</p></div><div>{availablePlans.filter((plan) => plan.id !== selectedPlan).map((plan) => <article key={plan.id}><span className={`plan-number ${plan.color}`}>{plan.number}</span><p><small>{planBadge(plan)}</small><strong>{planTitle(plan)}</strong><em>{plan.subtitle} · ≈ {planDistances[plan.id].toFixed(1)} км весь маршрут</em></p><div><strong>{planMatches[plan.id]?.percent ?? 0}%</strong><small>{plan.price}</small></div><button type="button" onClick={() => choosePlan(plan.id, true)}>Сравнить ↗</button></article>)}</div></section>
          <div className="final-actions"><button className="back-button" onClick={() => setMode("plans")} type="button">← Вернуться к планам</button><button className="quiet-button" onClick={resetMeeting} type="button">Создать ещё одну встречу</button></div>
        </section>
      )}
      {memoryOpen && <div className="memory-overlay" role="dialog" aria-modal="true" aria-label="Моё в Soberu"><aside className="memory-panel">
        <div className="memory-panel-head"><div><small>Soberu memory</small><h2>Ваше Soberu</h2></div><button type="button" onClick={() => setMemoryOpen(false)} aria-label="Закрыть">×</button></div>
        <label className="memory-profile"><span>{memory.profile.name.slice(0,1).toUpperCase()}</span><p><small>Как вас называть</small><input value={memory.profile.name} onChange={(event) => setMemory((current) => ({ ...current, profile: { ...current.profile, name: event.target.value } }))} maxLength={28} /></p></label>
        <div className="memory-stats"><span><strong>{memory.contacts.length}</strong><small>контактов</small></span><span><strong>{memory.favoritePlaces.length}</strong><small>мест</small></span><span><strong>{memory.savedRoutes.length}</strong><small>маршрутов</small></span><span><strong>{memory.templates.length}</strong><small>шаблонов</small></span></div>
        <section><div className="memory-section-title"><strong>Шаблоны компаний</strong><small>Меняете только дату и точку</small></div>{memory.templates.length ? <div className="memory-list templates">{memory.templates.slice().reverse().map((template) => <div key={template.id}><span>↻</span><p><strong>{template.name}</strong><small>{template.company} · {template.size} чел. · {template.prefs.slice(0,2).join(", ") || "сюрприз"}</small></p><button type="button" onClick={() => applyMeetingTemplate(template)}>Повторить</button><button type="button" className="remove" onClick={() => removeMemoryItem("template", template.id)} aria-label={`Удалить шаблон ${template.name}`}>×</button></div>)}</div> : <p className="memory-empty">Сохраните удачную встречу как шаблон на финальном экране.</p>}</section>
        <section><div className="memory-section-title"><strong>Контакты</strong><small>Выбираются на шаге «Кто будет?»</small></div>{memory.contacts.length ? <div className="memory-list">{memory.contacts.map((contact) => <div key={contact.id}><span>{contact.name.slice(0,1).toUpperCase()}</span><p><strong>{contact.name}</strong><small>{contact.meetingsCount} совместных встреч</small></p><button type="button" className="remove" onClick={() => removeMemoryItem("contact", contact.id)} aria-label={`Удалить контакт ${contact.name}`}>×</button></div>)}</div> : <p className="memory-empty">Добавьте первый контакт при создании встречи.</p>}</section>
        <section><div className="memory-section-title"><strong>Избранные места</strong><small>Уже влияют на новые рекомендации</small></div>{memory.favoritePlaces.length ? <div className="memory-list places">{memory.favoritePlaces.slice(-8).reverse().map((place) => <div key={place.id}><span>♥</span><p><strong>{place.name}</strong><small>{place.address}</small></p><button type="button" className="remove" onClick={() => removeMemoryItem("place", place.id)} aria-label={`Убрать ${place.name} из избранного`}>×</button></div>)}</div> : <p className="memory-empty">Нажмите ♡ рядом с точкой готового маршрута.</p>}</section>
        <section><div className="memory-section-title"><strong>Сохранённые маршруты</strong><small>Лучшие программы</small></div>{memory.savedRoutes.length ? <div className="memory-list places">{memory.savedRoutes.slice(-5).reverse().map((route) => <div key={route.id}><span>↗</span><p><strong>{route.title}</strong><small>{route.stopNames.join(" → ")}</small></p><button type="button" className="remove" onClick={() => removeMemoryItem("route", route.id)} aria-label={`Удалить маршрут ${route.title}`}>×</button></div>)}</div> : <p className="memory-empty">Здесь появятся удачные программы вечера.</p>}</section>
        <section><div className="memory-section-title"><strong>История встреч</strong><small>{memory.feedback.length} отзывов улучшили подбор</small></div>{memory.savedMeetings.length ? <div className="memory-list">{memory.savedMeetings.slice(-6).reverse().map((meeting) => <div key={meeting.id}><span>✓</span><p><strong>{meeting.name}</strong><small>{meeting.city}{meeting.people ? ` · ${meeting.people} чел.` : ""}</small></p><button type="button" className="remove" onClick={() => removeMemoryItem("meeting", meeting.id)} aria-label={`Удалить встречу ${meeting.name}`}>×</button></div>)}</div> : <p className="memory-empty">Сохранённые встречи появятся здесь.</p>}</section>
        <p className="memory-privacy">Профиль хранится только на этом устройстве. Это честная версия до Telegram-авторизации; ссылки и гостевые ответы продолжают работать через D1.</p>
      </aside></div>}
      {/* Generated data URL is local and cannot use the framework image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {shareCardUrl && <div className="share-card-modal" role="dialog" aria-modal="true" aria-label="Карточка маршрута"><button className="share-modal-close" type="button" onClick={() => setShareCardUrl("")} aria-label="Закрыть">×</button><div><p>Карточка готова</p><h2>Можно отправить друзьям</h2><img src={shareCardUrl} alt={`Маршрут ${currentPlanTitle}`} /><div><button className="back-button" type="button" onClick={() => setShareCardUrl("")}>Назад</button><button className="primary-button" type="button" onClick={shareGeneratedCard}>Поделиться / скачать <b>↗</b></button></div></div></div>}
    </main>
  );
}
