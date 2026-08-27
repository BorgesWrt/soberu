export type DistrictName =
  | "Центральный"
  | "Адмиралтейский"
  | "Петроградский"
  | "Василеостровский"
  | "Московский"
  | "Выборгский"
  | "Приморский"
  | "Неважно";

export type CityPlace = {
  id: string;
  name: string;
  district: string;
  address: string;
  coords: [number, number];
  categories: string[];
  description: string;
  website: string;
  source: "Visit Petersburg" | "OpenStreetMap" | "Wikidata";
  sourceUrl: string;
};

export const districtCenters: Record<DistrictName, { label: string; coords: [number, number] }> = {
  Центральный: { label: "район площади Искусств", coords: [59.9387, 30.3324] },
  Адмиралтейский: { label: "район Сенной площади", coords: [59.9272, 30.3199] },
  Петроградский: { label: "район Петроградской стороны", coords: [59.9664, 30.3115] },
  Василеостровский: { label: "район Среднего проспекта", coords: [59.9405, 30.2787] },
  Московский: { label: "район Парка Победы", coords: [59.8661, 30.3206] },
  Выборгский: { label: "район Удельного парка", coords: [60.0125, 30.315] },
  Приморский: { label: "район Елагина острова", coords: [59.9804, 30.258] },
  Неважно: { label: "центр Санкт-Петербурга", coords: [59.9388, 30.3146] },
};

const visit = "https://www.visit-petersburg.ru/leisure/places/";
const osm = "https://www.openstreetmap.org/";
const wikidata = "https://www.wikidata.org/wiki/Q656";

