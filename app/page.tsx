"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "builder" | "room" | "plans" | "final";

const goals = [
  { id: "talk", icon: "✦", title: "Поговорить", text: "Тихое место и время без спешки" },
  { id: "fun", icon: "↗", title: "Повеселиться", text: "Игра, впечатления и немного азарта" },
  { id: "date", icon: "♡", title: "Свидание", text: "Красивый план на двоих" },
  { id: "food", icon: "⌁", title: "Вкусно поесть", text: "Новая кухня или любимая классика" },
  { id: "walk", icon: "○", title: "Погулять", text: "Город, воздух и длинный маршрут" },
  { id: "surprise", icon: "?", title: "Удивите нас", text: "Довериться подборке целиком" },
];

const companies = ["Друзья", "Свидание", "Коллеги", "Семья"];
const sizes = ["2", "3–5", "6–10", "10+"];
const timeOptions = [
  { id: "fri", day: "Пятница", date: "21 августа", time: "19:00–23:30", note: "Вечер после работы" },
  { id: "sat", day: "Суббота", date: "22 августа", time: "16:00–22:00", note: "Самый гибкий вариант" },
  { id: "sun", day: "Воскресенье", date: "23 августа", time: "14:00–19:00", note: "Спокойный день" },
];
const budgets = ["До 1 000 ₽", "До 2 500 ₽", "До 5 000 ₽", "Неважно"];
const stations = ["Невский пр.", "Сенная", "Петроградская", "Василеостровская", "Другая"];
const preferences = ["Настолки", "Выставка", "Бар", "Прогулка", "Живая музыка", "Новая кухня"];

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

