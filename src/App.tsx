import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Droplets,
  Flame,
  Footprints,
  Home,
  Leaf,
  LockKeyhole,
  Plus,
  Settings as SettingsIcon,
  TrendingDown,
  Utensils,
  Weight,
  Zap,
  X,
  ClipboardList,
  Upload,
  Trash2,
} from "lucide-react";
import {
  assessment,
  csvExport,
  dailyWeights,
  emptyState,
  kinds,
  londonDay,
  makeEntry,
  mergeEntries,
  pace,
  parseImport,
  rolling,
  sampleState,
  shiftDay,
  totals,
  units,
  validateEntry,
  weekStart,
  weightChange,
  type Entry,
  type Kind,
  type State,
  type Preset,
} from "./model";
import { readState, writeState, deleteState } from "./db";
const tabs = [
  { name: "Today", icon: Home },
  { name: "Training", icon: Activity },
  { name: "Weight", icon: Weight },
  { name: "Food", icon: Utensils },
  { name: "Review", icon: ClipboardList },
  { name: "Settings", icon: SettingsIcon },
];
const fmt = (v: number | null | undefined, d = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("en-GB", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Chart({ entries, day }: { entries: Entry[]; day: string }) {
  const rows = dailyWeights(entries).filter(
    (e) => e.date >= shiftDay(day, -27) && e.date <= day,
  );
  if (!rows.length)
    return (
      <div className="empty-chart">
        <TrendingDown size={32} />
        <p>Your trend starts with one weigh-in.</p>
        <span>Daily readings will appear here.</span>
      </div>
    );
  const min = Math.min(75, ...rows.map((e) => e.value)) - 0.5,
    max = Math.max(...rows.map((e) => e.value)) + 0.5;
  const x = (date: string) =>
      40 +
      ((Date.parse(date) - Date.parse(shiftDay(day, -27))) / 86400000 / 27) *
        570,
    y = (v: number) => 160 - ((v - min) / (max - min)) * 130;
  const points = rows.map((e) => `${x(e.date)},${y(e.value)}`).join(" ");
  const trend = rows
    .map((e) => `${x(e.date)},${y(rolling(entries, e.date)!)}`)
    .join(" ");
  return (
    <>
      <svg
        className="chart"
        viewBox="0 0 640 195"
        role="img"
        aria-label="Weight over the last 28 days. Points show daily averages; green line shows seven-day average."
      >
        <line
          x1="40"
          x2="610"
          y1={y(75)}
          y2={y(75)}
          stroke="#bdc5b8"
          strokeDasharray="5 5"
        />
        <text x="44" y={y(75) - 7}>
          75 kg milestone
        </text>
        <polyline
          points={points}
          fill="none"
          stroke="#b3beb0"
          strokeWidth="2"
        />
        <polyline points={trend} fill="none" stroke="#32745a" strokeWidth="3" />
        {rows.map((e) => (
          <circle
            key={e.date}
            cx={x(e.date)}
            cy={y(e.value)}
            r="4"
            fill="#fff"
            stroke="#32745a"
            strokeWidth="2"
          />
        ))}
        <text x="40" y="188">
          {shiftDay(day, -27).slice(5)}
        </text>
        <text x="565" y="188">
          {day.slice(5)}
        </text>
      </svg>
      <div className="chart-key">
        <span>● Daily average</span>
        <span className="green">━ 7-day average</span>
      </div>
      <details>
        <summary>View weight data table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Daily kg</th>
              <th>7-day kg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.date}>
                <td>{e.date}</td>
                <td>{fmt(e.value, 1)}</td>
                <td>{fmt(rolling(entries, e.date), 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
function App() {
  const [personal, setPersonal] = useState<State>(emptyState),
    [demo, setDemo] = useState<State>(sampleState),
    [sample, setSample] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("Today"),
    [day, setDay] = useState(londonDay()),
    [modal, setModal] = useState<Kind | null>(null),
    [preset, setPreset] = useState<Preset | undefined>(),
    [pending, setPending] = useState<ReturnType<typeof parseImport> | null>(
      null,
    ),
    [deleteOpen, setDeleteOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const state = sample ? demo : personal,
    today = totals(state.entries, day),
    verdict = assessment(state.entries, day, state.settings),
    latest = dailyWeights(state.entries)
      .filter((e) => e.date <= day)
      .at(-1),
    trend = rolling(state.entries, day),
    change = weightChange(state.entries, day),
    start = weekStart(day),
    week = state.entries.filter((e) => e.date >= start && e.date <= day),
    runs = week.filter((e) => e.kind === "run"),
    km = runs.reduce((a, e) => a + e.value, 0),
    lastKm = state.entries
      .filter(
        (e) =>
          e.kind === "run" && e.date >= shiftDay(start, -7) && e.date < start,
      )
      .reduce((a, e) => a + e.value, 0),
    selected = state.entries.filter((e) => e.date === day),
    energy =
      selected.filter((e) => e.kind === "energy").at(-1)?.value ??
      state.settings.tdee;
  const saving = useRef(false);
  useEffect(() => {
    readState()
      .then((s) => {
        setPersonal(s);
        setReady(true);
      })
      .catch(() =>
        setError(
          "Local storage could not open. Allow browser storage and reload before logging data.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!modal && !deleteOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,summary,[tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    function keyboard(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        setDeleteOpen(false);
      }
      if (e.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [modal, deleteOpen]);
  async function save(next: State) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (sample) setDemo(next);
      else {
        await writeState(next);
        setPersonal(next);
      }
      return true;
    } catch {
      setError(
        "Could not save to this device. Your changes have not been stored. Export a backup or check browser storage.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function open(kind: Kind, p?: Preset) {
    setPreset(p);
    setModal(kind);
    setNotice("");
  }
  async function log(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const raw: Record<string, unknown> = Object.fromEntries(f);
      const kind = modal!;
      if (kind === "meal") {
        const portions = Number(f.get("portions") || 1);
        raw.value = Number(raw.value) * portions;
        raw.protein = Number(raw.protein) * portions;
        if (portions !== 1) raw.name = String(raw.name) + ` × ${portions}`;
      }
      const entry = validateEntry(
        {
          ...raw,
          kind,
          unit: units[kind],
          source: sample ? "Synthetic sample" : "Manual",
        },
        "manual",
      );
      if (await save({ ...state, entries: [...state.entries, entry] })) {
        setModal(null);
        setNotice(
          "Entry saved" + (sample ? " in sample mode." : " on this device."),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (
      await save({
        ...state,
        entries: state.entries.filter((e) => e.id !== id),
      })
    )
      setNotice("Entry removed.");
  }
  async function importFile(file?: File) {
    setPending(null);
    setError("");
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Use a file smaller than 5 MB.");
      setPending(parseImport(await file.text(), file.name));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function records(rows: Entry[]) {
    return rows.length ? (
      <div className="record-list">
        {[...rows]
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.timestamp.localeCompare(a.timestamp),
          )
          .map((e) => (
            <div className="record" key={e.id}>
              <span className={"record-icon " + e.kind}>
                {e.kind === "meal" ? (
                  <Utensils size={18} />
                ) : e.kind === "weight" ? (
                  <Weight size={18} />
                ) : (
                  <Activity size={18} />
                )}
              </span>
              <div className="record-main">
                <strong>{e.name}</strong>
                <small>
                  {e.date} · {e.source} ·{" "}
                  {e.kind === "run"
                    ? `${fmt(e.duration)} min · ${pace(e.value, e.duration!)} /km`
                    : e.kind === "meal"
                      ? `${fmt(e.protein)} g protein`
                      : e.unit}
                </small>
                <details>
                  <summary>Provenance</summary>
                  <small>
                    {e.timestamp} · {e.timezone}
                    <br />
                    Batch: {e.batch}
                    <br />
                    {e.sessionType && `Type: ${e.sessionType} · `}
                    {e.hr && `HR: ${e.hr} bpm · `}
                    {e.effort && `Effort: ${e.effort}/10`}
                  </small>
                </details>
              </div>
              <b>
                {fmt(e.value, e.kind === "weight" || e.kind === "run" ? 1 : 0)}{" "}
                <small>{e.unit}</small>
              </b>
              <button
                className="icon-button"
                aria-label={`Delete ${e.name} on ${e.date}`}
                onClick={() => void remove(e.id)}
                disabled={busy}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
      </div>
    ) : (
      <p className="empty">Nothing logged here yet. Add your first entry.</p>
    );
  }
  function metric(
    label: string,
    value: string,
    unit: string,
    sub: string,
    icon: typeof Weight,
  ) {
    const Icon = icon;
    return (
      <article className="card metric">
        <div className="metric-title">
          {label}
          <Icon size={18} />
        </div>
        <div className="metric-value">
          {value}
          <span>{unit}</span>
        </div>
        <small>{sub}</small>
      </article>
    );
  }
  const statusBlock = (
    <div className={"verdict " + verdict.tone}>
      <span className="status-dot" />
      <div>
        <strong>{verdict.title}</strong>
        <p>{verdict.text}</p>
      </div>
    </div>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Today");
          }}
        >
          <span>
            <Zap fill="currentColor" size={23} />
          </span>
          stride<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR TRAINING SPACE</div>
        <nav aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              key={t.name}
              className={tab === t.name ? "nav active" : "nav"}
              onClick={() => setTab(t.name)}
            >
              <t.icon size={19} />
              <span>{t.name}</span>
              {tab === t.name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="race-mini">
          <span className="eyebrow">THE BIG PICTURE</span>
          <strong>Manchester 2027</strong>
          <span>April · Marathon</span>
          <div>
            <span className="tiny-dot" /> Chasing sub-3:15
          </div>
        </div>
        <div className="privacy">
          <LockKeyhole size={16} />
          <span>
            Private by design<small>Stored on this device</small>
          </span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            My dashboard <ChevronRight size={14} />
            <b>{tab}</b>
          </span>
          <div className="top-actions">
            <span className="local-tag">
              <span className="tiny-dot" /> Local journal
            </span>
            <button
              className={"sample-switch " + (sample ? "on" : "")}
              aria-pressed={sample}
              disabled={!ready || busy}
              onClick={() => {
                setSample(!sample);
                setPending(null);
                setNotice("");
                setError("");
              }}
            >
              <span className="switch-track">
                <span />
              </span>
              Sample data
            </button>
            <div className="avatar">ME</div>
          </div>
        </header>
        <div className="content">
          {sample && (
            <div className="sample-banner">
              <Flame size={16} /> Sample mode · Fictional data for exploring.
              Your personal journal is separate.
              <button
                onClick={() => {
                  setSample(false);
                  setPending(null);
                }}
              >
                Exit sample
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              <Check size={16} />
              {notice}
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "Today"
                  ? new Intl.DateTimeFormat("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/London",
                    }).format(new Date(day + "T12:00:00Z"))
                  : "YOUR MARATHON JOURNEY"}
              </div>
              <h1>
                {tab === "Today"
                  ? "One day stronger."
                  : tab === "Training"
                    ? "Make every mile count."
                    : tab === "Weight"
                      ? "The trend, not the noise."
                      : tab === "Food"
                        ? "Fuel the work."
                        : tab === "Review"
                          ? "Take a step back."
                          : "Your space. Your data."}
              </h1>
              <p>
                {tab === "Today"
                  ? "A little consistency today. A stronger finish in April."
                  : tab === "Training"
                    ? "Your completed sessions, with room for recovery."
                    : tab === "Weight"
                      ? "Daily fluctuations happen. Look at the bigger picture."
                      : tab === "Food"
                        ? "Simple logging. Enough fuel. Progress you can sustain."
                        : tab === "Review"
                          ? "A clear look at what your journal can tell you."
                          : "Local storage, transparent sources and control at every step."}
              </p>
            </div>
            {tab !== "Settings" && (
              <div className="heading-actions">
                <label className="date-control">
                  <span className="sr-only">Selected day</span>
                  <input
                    type="date"
                    value={day}
                    required
                    onChange={(e) => {
                      if (e.target.value) setDay(e.target.value);
                    }}
                  />
                </label>
                <button
                  className="primary"
                  disabled={!ready}
                  onClick={() =>
                    open(
                      tab === "Weight"
                        ? "weight"
                        : tab === "Training"
                          ? "run"
                          : "meal",
                    )
                  }
                >
                  <Plus size={17} />
                  Log{" "}
                  {tab === "Weight"
                    ? "weight"
                    : tab === "Training"
                      ? "activity"
                      : "food"}
                </button>
              </div>
            )}
          </section>
          {!ready ? (
            <div className="card empty">Opening your private journal…</div>
          ) : (
            <>
              {tab === "Today" && (
                <>
                  <section className="goal-banner">
                    <div>
                      <span className="eyebrow">THE ROAD TO MANCHESTER</span>
                      <h2>42.2 km. One clear goal.</h2>
                      <p>
                        April 2027 <span>·</span> Show up. Fuel well. Recover.
                      </p>
                    </div>
                    <div className="goal-number">
                      <strong>
                        3:15<span>:00</span>
                      </strong>
                      <span>TARGET FINISH · SUB-3:15</span>
                    </div>
                    <Activity
                      className="goal-art"
                      size={170}
                      strokeWidth={0.7}
                    />
                  </section>
                  <div className="section-heading">
                    <h2>Today at a glance</h2>
                    <span>
                      {selected.length
                        ? "Journal · " + selected.length + " entries"
                        : "Waiting for your first entry"}
                    </span>
                  </div>
                  <div className="metrics">
                    {metric(
                      "Latest weight",
                      fmt(latest?.value, 1),
                      "kg",
                      latest
                        ? `${latest.date} · ${fmt(trend, 1)} kg 7-day avg`
                        : "No weigh-in yet",
                      Weight,
                    )}
                    {metric(
                      "Food logged",
                      fmt(today.calories),
                      "kcal",
                      state.settings.calorieTarget
                        ? `${fmt(state.settings.calorieTarget - today.calories)} kcal to configured target`
                        : "No calorie target configured",
                      Flame,
                    )}
                    {metric(
                      "Protein",
                      fmt(today.protein),
                      "g",
                      "Daily guide · 140–160 g",
                      Leaf,
                    )}
                    {metric(
                      "Steps logged",
                      fmt(today.steps),
                      "steps",
                      "Journal entries · no automatic sync",
                      Footprints,
                    )}
                  </div>
                  <div className="two-column">
                    <section className="card">
                      <div className="card-heading">
                        <div>
                          <h2>Your weight trend</h2>
                          <p>Last 28 days · kg</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setTab("Weight")}
                        >
                          View details <ArrowRight size={15} />
                        </button>
                      </div>
                      <Chart entries={state.entries} day={day} />
                    </section>
                    <section className="card daily-check">
                      <span className="eyebrow">A MOMENT TO CHECK IN</span>
                      <h2>Fuel your next step.</h2>
                      {statusBlock}
                      <div className="energy-row">
                        <span>Estimated expenditure</span>
                        <b>{fmt(energy)} kcal</b>
                      </div>
                      <div className="energy-row">
                        <span>Estimated balance</span>
                        <b>
                          {energy
                            ? `${fmt(Math.abs(energy - today.calories))} kcal ${energy >= today.calories ? "deficit" : "surplus"}`
                            : "Unknown"}
                        </b>
                      </div>
                      <p className="footnote">
                        {energy
                          ? "User-entered total daily estimate; uncertainty is unknown. Meals may be incomplete. Workout calories are never added."
                          : "Set your own total daily expenditure estimate in Settings if useful. No estimate is assumed."}
                      </p>
                    </section>
                  </div>
                  <div className="two-column">
                    <section className="card">
                      <div className="card-heading">
                        <h2>This week in motion</h2>
                        <Activity size={18} />
                      </div>
                      <div className="week-summary">
                        <strong>
                          {fmt(km, 1)}
                          <span> km</span>
                        </strong>
                        <span>
                          {runs.length} runs ·{" "}
                          {week.filter((e) => e.kind === "gym").length} gym
                          sessions
                        </span>
                      </div>
                      <WeekBars entries={state.entries} day={day} />
                      <p className="footnote">
                        Monday–selected day · Friday is your preferred rest day.
                        Runna plan not connected.
                      </p>
                    </section>
                    <section className="card">
                      <div className="card-heading">
                        <h2>Small actions, big picture</h2>
                        <Plus size={18} />
                      </div>
                      <div className="quick-grid">
                        {(
                          [
                            { kind: "weight", label: "Weigh in", icon: Weight },
                            { kind: "run", label: "Log a run", icon: Activity },
                            {
                              kind: "meal",
                              label: "Add a meal",
                              icon: Utensils,
                            },
                            {
                              kind: "hydration",
                              label: "Add water",
                              icon: Droplets,
                            },
                          ] as const
                        ).map((q) => (
                          <button key={q.kind} onClick={() => open(q.kind)}>
                            <q.icon size={20} />
                            {q.label}
                            <Plus size={15} />
                          </button>
                        ))}
                      </div>
                      <div className="hydration">
                        <Droplets size={17} />
                        {fmt(today.water / 1000, 1)} L water logged today
                      </div>
                    </section>
                  </div>
                </>
              )}
              {tab === "Training" && (
                <>
                  <div className="metrics">
                    {metric(
                      "This week",
                      fmt(km, 1),
                      "km",
                      "Monday–selected day",
                      Activity,
                    )}
                    {metric(
                      "Completed runs",
                      String(runs.length),
                      "runs",
                      "Actual sessions only",
                      Footprints,
                    )}
                    {metric(
                      "Running time",
                      fmt(runs.reduce((a, e) => a + (e.duration ?? 0), 0)),
                      "min",
                      "Logged duration",
                      Activity,
                    )}
                    {metric(
                      "Last full week",
                      fmt(lastKm, 1),
                      "km",
                      "Comparison is a partial vs full week",
                      ArrowDownRight,
                    )}
                  </div>
                  {lastKm > 0 && km > lastKm * 1.3 && (
                    <div className="alert">
                      This week is already over 30% above last week. Check
                      whether the increase fits your real plan and recovery;
                      this is a conservative flag, not a training prescription.
                    </div>
                  )}
                  <section className="card">
                    <div className="card-heading">
                      <h2>Your week</h2>
                      <div className="button-row">
                        <button onClick={() => open("gym")}>Log gym</button>
                        <button onClick={() => open("steps")}>Log steps</button>
                      </div>
                    </div>
                    <WeekBars entries={state.entries} day={day} />
                    <p className="footnote">
                      Friday: preferred rest. No planned workouts are
                      fabricated; follow your Runna plan. No COROS load target
                      is used.
                    </p>
                  </section>
                  <section className="card spaced">
                    <h2>Completed sessions</h2>
                    {records(
                      state.entries.filter((e) =>
                        ["run", "gym"].includes(e.kind),
                      ),
                    )}
                  </section>
                </>
              )}
              {tab === "Weight" && (
                <>
                  <div className="metrics">
                    {metric(
                      "Latest reading",
                      fmt(latest?.value, 1),
                      "kg",
                      latest?.date ?? "No measurements",
                      Weight,
                    )}
                    {metric(
                      "7-day average",
                      fmt(trend, 1),
                      "kg",
                      "Mean of available daily means",
                      TrendingDown,
                    )}
                    {metric(
                      "Weekly trend change",
                      fmt(change, 2),
                      "kg",
                      "Current vs preceding 7-day average",
                      Activity,
                    )}
                    {metric(
                      "First milestone",
                      "75",
                      "kg",
                      "Sustainable progress, supported by recovery",
                      Leaf,
                    )}
                  </div>
                  <section className="card">
                    <h2>A steadier view</h2>
                    <Chart entries={state.entries} day={day} />
                    <p className="footnote">
                      Missing days are not invented. Averages with few weigh-ins
                      are provisional. Your guide is around 0.5–0.75 kg loss per
                      week, adjusted for training and recovery.
                    </p>
                  </section>
                  <section className="card spaced">
                    <h2>Weigh-ins</h2>
                    {records(state.entries.filter((e) => e.kind === "weight"))}
                  </section>
                </>
              )}
              {tab === "Food" && (
                <>
                  <div className="metrics food-metrics">
                    {metric(
                      "Calories logged",
                      fmt(today.calories),
                      "kcal",
                      "From meals on selected day",
                      Flame,
                    )}
                    {metric(
                      "Protein logged",
                      fmt(today.protein),
                      "g",
                      "Guide · 140–160 g per day",
                      Leaf,
                    )}
                    {metric(
                      "Your target",
                      fmt(state.settings.calorieTarget),
                      "kcal",
                      "Configure only if useful in Settings",
                      Utensils,
                    )}
                  </div>
                  <section className="card">
                    <div className="card-heading">
                      <div>
                        <h2>Your go-to meals</h2>
                        <p>
                          Editable shortcuts. Use the product label or your
                          explicit estimate.
                        </p>
                      </div>
                    </div>
                    <div className="preset-grid">
                      {state.presets.map((p) => (
                        <div className="preset" key={p.id}>
                          <Utensils size={20} />
                          <h3>{p.name}</h3>
                          <p>
                            {p.calories !== undefined
                              ? `${fmt(p.calories)} kcal · ${fmt(p.protein)} g protein`
                              : "Nutrition needed before logging"}
                          </p>
                          <div className="button-row">
                            <button onClick={() => open("meal", p)}>
                              Log portion <Plus size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove preset ${p.name}`}
                              onClick={() =>
                                void save({
                                  ...state,
                                  presets: state.presets.filter(
                                    (m) => m.id !== p.id,
                                  ),
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <details>
                            <summary>Edit preset</summary>
                            <PresetForm
                              preset={p}
                              busy={busy}
                              onSave={async (next) => {
                                await save({
                                  ...state,
                                  presets: state.presets.map((m) =>
                                    m.id === p.id ? next : m,
                                  ),
                                });
                              }}
                            />
                          </details>
                        </div>
                      ))}
                    </div>
                    <details className="spaced">
                      <summary>Add a saved meal</summary>
                      <PresetForm
                        busy={busy}
                        onSave={async (next) => {
                          if (
                            await save({
                              ...state,
                              presets: [...state.presets, next],
                            })
                          )
                            setNotice("Meal preset saved.");
                        }}
                      />
                    </details>
                  </section>
                  <section className="card spaced">
                    <h2>Food on {day}</h2>
                    {records(selected.filter((e) => e.kind === "meal"))}
                  </section>
                </>
              )}
              {tab === "Review" && (
                <>
                  <section className="card">
                    <h2>Your daily check</h2>
                    {statusBlock}
                    <p>
                      {fmt(today.calories)} kcal and {fmt(today.protein)} g
                      protein logged on {day}.{" "}
                      {selected.filter((e) => e.kind === "meal").length} meal
                      entries.
                    </p>
                    <p className="footnote">
                      This is a journal-based check, not a diagnosis. Missing
                      meals, recovery data and a connected training plan limit
                      the assessment.
                    </p>
                  </section>
                  <div className="two-column spaced">
                    <section className="card">
                      <h2>Week so far</h2>
                      <p>
                        <strong>{fmt(km, 1)} km</strong> across {runs.length}{" "}
                        runs.
                      </p>
                      <p>
                        Weight trend change:{" "}
                        <strong>{fmt(change, 2)} kg</strong>
                      </p>
                      <p>
                        {change !== null && change < -0.75
                          ? "Loss is faster than your guide. Review fuelling and recovery, especially around long runs."
                          : "Use trends across several weeks and make room for recovery."}
                      </p>
                      <p className="footnote">
                        {week.filter((e) => e.kind === "meal").length} meal
                        entries this week. A complete weekly intake cannot be
                        inferred.
                      </p>
                    </section>
                    <section className="card">
                      <h2>Next useful actions</h2>
                      <ul className="actions-list">
                        <li>
                          Complete your food log before interpreting the
                          deficit.
                        </li>
                        <li>
                          Follow your actual Runna plan; keep Friday available
                          for rest.
                        </li>
                        <li>
                          Check energy, sleep and recovery before changing
                          intake.
                        </li>
                        <li>Back up your journal from Settings.</li>
                      </ul>
                    </section>
                  </div>
                </>
              )}
              {tab === "Settings" && (
                <>
                  <section className="card">
                    <div className="card-heading">
                      <div>
                        <h2>Private, on this device</h2>
                        <p>
                          No account, cloud database, analytics or automatic
                          sync.
                        </p>
                      </div>
                      <LockKeyhole size={24} />
                    </div>
                    <p>
                      Data stays in this browser’s IndexedDB. Browser storage is
                      not encrypted by this app; anyone with access to this
                      browser profile can open it. Use your device lock and
                      export regular backups. Clearing browser data can erase
                      your journal.
                    </p>
                    <div className="button-row">
                      <button
                        onClick={() =>
                          download(
                            JSON.stringify(state, null, 2),
                            "application/json",
                            `stride-${sample ? "sample" : "backup"}-${londonDay()}.json`,
                          )
                        }
                      >
                        <Download size={16} />
                        JSON backup
                      </button>
                      <button
                        onClick={() =>
                          download(
                            csvExport(state.entries),
                            "text/csv",
                            "stride-export.csv",
                          )
                        }
                      >
                        <Download size={16} />
                        CSV export
                      </button>
                    </div>
                  </section>
                  <section className="card spaced">
                    <h2>Personal guides</h2>
                    <p className="footnote">
                      Metric units · UK locale · Europe/London. Protein guide
                      140–160 g. Energy figures are user estimates and may be
                      substantially wrong.
                    </p>
                    <form
                      className="form-grid"
                      key={`${sample}-${state.settings.tdee}-${state.settings.calorieTarget}`}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const settings = {
                          calorieTarget: f.get("calorieTarget")
                            ? Number(f.get("calorieTarget"))
                            : undefined,
                          tdee: f.get("tdee")
                            ? Number(f.get("tdee"))
                            : undefined,
                        };
                        if (await save({ ...state, settings }))
                          setNotice("Guides saved.");
                      }}
                    >
                      <label>
                        Calorie target · optional
                        <input
                          name="calorieTarget"
                          type="number"
                          min="1"
                          max="10000"
                          defaultValue={state.settings.calorieTarget}
                          placeholder="Not configured"
                        />
                      </label>
                      <label>
                        Total daily expenditure · estimated kcal
                        <input
                          name="tdee"
                          type="number"
                          min="1"
                          max="10000"
                          defaultValue={state.settings.tdee}
                          placeholder="Your own estimate"
                        />
                      </label>
                      <p className="footnote full">
                        Method: a user-supplied total daily estimate, including
                        exercise. Workout calories are not added. No calorie
                        target is inferred from weight goals.
                      </p>
                      <button className="primary" disabled={busy}>
                        Save guides
                      </button>
                    </form>
                  </section>
                  <section className="card spaced">
                    <h2>Import & restore</h2>
                    <p>
                      Preview a Stride JSON backup or CSV/JSON records using the
                      common format. Native Health Auto Export and COROS files
                      need a future adapter built against a redacted export.
                    </p>
                    <div className="button-row">
                      <label className="upload-button">
                        <Upload size={16} />
                        Choose CSV or JSON
                        <input
                          type="file"
                          accept=".json,.csv,application/json,text/csv"
                          onChange={(e) => {
                            void importFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={() =>
                          download(
                            "kind,date,value,unit,name,protein,duration,hr,effort,source\nweight,2026-01-01,80,kg,Example weigh-in,,,,,Template\nrun,2026-01-01,5,km,Example run,,30,140,4,Template\nmeal,2026-01-01,400,kcal,Example meal,25,,,,Template\n",
                            "text/csv",
                            "stride-template.csv",
                          )
                        }
                      >
                        Download template
                      </button>
                    </div>
                    <p className="footnote">
                      Supported units: kg/lb, km/mi, kcal, min, steps, ml/l.
                      Each row needs kind, date and value; meals also need
                      protein, runs need duration in minutes. Template rows are
                      fictional.
                    </p>
                    {pending && (
                      <div className="import-preview">
                        <h3>Import preview</h3>
                        <p>
                          {pending.entries.length} valid records ·{" "}
                          {pending.errors.length} errors ·{" "}
                          {
                            mergeEntries(state.entries, pending.entries)
                              .duplicates
                          }{" "}
                          duplicates to skip
                        </p>
                        {pending.errors.length > 0 && (
                          <div role="alert" className="alert">
                            Import blocked until every row is valid.
                            <ul>
                              {pending.errors.slice(0, 10).map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Kind</th>
                                <th>Value</th>
                                <th>Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pending.entries.slice(0, 8).map((e) => (
                                <tr key={e.id}>
                                  <td>{e.date}</td>
                                  <td>{e.kind}</td>
                                  <td>
                                    {fmt(e.value, 1)} {e.unit}
                                  </td>
                                  <td>{e.source}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="footnote">
                          Duplicates match kind, date, value, name, duration and
                          protein, across sources. Preview before accepting:
                          identical same-day entries are treated as duplicates.
                        </p>
                        <div className="button-row">
                          <button
                            className="primary"
                            disabled={busy || !!pending.errors.length}
                            onClick={async () => {
                              const m = mergeEntries(
                                state.entries,
                                pending.entries,
                              );
                              if (
                                await save({ ...state, entries: m.entries })
                              ) {
                                setPending(null);
                                setNotice(
                                  `${m.added} entries imported; ${m.duplicates} duplicates skipped.`,
                                );
                              }
                            }}
                          >
                            Confirm merge
                          </button>
                          {pending.backup && (
                            <button
                              disabled={busy || !!pending.errors.length}
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    "Replace all data and meal presets in the current mode with this backup? Export first if you want to keep the current journal.",
                                  )
                                ) {
                                  if (await save(pending.backup!)) {
                                    setPending(null);
                                    setNotice("Backup restored.");
                                  }
                                }
                              }}
                            >
                              Replace with backup
                            </button>
                          )}
                          <button onClick={() => setPending(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                  <section className="card spaced">
                    <h2>Connections & provenance</h2>
                    {[
                      "Apple Health / Health Auto Export",
                      "COROS",
                      "Happy Scale",
                      "Runna plan",
                    ].map((name) => (
                      <div className="connection" key={name}>
                        <span>{name}</span>
                        <span className="badge">Not connected</span>
                      </div>
                    ))}
                    <p className="footnote">
                      A web app cannot read HealthKit directly. Existing ChatGPT
                      connections do not grant this app access. No automatic
                      sync has run. Manual and accepted imported entries are
                      used; no source silently overwrites another.
                    </p>
                    <details>
                      <summary>Import history</summary>
                      {[
                        ...new Set(
                          state.entries
                            .filter((e) => e.batch !== "manual")
                            .map((e) => e.batch),
                        ),
                      ].map((batch) => (
                        <p key={batch}>
                          {batch} ·{" "}
                          {
                            state.entries.filter((e) => e.batch === batch)
                              .length
                          }{" "}
                          records
                        </p>
                      ))}
                      {!state.entries.some((e) => e.batch !== "manual") && (
                        <p>No imports yet.</p>
                      )}
                    </details>
                  </section>
                  <section className="card spaced danger-zone">
                    <h2>Delete {sample ? "sample" : "personal"} data</h2>
                    <p>
                      Remove all journal entries, settings and meal presets in
                      this mode. Downloaded backups remain on your device.
                    </p>
                    <button
                      className="danger"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 size={16} />
                      Delete all data
                    </button>
                  </section>
                </>
              )}
            </>
          )}
          <footer>
            <span>
              <LockKeyhole size={13} /> Your data stays with you.
            </span>
            <span>Built for the long run.</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-title"
          >
            <div className="card-heading">
              <h2 id="entry-title">Log {modal}</h2>
              <button
                className="icon-button"
                aria-label="Close entry form"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            <form onSubmit={log} className="form-grid">
              <label>
                Entry type
                <select
                  value={modal}
                  onChange={(e) => {
                    setPreset(undefined);
                    setModal(e.target.value as Kind);
                  }}
                >
                  {kinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input name="date" type="date" defaultValue={day} required />
              </label>
              <label className="full">
                {modal === "meal" ? "Meal name" : "Description"}
                <input
                  autoFocus
                  key={preset?.id ?? modal}
                  name="name"
                  defaultValue={
                    preset?.name ?? (modal === "run" ? "Easy run" : modal)
                  }
                  required
                  maxLength={200}
                />
              </label>
              <label>
                {modal === "meal"
                  ? "Calories per portion"
                  : `Value (${units[modal]})`}
                <input
                  key={`v-${preset?.id ?? modal}`}
                  name="value"
                  type="number"
                  step="any"
                  min={["weight", "run", "gym"].includes(modal) ? "0.01" : "0"}
                  max="100000"
                  defaultValue={preset?.calories}
                  required
                />
              </label>
              {modal === "meal" && (
                <>
                  <label>
                    Protein per portion (g)
                    <input
                      key={preset?.id}
                      name="protein"
                      type="number"
                      step="any"
                      min="0"
                      max="10000"
                      defaultValue={preset?.protein}
                      required
                    />
                  </label>
                  <label>
                    Portions
                    <input
                      name="portions"
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.1"
                      defaultValue="1"
                      required
                      onChange={() => {}}
                    />
                  </label>
                  <p className="footnote full">
                    Use verified nutrition or your explicit estimate. Portions
                    multiply the calories and protein above.
                  </p>
                </>
              )}
              {modal === "run" && (
                <>
                  <label>
                    Duration (minutes)
                    <input
                      name="duration"
                      type="number"
                      min="0.1"
                      max="10000"
                      step="any"
                      required
                    />
                  </label>
                  <label>
                    Session type
                    <select name="sessionType">
                      <option>Easy</option>
                      <option>Long run</option>
                      <option>Intervals</option>
                      <option>Tempo</option>
                      <option>Race</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    Heart rate (bpm) · optional
                    <input name="hr" type="number" min="1" max="250" />
                  </label>
                </>
              )}
              {["run", "gym"].includes(modal) && (
                <label>
                  Effort (1–10) · optional
                  <input name="effort" type="number" min="1" max="10" />
                </label>
              )}
              {modal === "energy" && (
                <p className="footnote full">
                  Enter a total daily expenditure estimate including exercise.
                  This replaces the Settings estimate for this day; it is never
                  added to it.
                </p>
              )}
              {modal === "steps" && (
                <p className="footnote full">
                  Log an increment or one daily total. Entries add together; do
                  not log the same total twice.
                </p>
              )}
              {error && (
                <div className="alert full" role="alert">
                  {error}
                </div>
              )}
              <button className="primary full" disabled={busy}>
                Save {sample ? "sample " : ""}entry
              </button>
            </form>
          </section>
        </div>
      )}
      {deleteOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">
              Delete all {sample ? "sample" : "personal"} data?
            </h2>
            <p>
              This cannot be undone without a backup. Type DELETE to confirm.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (new FormData(e.currentTarget).get("confirm") !== "DELETE")
                  return;
                try {
                  const cleared: State = {
                    version: 1,
                    entries: [],
                    presets: [],
                    settings: {},
                  };
                  if (sample) setDemo(cleared);
                  else {
                    await deleteState();
                    await writeState(cleared);
                    setPersonal(cleared);
                  }
                  setPending(null);
                  setDeleteOpen(false);
                  setNotice("All data in this mode has been deleted.");
                } catch {
                  setError("Deletion failed. Please try again.");
                }
              }}
            >
              <label>
                Confirmation
                <input
                  autoFocus
                  name="confirm"
                  required
                  pattern="DELETE"
                  placeholder="DELETE"
                />
              </label>
              <div className="button-row spaced">
                <button className="danger">Permanently delete</button>
                <button type="button" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function WeekBars({ entries, day }: { entries: Entry[]; day: string }) {
  const start = weekStart(day),
    days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i)),
    values = days.map((d) =>
      entries
        .filter((e) => e.kind === "run" && e.date === d)
        .reduce((a, e) => a + e.value, 0),
    ),
    max = Math.max(10, ...values);
  return (
    <div
      className="week-bars"
      role="img"
      aria-label={days
        .map((d, i) => `${d}: ${fmt(values[i], 1)} km`)
        .join("; ")}
    >
      {days.map((d, i) => (
        <div key={d} className={d === day ? "current" : ""}>
          <span>{values[i] ? fmt(values[i], 1) : "—"}</span>
          <div className="bar-track">
            <div
              style={{ height: `${Math.max(3, (values[i] / max) * 100)}%` }}
            />
          </div>
          <small>{["M", "T", "W", "T", "F", "S", "S"][i]}</small>
        </div>
      ))}
    </div>
  );
}
function PresetForm({
  preset,
  busy,
  onSave,
}: {
  preset?: Preset;
  busy: boolean;
  onSave: (p: Preset) => Promise<void>;
}) {
  return (
    <form
      className="form-grid preset-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        await onSave({
          id: preset?.id ?? crypto.randomUUID(),
          name: String(f.get("name")),
          calories:
            f.get("calories") !== "" ? Number(f.get("calories")) : undefined,
          protein:
            f.get("protein") !== "" ? Number(f.get("protein")) : undefined,
        });
        if (!preset) form.reset();
      }}
    >
      <label className="full">
        Meal name
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={preset?.name}
        />
      </label>
      <label>
        Calories · optional
        <input
          name="calories"
          type="number"
          min="0"
          max="100000"
          step="any"
          defaultValue={preset?.calories}
        />
      </label>
      <label>
        Protein g · optional
        <input
          name="protein"
          type="number"
          min="0"
          max="10000"
          step="any"
          defaultValue={preset?.protein}
        />
      </label>
      <button disabled={busy}>Save meal preset</button>
    </form>
  );
}
export default App;