export const cityPlaces: CityPlace[] = [
  { id: "hermitage", name: "Эрмитаж", district: "Центральный", address: "Дворцовая пл., 2", coords: [59.9398, 30.3146], categories: ["Музей", "Искусство", "Красивый вид"], description: "Большая музейная точка и сильное начало городской программы.", website: "https://www.hermitagemuseum.org/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "russian-museum", name: "Русский музей", district: "Центральный", address: "Инженерная ул., 4", coords: [59.9386, 30.3323], categories: ["Музей", "Выставка", "Искусство"], description: "Классическое искусство рядом с садами и набережными.", website: "https://rusmuseum.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "faberge-place", name: "Музей Фаберже", district: "Центральный", address: "наб. Фонтанки, 21", coords: [59.9344, 30.3427], categories: ["Музей", "Выставка", "Свидание"], description: "Камерная культурная остановка на Фонтанке.", website: "https://fabergemuseum.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "summer-garden-place", name: "Летний сад", district: "Центральный", address: "наб. Кутузова, 2", coords: [59.9458, 30.3356], categories: ["Парк", "Прогулка", "Свидание"], description: "Спокойная прогулка между музейными точками центра.", website: "https://rusmuseum.ru/summer-garden/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "field-of-mars", name: "Марсово поле", district: "Центральный", address: "Марсово поле", coords: [59.9435, 30.3314], categories: ["Парк", "Прогулка", "Красивый вид"], description: "Открытое пространство рядом с Летним садом и Невой.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "book-house", name: "Дом книги", district: "Центральный", address: "Невский пр., 28", coords: [59.9357, 30.3259], categories: ["Архитектура", "Книги", "Кофе"], description: "Удобная заметная точка встречи на Невском проспекте.", website: "https://www.spbdk.ru/", source: "Visit Petersburg", sourceUrl: visit },

  { id: "new-holland-place", name: "Новая Голландия", district: "Адмиралтейский", address: "наб. Адмиралтейского канала, 2", coords: [59.929, 30.2891], categories: ["Еда", "Прогулка", "События"], description: "Остров с прогулкой, ресторанами и культурной программой.", website: "https://www.newhollandsp.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "isaac", name: "Исаакиевский собор", district: "Адмиралтейский", address: "Исаакиевская пл., 4", coords: [59.9341, 30.3061], categories: ["Архитектура", "Красивый вид", "Прогулка"], description: "Архитектурная доминанта и понятный ориентир для группы.", website: "https://cathedral.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "yusupov", name: "Юсуповский дворец", district: "Адмиралтейский", address: "наб. Мойки, 94", coords: [59.9297, 30.299], categories: ["Музей", "Архитектура", "История"], description: "Историческая остановка рядом с Мойкой и Новой Голландией.", website: "https://yusupov-palace.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "nikolskie", name: "Никольские ряды", district: "Адмиралтейский", address: "Садовая ул., 62", coords: [59.9216, 30.3004], categories: ["Еда", "Двор", "События"], description: "Городской двор для еды и спокойного продолжения встречи.", website: "https://nikolskiye.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "mariinsky", name: "Мариинский театр", district: "Адмиралтейский", address: "Театральная пл., 1", coords: [59.9255, 30.296], categories: ["Театр", "Музыка", "Архитектура"], description: "Главная театральная точка района.", website: "https://www.mariinsky.ru/", source: "Visit Petersburg", sourceUrl: visit },

  { id: "petropavlovsk", name: "Петропавловская крепость", district: "Петроградский", address: "Заячий остров", coords: [59.9502, 30.3165], categories: ["История", "Прогулка", "Красивый вид"], description: "Маршрут у воды с панорамами исторического центра.", website: "https://www.spbmuseum.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "planetarium-place", name: "Петербургский планетарий", district: "Петроградский", address: "Александровский парк, 4", coords: [59.955, 30.3137], categories: ["Наука", "Семья", "Свидание"], description: "Неспешный познавательный старт рядом с парком.", website: "https://www.planetary-spb.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "botanical-place", name: "Ботанический сад", district: "Петроградский", address: "ул. Профессора Попова, 2", coords: [59.9705, 30.323], categories: ["Парк", "Прогулка", "Свидание"], description: "Оранжереи и зелёный маршрут для спокойной компании.", website: "https://botsad-spb.com/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "lenfilm-place", name: "Ленфильм", district: "Петроградский", address: "Каменноостровский пр., 10", coords: [59.957, 30.3165], categories: ["Кино", "Музей", "Культура"], description: "Киноистория и выставочное пространство в центре района.", website: "https://www.lenfilm.ru/", source: "Wikidata", sourceUrl: wikidata },
  { id: "lopukhinsky", name: "Лопухинский сад", district: "Петроградский", address: "Каменноостровский пр., 10", coords: [59.9728, 30.299], categories: ["Парк", "Прогулка", "У воды"], description: "Тихая зелёная пауза между насыщенными остановками.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },

  { id: "erarta-place", name: "Эрарта", district: "Василеостровский", address: "29-я линия В.О., 2", coords: [59.9323, 30.2518], categories: ["Музей", "Выставка", "Современное искусство"], description: "Большой музей современного искусства для длинной программы.", website: "https://www.erarta.com/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "sevkabel-place", name: "Севкабель Порт", district: "Василеостровский", address: "Кожевенная линия, 40", coords: [59.9238, 30.2416], categories: ["У воды", "Еда", "События"], description: "Набережная, еда и вечерние события в одной точке.", website: "https://sevcableport.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "brusnitsyn", name: "Брусницын", district: "Василеостровский", address: "Кожевенная линия, 30", coords: [59.9253, 30.247], categories: ["Еда", "События", "У воды"], description: "Общественное пространство рядом с Севкабелем.", website: "https://brusnitsyn.com/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "strelka", name: "Стрелка Васильевского острова", district: "Василеостровский", address: "Биржевая пл.", coords: [59.9445, 30.3065], categories: ["Красивый вид", "Прогулка", "Архитектура"], description: "Открытая панорама Невы и исторического центра.", website: "https://www.visit-petersburg.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "kunstkamera", name: "Кунсткамера", district: "Василеостровский", address: "Университетская наб., 3", coords: [59.9414, 30.3045], categories: ["Музей", "История", "Наука"], description: "Узнаваемая музейная точка рядом со Стрелкой.", website: "https://www.kunstkamera.ru/", source: "Visit Petersburg", sourceUrl: visit },

  { id: "victory-park", name: "Московский парк Победы", district: "Московский", address: "Кузнецовская ул., 25", coords: [59.8661, 30.3206], categories: ["Парк", "Прогулка", "Спорт"], description: "Большой парк для маршрута без плотного туристического потока.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "grand-maket", name: "Гранд Макет Россия", district: "Московский", address: "Цветочная ул., 16", coords: [59.8882, 30.3296], categories: ["Музей", "Семья", "Интерактив"], description: "Интерактивная экспозиция для компании или семьи.", website: "https://grandmaket.ru/", source: "Visit Petersburg", sourceUrl: visit },
  { id: "planetarium-one", name: "Планетарий №1", district: "Московский", address: "наб. Обводного канала, 74Ц", coords: [59.9073, 30.2994], categories: ["Наука", "Свидание", "Шоу"], description: "Иммерсивная программа в газгольдере.", website: "https://planetarium.one/", source: "OpenStreetMap", sourceUrl: osm },

  { id: "udelny", name: "Удельный парк", district: "Выборгский", address: "пр. Энгельса, 28", coords: [60.0125, 30.315], categories: ["Парк", "Прогулка", "Спорт"], description: "Большой зелёный маршрут для долгой прогулки.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "sosnovka", name: "Парк Сосновка", district: "Выборгский", address: "ул. Жака Дюкло, 62", coords: [60.024, 30.343], categories: ["Парк", "Прогулка", "Спорт"], description: "Просторный парк для активного или спокойного сценария.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },

  { id: "park-300", name: "Парк 300-летия Санкт-Петербурга", district: "Приморский", address: "Приморский пр., 74", coords: [59.9838, 30.198], categories: ["Парк", "У воды", "Закат"], description: "Прогулка у Финского залива с открытым горизонтом.", website: "https://www.visit-petersburg.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "lakhta", name: "Лахта Центр", district: "Приморский", address: "Высотная ул., 1", coords: [59.9871, 30.1778], categories: ["Архитектура", "Красивый вид", "Прогулка"], description: "Современная городская панорама рядом с заливом.", website: "https://lakhta.center/", source: "Wikidata", sourceUrl: wikidata },
  { id: "elagin", name: "Елагин остров", district: "Приморский", address: "Елагин остров, 4", coords: [59.9804, 30.258], categories: ["Парк", "Прогулка", "Свидание"], description: "Островной парк с длинными прогулочными маршрутами.", website: "https://elaginpark.org/", source: "Visit Petersburg", sourceUrl: visit },
];

export function placesForDistrict(district: DistrictName) {
  if (district === "Неважно") return cityPlaces.slice(0, 12);
  return cityPlaces.filter((place) => place.district === district);
}

export type CityId = "moscow" | "spb";
export type CityConfig = {
  id: CityId;
  name: string;
  shortName: string;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  districts: string[];
  defaultDistrict: string;
  districtCenters: Record<string, { label: string; coords: [number, number] }>;
  places: CityPlace[];
};

const moscowDistrictCenters: Record<string, { label: string; coords: [number, number] }> = {
  Центральный: { label: "район Тверской", coords: [55.7648, 37.6054] },
  Арбат: { label: "район Арбата", coords: [55.7511, 37.5937] },
  Хамовники: { label: "район Парка Горького", coords: [55.7297, 37.6019] },
  Замоскворечье: { label: "район Третьяковской", coords: [55.7414, 37.6205] },
  Пресненский: { label: "район Патриарших прудов", coords: [55.7658, 37.5938] },
  Басманный: { label: "район Чистых прудов", coords: [55.7656, 37.6473] },
  Даниловский: { label: "район Даниловского рынка", coords: [55.7089, 37.6232] },
  Неважно: { label: "центр Москвы", coords: [55.7558, 37.6173] },
};
const spbDistricts = Object.keys(districtCenters);

const moscowPlaces: CityPlace[] = [
  { id: "msk-red-square", name: "Красная площадь", district: "Центральный", address: "Красная площадь", coords: [55.7539, 37.6208], categories: ["Прогулка", "Архитектура", "Красивый вид"], description: "Главная городская прогулка с понятным стартом у центра.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-zaryadye", name: "Парк Зарядье", district: "Центральный" as DistrictName, address: "ул. Варварка, 6", coords: [55.7525, 37.6274], categories: ["Парк", "Прогулка", "Красивый вид"], description: "Парк, вид на реку и архитектура в нескольких минутах от центра.", website: "https://www.zaryadyepark.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-gum", name: "ГУМ", district: "Центральный" as DistrictName, address: "Красная площадь, 3", coords: [55.7547, 37.6215], categories: ["Еда", "Архитектура", "Кофе"], description: "Тёплая городская остановка рядом с Красной площадью.", website: "https://gum.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-tretyakov", name: "Третьяковская галерея", district: "Замоскворечье" as DistrictName, address: "Лаврушинский пер., 10", coords: [55.7414, 37.6205], categories: ["Музей", "Выставка", "Искусство"], description: "Культурная точка в тихой части центра.", website: "https://www.tretyakovgallery.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-muzeon", name: "Парк искусств Музеон", district: "Хамовники" as DistrictName, address: "Крымский Вал, 2", coords: [55.7358, 37.6071], categories: ["Парк", "Прогулка", "Искусство"], description: "Прогулка у Москвы-реки с пространством для длинного разговора.", website: "https://park-gorkogo.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-gorky", name: "Парк Горького", district: "Хамовники" as DistrictName, address: "Крымский Вал, 9", coords: [55.7297, 37.6019], categories: ["Парк", "Прогулка", "Свидание"], description: "Большой городской парк для спокойной программы на воздухе.", website: "https://park-gorkogo.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-arbat", name: "Старый Арбат", district: "Арбат" as DistrictName, address: "ул. Арбат", coords: [55.7496, 37.5925], categories: ["Прогулка", "Архитектура", "Кофе"], description: "Пешеходный маршрут с кафе и городскими деталями.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-patriarshie", name: "Патриаршие пруды", district: "Пресненский" as DistrictName, address: "Патриаршие пруды", coords: [55.7644, 37.5929], categories: ["Прогулка", "Красивый вид", "Свидание"], description: "Компактный район для встречи, прогулки и ужина.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-ermolova", name: "Театр имени Ермоловой", district: "Центральный" as DistrictName, address: "Тверская ул., 5/6", coords: [55.7594, 37.6107], categories: ["Театр", "Культура", "События"], description: "Театральная остановка на Тверской для вечернего формата.", website: "https://ermolova.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-tverskoy", name: "Тверской бульвар", district: "Центральный" as DistrictName, address: "Тверской бульвар", coords: [55.7614, 37.5983], categories: ["Прогулка", "Парк", "Красивый вид"], description: "Зелёная связка между Патриаршими и Тверской.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-chistye", name: "Чистые пруды", district: "Басманный" as DistrictName, address: "Чистопрудный бульвар", coords: [55.7654, 37.6455], categories: ["Прогулка", "Парк", "Кофе"], description: "Бульварная прогулка для неспешного вечера.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-winery", name: "Винзавод", district: "Басманный" as DistrictName, address: "4-й Сыромятнический пер., 1/8", coords: [55.7572, 37.6655], categories: ["Выставка", "Искусство", "События"], description: "Галереи, выставки и кафе в одном квартале.", website: "https://winzavod.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-flacon", name: "Хлебозавод", district: "Басманный" as DistrictName, address: "Новодмитровская ул., 1", coords: [55.8066, 37.5804], categories: ["Еда", "События", "Кофе"], description: "Городское пространство с едой и программой.", website: "https://hlebozavod9.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-danilovsky", name: "Даниловский рынок", district: "Даниловский" as DistrictName, address: "Мытная ул., 74", coords: [55.7089, 37.6232], categories: ["Еда", "Стритфуд", "Кофе"], description: "Еда и живой городской ритм для встречи компанией.", website: "https://danilovskymarket.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-vdnkh", name: "ВДНХ", district: "Пресненский" as DistrictName, address: "просп. Мира, 119", coords: [55.8298, 37.6333], categories: ["Парк", "Музей", "События"], description: "Большая программа на целый день с прогулкой и музеями.", website: "https://vdnh.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-moscow-city", name: "Москва-Сити", district: "Пресненский" as DistrictName, address: "Пресненская наб.", coords: [55.7497, 37.5377], categories: ["Архитектура", "Красивый вид", "Еда"], description: "Современная панорама для вечернего маршрута.", website: "https://www.moscow-city.guide/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-alexander-garden", name: "Александровский сад", district: "Центральный", address: "Манежная ул., 13", coords: [55.7522, 37.6135], categories: ["Парк", "Прогулка", "История"], description: "Зелёная прогулочная точка у Кремля и Манежной площади.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-manege", name: "ЦВЗ Манеж", district: "Центральный", address: "Манежная пл., 1", coords: [55.7533, 37.6126], categories: ["Выставка", "Искусство", "События"], description: "Большая выставочная площадка рядом с Александровским садом.", website: "https://moscowmanege.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-bolshoi", name: "Большой театр", district: "Центральный", address: "Театральная пл., 1", coords: [55.7602, 37.6186], categories: ["Театр", "Музыка", "Архитектура"], description: "Классический вечерний ориентир в самом центре Москвы.", website: "https://bolshoi.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-central-market", name: "Центральный рынок", district: "Центральный", address: "Рождественский бул., 1", coords: [55.7681, 37.6218], categories: ["Еда", "Стритфуд", "Кофе"], description: "Компактный гастрономический финал рядом с бульварами.", website: "https://centralmarketmoscow.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-hermitage-garden", name: "Сад Эрмитаж", district: "Центральный", address: "ул. Каретный Ряд, 3", coords: [55.7702, 37.6097], categories: ["Парк", "Прогулка", "Театр"], description: "Небольшой сад для спокойного разговора и короткой прогулки.", website: "https://mosgorsad.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-mmoma-petrovka", name: "ММОМА на Петровке", district: "Центральный", address: "ул. Петровка, 25", coords: [55.7677, 37.6154], categories: ["Музей", "Выставка", "Искусство"], description: "Современное искусство внутри компактного маршрута по центру.", website: "https://mmoma.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-bulgakov", name: "Музей Михаила Булгакова", district: "Пресненский", address: "Большая Садовая ул., 10", coords: [55.7669, 37.5927], categories: ["Музей", "Литература", "История"], description: "Камерная культурная остановка рядом с Патриаршими.", website: "https://bulgakovmuseum.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-moscow-zoo", name: "Московский зоопарк", district: "Пресненский", address: "Большая Грузинская ул., 1", coords: [55.7622, 37.5771], categories: ["Семья", "Прогулка", "Парк"], description: "Большая дневная точка для семейного сценария.", website: "https://moscowzoo.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-planetarium", name: "Московский планетарий", district: "Пресненский", address: "Садовая-Кудринская ул., 5", coords: [55.7614, 37.5834], categories: ["Наука", "Семья", "Свидание"], description: "Познавательная остановка рядом с Патриаршими и зоопарком.", website: "https://planetarium-moscow.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-pushkin-museum", name: "ГМИИ имени Пушкина", district: "Арбат", address: "ул. Волхонка, 12", coords: [55.7473, 37.6051], categories: ["Музей", "Выставка", "Искусство"], description: "Сильная культурная точка для маршрута между Арбатом и набережной.", website: "https://pushkinmuseum.art/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-khudozhestvenny", name: "Кинотеатр Художественный", district: "Арбат", address: "Арбатская пл., 14", coords: [55.7528, 37.6003], categories: ["Кино", "Культура", "Кофе"], description: "Исторический кинотеатр и удобный вечерний ориентир.", website: "https://cinema1909.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-gogol-house", name: "Дом Гоголя", district: "Арбат", address: "Никитский бул., 7А", coords: [55.7558, 37.5991], categories: ["Музей", "Литература", "Прогулка"], description: "Небольшой музей рядом с бульваром и Арбатской площадью.", website: "https://domgogolya.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-museum-moscow", name: "Музей Москвы", district: "Хамовники", address: "Зубовский бул., 2", coords: [55.7363, 37.5937], categories: ["Музей", "Выставка", "История"], description: "Музей городской истории у Парка культуры.", website: "https://mosmuseum.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-ges2", name: "Дом культуры ГЭС-2", district: "Хамовники", address: "Болотная наб., 15", coords: [55.7443, 37.6121], categories: ["Выставка", "Искусство", "События"], description: "Современное культурное пространство у Москвы-реки.", website: "https://ges-2.org/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-krasny-october", name: "Красный Октябрь", district: "Хамовники", address: "Берсеневская наб., 6", coords: [55.7429, 37.6092], categories: ["Еда", "События", "Красивый вид"], description: "Еда и вечерние пространства рядом с ГЭС-2.", website: "https://www.redok.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-new-tretyakov", name: "Новая Третьяковка", district: "Хамовники", address: "Крымский Вал, 10", coords: [55.7352, 37.6051], categories: ["Музей", "Выставка", "Искусство"], description: "Современное искусство рядом с Музеоном и Парком Горького.", website: "https://www.tretyakovgallery.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-bolotnaya", name: "Болотная площадь", district: "Замоскворечье", address: "Болотная площадь", coords: [55.7452, 37.6151], categories: ["Прогулка", "Красивый вид", "История"], description: "Связующая прогулочная точка между набережными и центром.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-marfo-mariinsky", name: "Марфо-Мариинская обитель", district: "Замоскворечье", address: "Большая Ордынка, 34", coords: [55.7376, 37.6242], categories: ["Архитектура", "История", "Прогулка"], description: "Тихая архитектурная остановка рядом с Третьяковской.", website: "https://www.mmom.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-garage", name: "Музей Garage", district: "Хамовники", address: "Крымский Вал, 9, стр. 32", coords: [55.7273, 37.6010], categories: ["Музей", "Выставка", "Искусство"], description: "Современное искусство внутри прогулки по Парку Горького.", website: "https://garagemca.org/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-bauman-garden", name: "Сад имени Баумана", district: "Басманный", address: "Старая Басманная ул., 15А", coords: [55.7666, 37.6572], categories: ["Парк", "Прогулка", "Кофе"], description: "Компактный зелёный парк для спокойного маршрута.", website: "https://sadbaumana.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-sovremennik", name: "Театр Современник", district: "Басманный", address: "Чистопрудный бул., 19А", coords: [55.7638, 37.6486], categories: ["Театр", "Культура", "События"], description: "Вечерняя культурная точка прямо у Чистых прудов.", website: "https://sovremennik.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-artplay", name: "Центр дизайна ARTPLAY", district: "Басманный", address: "Нижняя Сыромятническая ул., 10", coords: [55.7565, 37.6674], categories: ["Выставка", "Дизайн", "Еда"], description: "Выставки, дизайн и кафе рядом с Винзаводом.", website: "https://www.artplay.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-zil", name: "Культурный центр ЗИЛ", district: "Даниловский", address: "Восточная ул., 4, корп. 1", coords: [55.7045, 37.6427], categories: ["Культура", "События", "Выставка"], description: "Культурная программа рядом с Даниловским районом.", website: "https://zilcc.ru/", source: "OpenStreetMap", sourceUrl: osm },
  { id: "msk-tulskaya-embankment", name: "Даниловская набережная", district: "Даниловский", address: "Даниловская наб.", coords: [55.7020, 37.6260], categories: ["Прогулка", "У воды", "Красивый вид"], description: "Спокойная прогулочная связка у Москвы-реки.", website: "https://www.mos.ru/", source: "OpenStreetMap", sourceUrl: osm },
];

export const cityConfigs: Record<CityId, CityConfig> = {
  moscow: { id: "moscow", name: "Москва", shortName: "Москва", center: [55.7558, 37.6173], bounds: [[36.75, 55.45], [38.15, 56.05]], districts: Object.keys(moscowDistrictCenters), defaultDistrict: "Центральный", districtCenters: moscowDistrictCenters, places: moscowPlaces },
  spb: { id: "spb", name: "Санкт-Петербург", shortName: "Петербург", center: [59.9388, 30.3146], bounds: [[29.2, 59.55], [31.5, 60.35]], districts: spbDistricts, defaultDistrict: "Центральный", districtCenters, places: cityPlaces },
};