export default function Home() {
  const [mode, setMode] = useState<Mode>("builder");
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("talk");
  const [company, setCompany] = useState("Друзья");
  const [size, setSize] = useState("3–5");
  const [times, setTimes] = useState<string[]>(["sat"]);
  const [budget, setBudget] = useState("До 2 500 ₽");
  const [station, setStation] = useState("Сенная");
  const [prefs, setPrefs] = useState<string[]>(["Прогулка", "Новая кухня"]);
  const [meetingName, setMeetingName] = useState("Августовский вечер");
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("fontanka");

  const selectedGoal = useMemo(() => goals.find((item) => item.id === goal) ?? goals[0], [goal]);
  const chosenTimes = timeOptions.filter((item) => times.includes(item.id));
  const currentPlan = demoPlans.find((item) => item.id === selectedPlan) ?? demoPlans[0];

  useEffect(() => {
    const draft = { goal, company, size, times, budget, station, prefs, meetingName };
    window.localStorage.setItem("soberyomsya-draft", JSON.stringify(draft));
  }, [goal, company, size, times, budget, station, prefs, meetingName]);

  function toggleFromList(value: string, list: string[], setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function shareMeeting() {
    const shareData = { title: meetingName, text: "Отметь, когда тебе удобно — соберём общий план встречи", url: "https://soberyomsya.ru/p/SPB482" };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user closed share sheet */ }
    }
    await navigator.clipboard?.writeText(shareData.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function resetMeeting() {
    setMode("builder"); setStep(1); setGoal("talk"); setCompany("Друзья"); setSize("3–5");
    setTimes(["sat"]); setBudget("До 2 500 ₽"); setStation("Сенная");
    setPrefs(["Прогулка", "Новая кухня"]); setMeetingName("Августовский вечер");
  }

  return (
    <main className={`app-shell mode-${mode}`}>
      <header className="topbar">
        <button className="brand brand-button" onClick={resetMeeting} type="button" aria-label="Соберёмся — на главную">
          <span className="brand-mark">с</span><span>соберёмся</span>
        </button>
        <div className="city-pill"><span /> Санкт-Петербург</div>
        <button className="quiet-button" onClick={resetMeeting} type="button">+ Новая встреча</button>
      </header>

      {mode === "builder" && (
        <section className="builder-layout">
          <aside className="builder-aside">
            <p className="eyebrow">Встреча начинается здесь</p>
            <h1>{step === 1 ? <>Хватит решать,<br /><em>куда пойдём.</em></> : <>Одна встреча.<br /><em>Общее решение.</em></>}</h1>
            <p className="lede">
              {step === 1
                ? "Соберите пожелания друзей — мы найдём общее время и предложим три готовых плана по Петербургу."
                : "Настройте основу сейчас. Остальные участники добавят своё время и пожелания по ссылке."}
            </p>
            <div className="aside-summary">
              <span className="summary-kicker">Ваша встреча</span>
              <strong>{meetingName || "Без названия"}</strong>
              <div className="summary-line"><span>{selectedGoal.icon}</span>{selectedGoal.title}</div>
              <div className="summary-line"><span>⌁</span>{company} · {size} чел.</div>
              <div className="summary-line"><span>◷</span>{chosenTimes.length || "Нет"} {chosenTimes.length === 1 ? "вариант времени" : "варианта времени"}</div>
            </div>
            <div className="trust-row">
              <div className="faces" aria-hidden="true"><span>А</span><span>М</span><span>К</span></div>
              <p><strong>Без регистрации</strong><br />для ваших друзей</p>
            </div>
          </aside>

          <section className="planner-card" aria-live="polite">
            <div className="step-meta">
              <span>{String(step).padStart(2, "0")}</span>
              <div className="progress"><i style={{ width: `${step * 20}%` }} /></div>
              <span>05</span>
            </div>

            {step === 1 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Первым делом</p><h2>Зачем встречаемся?</h2></div><span className="sun-mark">＊</span></div>
                <p className="field-hint">Выберите главную цель — она повлияет на темп и формат планов.</p>
                <div className="goal-grid goal-grid-six">
                  {goals.map((item) => (
                    <button className={`goal-card ${goal === item.id ? "is-active" : ""}`} key={item.id} onClick={() => setGoal(item.id)} type="button">
                      <span className="goal-icon">{item.icon}</span><strong>{item.title}</strong><small>{item.text}</small><span className="goal-check">✓</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Состав компании</p><h2>Кто будет?</h2></div><span className="sun-mark">⌁</span></div>
                <div className="field-group"><label>Вы встречаетесь как</label><div className="choice-row">{companies.map((item) => <button className={company === item ? "choice active" : "choice"} onClick={() => setCompany(item)} type="button" key={item}>{item}</button>)}</div></div>
                <div className="field-group"><label>Сколько вас будет</label><div className="size-row">{sizes.map((item) => <button className={size === item ? "size-choice active" : "size-choice"} onClick={() => setSize(item)} type="button" key={item}><strong>{item}</strong><span>{item === "2" ? "человека" : item === "10+" ? "большая компания" : "человек"}</span></button>)}</div></div>
                <div className="notice"><span>i</span><p><strong>Участники смогут уточнить это сами.</strong><br />По ссылке мы спросим про детей, алкоголь, доступность и сколько можно ходить.</p></div>
              </div>
            )}

            {step === 3 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Общие окна</p><h2>Когда получится?</h2></div><span className="sun-mark">◷</span></div>
                <p className="field-hint">Отметьте несколько вариантов — друзья выберут подходящие.</p>
                <div className="time-list">{timeOptions.map((item) => (
                  <button className={`time-card ${times.includes(item.id) ? "active" : ""}`} onClick={() => toggleFromList(item.id, times, setTimes)} type="button" key={item.id}>
                    <span className="date-tile"><b>{item.date.split(" ")[0]}</b><small>авг</small></span>
                    <span className="time-copy"><strong>{item.day}</strong><small>{item.note}</small></span>
                    <span className="time-value">{item.time}</span><span className="round-check">✓</span>
                  </button>
                ))}</div>
                <button className="add-option" type="button">+ Добавить свой вариант</button>
              </div>
            )}

            {step === 4 && (
              <div className="step-panel">
                <div className="planner-heading"><div><p>Комфорт для всех</p><h2>Что важно учесть?</h2></div><span className="sun-mark">◎</span></div>
                <div className="field-group"><label>Бюджет на человека</label><div className="choice-row wrap">{budgets.map((item) => <button className={budget === item ? "choice active" : "choice"} onClick={() => setBudget(item)} type="button" key={item}>{item}</button>)}</div></div>
                <div className="field-group"><label>Откуда удобнее начинать</label><div className="choice-row wrap">{stations.map((item) => <button className={station === item ? "choice active" : "choice"} onClick={() => setStation(item)} type="button" key={item}><span className="metro-dot">М</span>{item}</button>)}</div></div>
                <div className="field-group"><label>Что точно хочется</label><div className="preference-grid">{preferences.map((item) => <button className={prefs.includes(item) ? "preference active" : "preference"} onClick={() => toggleFromList(item, prefs, setPrefs)} type="button" key={item}><span>{prefs.includes(item) ? "✓" : "+"}</span>{item}</button>)}</div></div>
              </div>
            )}

            {step === 5 && (
              <div className="step-panel review-panel">
                <div className="planner-heading"><div><p>Почти готово</p><h2>Назовём встречу</h2></div><span className="sun-mark">✓</span></div>
                <label className="name-field"><span>Название</span><input value={meetingName} onChange={(event) => setMeetingName(event.target.value)} maxLength={42} /></label>
                <div className="review-card">
                  <div><span className="review-icon">{selectedGoal.icon}</span><p><small>Цель</small><strong>{selectedGoal.title}</strong></p></div>
                  <div><span className="review-icon">⌁</span><p><small>Компания</small><strong>{company} · {size} чел.</strong></p></div>
                  <div><span className="review-icon">◷</span><p><small>Время</small><strong>{chosenTimes.length} варианта</strong></p></div>
                  <div><span className="review-icon">₽</span><p><small>Бюджет</small><strong>{budget}</strong></p></div>
                </div>
                <p className="privacy-note">Точная геопозиция не нужна. Мы покажем друзьям только выбранные вами варианты.</p>
              </div>
            )}

            <div className="planner-footer">
              <button className={`back-button ${step === 1 ? "is-hidden" : ""}`} onClick={() => setStep((value) => Math.max(1, value - 1))} type="button">← Назад</button>
              <button className="primary-button" disabled={(step === 3 && times.length === 0) || (step === 5 && !meetingName.trim())} onClick={() => step < 5 ? setStep(step + 1) : setMode("room")} type="button">
                {step === 5 ? "Создать встречу" : "Продолжить"}<b>→</b>
              </button>
            </div>
          </section>
        </section>
      )}

      {mode === "room" && (
        <section className="room-page">
          <div className="success-mark">✓</div><p className="eyebrow">Комната создана</p><h1>{meetingName}</h1>
          <p className="room-lede">Отправьте ссылку друзьям. Они отметят время, бюджет и пожелания — без регистрации.</p>
          <div className="share-bar"><span><small>Ссылка на встречу</small><strong>soberyomsya.ru/p/SPB482</strong></span><button onClick={shareMeeting} type="button">{copied ? "Скопировано ✓" : "Поделиться ↗"}</button></div>
          <div className="room-grid">
            <section className="response-card"><div className="section-title"><div><p>Ответы участников</p><h2>3 из 4 готовы</h2></div><span className="live-pill">● обновляется</span></div>
              <div className="people-list">
                <div><span className="person-avatar you">В</span><p><strong>Вы</strong><small>Организатор</small></p><b>Готово ✓</b></div>
                <div><span className="person-avatar anna">А</span><p><strong>Анна</strong><small>Ответила 4 мин назад</small></p><b>Готово ✓</b></div>
                <div><span className="person-avatar misha">М</span><p><strong>Миша</strong><small>Ответил сейчас</small></p><b>Готово ✓</b></div>
                <div className="waiting"><span className="person-avatar">К</span><p><strong>Катя</strong><small>Ещё не открыла ссылку</small></p><button onClick={shareMeeting} type="button">Напомнить</button></div>
              </div>
            </section>
            <aside className="intersection-card"><p>Уже есть пересечение</p><div className="intersection-date"><span>22</span><p><strong>Суббота</strong><small>18:30–22:00</small></p></div><div className="mini-tags"><span>{budget}</span><span>{station}</span><span>{prefs[0] || "Общение"}</span></div><p className="muted-copy">Троим подходит это окно. Можно посмотреть предварительные планы уже сейчас.</p><button className="primary-button full" onClick={() => setMode("plans")} type="button">Показать 3 плана <b>→</b></button></aside>
          </div>
        </section>
      )}

      {mode === "plans" && (
        <section className="plans-page">
          <div className="plans-header"><div><p className="eyebrow">Суббота · после 18:30</p><h1>Три плана для вашей компании</h1><p>Все варианты проходят по времени и бюджету. Отличается только характер вечера.</p></div><button className="edit-link" onClick={() => { setMode("builder"); setStep(4); }} type="button">Изменить условия</button></div>
          <div className="plan-list">{demoPlans.map((plan) => (
            <article className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} key={plan.id}>
              <button className="plan-select-area" onClick={() => setSelectedPlan(plan.id)} type="button" aria-label={`Выбрать план ${plan.title}`}>
                <span className={`plan-number ${plan.color}`}>{plan.number}</span><span className="plan-main"><small className="plan-badge">{plan.badge}</small><strong>{plan.title}</strong><em>{plan.subtitle}</em></span>
                <span className="plan-meta"><small>{plan.area}</small><strong>{plan.price}</strong></span><span className="plan-score"><strong>{plan.score}</strong><small>совпадение</small></span><span className="radio-dot" />
              </button>
              {selectedPlan === plan.id && <div className="plan-details"><p><span>Почему подходит</span>{plan.reason}</p><ol>{plan.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>}
            </article>
          ))}</div>
          <div className="plan-action"><p>Цены и время — ориентир для демо-версии. Перед встречей всё можно уточнить.</p><button className="primary-button" onClick={() => setMode("final")} type="button">Выбрать этот план <b>→</b></button></div>
        </section>
      )}

      {mode === "final" && (
        <section className="final-page">
          <div className="final-confetti">✦</div><p className="eyebrow">Решено!</p><h1>{currentPlan.title}</h1><p className="room-lede">Суббота, 22 августа · встречаемся в 18:30</p>
          <div className="final-card"><div className="final-card-head"><span className={`plan-number ${currentPlan.color}`}>{currentPlan.number}</span><div><small>{meetingName}</small><strong>{currentPlan.subtitle}</strong></div><span className="confirmed-pill">План выбран ✓</span></div>
            <div className="route-list">{currentPlan.steps.map((item, index) => { const [time, title] = item.split(" · "); return <div key={item}><span>{time}</span><i>{index + 1}</i><p><strong>{title}</strong><small>{index === 0 ? station : index === 1 ? "10–20 минут пешком" : "Можно пропустить"}</small></p></div>; })}</div>
            <div className="final-bottom"><span><small>Ориентир по бюджету</small><strong>{currentPlan.price}</strong></span><button onClick={shareMeeting} type="button">{copied ? "Ссылка скопирована ✓" : "Отправить итог друзьям ↗"}</button></div>
          </div>
          <div className="final-actions"><button className="back-button" onClick={() => setMode("plans")} type="button">← Вернуться к планам</button><button className="quiet-button" onClick={resetMeeting} type="button">Создать ещё одну встречу</button></div>
        </section>
      )}
    </main>
  );
}
