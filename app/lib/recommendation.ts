export type MeetingSignals = {
  pace: "relaxed" | "balanced" | "dynamic";
  noise: "quiet" | "balanced" | "lively";
  space: "indoor" | "mixed" | "outdoor";
  walking: "low" | "balanced" | "high";
  food: "light" | "balanced" | "main";
  alcohol: "avoid" | "neutral" | "yes";
  spontaneity: "planned" | "flexible" | "spontaneous";
  ending: "dessert" | "view" | "bar" | "free";
  accessibility: boolean;
  kids: boolean;
  pets: boolean;
  avoidCrowds: boolean;
};

export const DEFAULT_MEETING_SIGNALS: MeetingSignals = {
  pace: "balanced",
  noise: "balanced",
  space: "mixed",
  walking: "balanced",
  food: "balanced",
  alcohol: "neutral",
  spontaneity: "flexible",
  ending: "free",
  accessibility: false,
  kids: false,
  pets: false,
  avoidCrowds: false,
};

export type PlaceFamily = "food" | "culture" | "activity" | "walk" | "music" | "wellness" | "other";

const familyMatchers: Array<[PlaceFamily, RegExp]> = [
  ["food", /restaurant|cafe|bar|pub|food|коф|еда|ресторан|бар|рынок|стритфуд/i],
  ["culture", /museum|exhibition|theater|cinema|art|gallery|музей|выстав|театр|кино|искус|литератур|истор/i],
  ["activity", /game|quiz|bowling|billiard|sport|amusement|workshop|игр|квиз|боулинг|бильярд|спорт|мастер/i],
  ["walk", /park|attraction|sight|tour|architecture|парк|прогул|вид|воды|архитект/i],
  ["music", /concert|music|karaoke|dance|концерт|музык|караоке|танц/i],
  ["wellness", /spa|relax|wellness|спа|релакс/i],
];

export function placeFamily(categories: string[], text = ""): PlaceFamily {
  const source = `${categories.join(" ")} ${text}`;
  return familyMatchers.find(([, matcher]) => matcher.test(source))?.[0] ?? "other";
}

export function inferTraits(categories: string[], tags: string[] = [], text = "") {
  const source = `${categories.join(" ")} ${tags.join(" ")} ${text}`.toLowerCase();
  const family = placeFamily(categories, `${tags.join(" ")} ${text}`);
  const traits = new Set<string>([family]);
  if (/park|garden|embank|outdoor|парк|сад|набереж|прогул|улиц|площад|бульвар/.test(source)) traits.add("outdoor");
  if (/museum|gallery|theater|cinema|restaurant|cafe|bar|spa|музей|галер|театр|кино|ресторан|кафе|бар|спа/.test(source)) traits.add("indoor");
  if (/cafe|coffee|park|garden|museum|library|коф|кафе|парк|сад|музей|библиот/.test(source)) traits.add("quiet");
  if (/concert|festival|dance|karaoke|club|bar|amusement|концерт|фестив|танц|караоке|клуб|бар|аттракцион/.test(source)) traits.add("lively");
  if (/view|sight|embank|roof|panorama|вид|набереж|крыша|панорам|роман/.test(source)) traits.add("romantic");
  if (/kids|family|children|дет|семь/.test(source)) traits.add("family");
  if (/accessible|wheelchair|доступн|инклюз/.test(source)) traits.add("accessible");
  if (/pet|dog|животн|собак/.test(source)) traits.add("pets");
  if (/bar|pub|wine|cocktail|бар|вино|коктейл/.test(source)) traits.add("alcohol");
  if (/restaurant|cafe|food|market|ресторан|кафе|еда|рынок|кухн/.test(source)) traits.add("meal");
  if (/free|бесплат/.test(source)) traits.add("free");
  if (/popular|landmark|главн|известн|популяр/.test(source)) traits.add("popular");
  return [...traits];
}

export function signalScore(signals: MeetingSignals, traits: string[], isEvent: boolean) {
  const has = (trait: string) => traits.includes(trait);
  let score = 0;
  if (signals.noise === "quiet") score += has("quiet") ? 15 : has("lively") ? -18 : 0;
  if (signals.noise === "lively") score += has("lively") ? 15 : has("quiet") ? -5 : 0;
  if (signals.space === "indoor") score += has("indoor") ? 12 : has("outdoor") ? -15 : 0;
  if (signals.space === "outdoor") score += has("outdoor") ? 12 : has("indoor") ? -6 : 0;
  if (signals.food === "main") score += has("meal") ? 18 : -3;
  if (signals.food === "light") score += has("meal") ? -5 : 3;
  if (signals.alcohol === "avoid" && has("alcohol")) score -= 30;
  if (signals.alcohol === "yes" && has("alcohol")) score += 12;
  if (signals.spontaneity === "spontaneous") score += isEvent ? -10 : 6;
  if (signals.spontaneity === "planned") score += isEvent ? 8 : 0;
  if (signals.accessibility) score += has("accessible") ? 16 : -3;
  if (signals.kids) score += has("family") ? 18 : has("alcohol") ? -20 : 0;
  if (signals.pets) score += has("pets") || has("outdoor") ? 10 : -3;
  if (signals.avoidCrowds) score += has("quiet") ? 8 : has("popular") || has("lively") ? -10 : 0;
  return score;
}

export function routeSlots(goal: string, planId: string, hasDayProgram: boolean, wantedCategories: string[]) {
  const templates: Record<string, string[][]> = {
    talk: [["cafe", "anticafe", "parks"], ["museums", "parks", "attractions"], ["restaurants", "cafe"]],
    fun: [["games", "quiz", "amusement", "sport"], ["concert", "festival", "cinema"], ["restaurants", "bars", "cafe"]],
    date: [["exhibition", "museums", "parks"], ["attractions", "sights", "parks"], ["restaurants", "cafe", "bars"]],
    "double-date": [["games", "quiz", "exhibition"], ["restaurants", "cafe"], ["concert", "bars", "sights"]],
    food: [["cafe", "restaurants"], ["restaurants", "markets"], ["bars", "cafe", "restaurants"]],
    walk: [["parks", "attractions", "sights"], ["museums", "exhibition", "tour"], ["cafe", "restaurants"]],
    surprise: [["exhibition", "museums", "games"], ["parks", "attractions", "sights"], ["restaurants", "concert", "bars"]],
  };
  const base = (templates[goal] ?? templates.surprise).map((slot) => [...slot]);
  if (wantedCategories.length) base.forEach((slot, index) => slot.unshift(wantedCategories[index % wantedCategories.length]));
  if (planId === "petro") base[0] = ["games", "anticafe", "cafe", ...base[0]];
  if (planId === "island") base[1] = ["events", "concert", "exhibition", "sights", ...base[1]];
  if (hasDayProgram) base.splice(2, 0, ["cafe", "parks", "attractions", "museums"]);
  return base;
}

export function signalSummary(signals: MeetingSignals) {
  const items: string[] = [];
  if (signals.noise === "quiet") items.push("без шума");
  if (signals.noise === "lively") items.push("живее");
  if (signals.space === "indoor") items.push("под крышей");
  if (signals.space === "outdoor") items.push("на воздухе");
  if (signals.walking === "low") items.push("минимум ходьбы");
  if (signals.walking === "high") items.push("можно много гулять");
  if (signals.food === "main") items.push("еда — часть программы");
  if (signals.alcohol === "avoid") items.push("без алкоголя");
  if (signals.accessibility) items.push("безбарьерно");
  if (signals.kids) items.push("с детьми");
  if (signals.pets) items.push("с питомцем");
  if (signals.avoidCrowds) items.push("без толп");
  return items.length ? items : ["сбалансированный сценарий"];
}
