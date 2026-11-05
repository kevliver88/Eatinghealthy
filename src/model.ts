export type Kind =
  "weight" | "meal" | "run" | "gym" | "steps" | "hydration" | "energy";
export interface Entry {
  id: string;
  kind: Kind;
  date: string;
  timestamp: string;
  timezone: string;
  source: string;
  batch: string;
  dedupKey: string;
  unit: string;
  value: number;
  name: string;
  protein?: number;
  duration?: number;
  hr?: number;
  effort?: number;
  sessionType?: string;
}
export interface Preset {
  id: string;
  name: string;
  calories?: number;
  protein?: number;
}
export interface Settings {
  calorieTarget?: number;
  tdee?: number;
}
export interface State {
  version: 1;
  entries: Entry[];
  presets: Preset[];
  settings: Settings;
}
export const kinds: Kind[] = [
  "weight",
  "meal",
  "run",
  "gym",
  "steps",
  "hydration",
  "energy",
];
export const units: Record<Kind, string> = {
  weight: "kg",
  meal: "kcal",
  run: "km",
  gym: "min",
  steps: "steps",
  hydration: "ml",
  energy: "kcal",
};
export const londonDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function shiftDay(day: string, amount: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function weekStart(day: string) {
  const d = new Date(day + "T12:00:00Z").getUTCDay();
  return shiftDay(day, -(d === 0 ? 6 : d - 1));
}
export function convert(value: number, from: string, kind: Kind): number {
  if (from === units[kind]) return value;
  if (kind === "weight" && from === "lb") return value * 0.45359237;
  if (kind === "run" && from === "mi") return value * 1.609344;
  if (kind === "hydration" && from === "l") return value * 1000;
  throw new Error(`Unsupported unit ${from} for ${kind}.`);
}
export function key(
  e: Pick<Entry, "kind" | "date" | "value" | "name" | "duration" | "protein">,
) {
  return JSON.stringify([
    e.kind,
    e.date,
    Number(e.value.toFixed(4)),
    e.name.trim().toLowerCase(),
    e.duration ?? null,
    e.protein ?? null,
  ]);
}
export function makeEntry(
  kind: Kind,
  date: string,
  value: number,
  extra: Partial<Entry> = {},
): Entry {
  const e = {
    id: crypto.randomUUID(),
    kind,
    date,
    timestamp: new Date().toISOString(),
    timezone: "Europe/London",
    source: "Manual",
    batch: "manual",
    unit: units[kind],
    value,
    name: kind,
    dedupKey: "",
    ...extra,
  };
  e.dedupKey = key(e);
  return e;
}
export function emptyState(): State {
  return {
    version: 1,
    entries: [],
    settings: {},
    presets: [
      {
        id: "breakfast",
        name: "Greek yoghurt 300 g · granola 40 g · chia 10 g",
      },
      { id: "chicken", name: "Slow cooker chicken · weighed portion" },
      { id: "snack", name: "Protein snack · check product label" },
    ],
  };
}
export function totals(entries: Entry[], day: string) {
  const rows = entries.filter((e) => e.date === day);
  const sum = (kind: Kind) =>
    rows.filter((e) => e.kind === kind).reduce((a, e) => a + e.value, 0);
  return {
    calories: sum("meal"),
    protein: rows
      .filter((e) => e.kind === "meal")
      .reduce((a, e) => a + (e.protein ?? 0), 0),
    steps: sum("steps"),
    water: sum("hydration"),
    km: sum("run"),
  };
}
export function dailyWeights(entries: Entry[]) {
  const days = [
    ...new Set(entries.filter((e) => e.kind === "weight").map((e) => e.date)),
  ].sort();
  return days.map((date) => {
    const values = entries.filter(
      (e) => e.kind === "weight" && e.date === date,
    );
    return {
      date,
      value: values.reduce((a, e) => a + e.value, 0) / values.length,
    };
  });
}
export function rolling(entries: Entry[], day: string) {
  const rows = dailyWeights(entries).filter(
    (e) => e.date <= day && e.date >= shiftDay(day, -6),
  );
  return rows.length
    ? rows.reduce((a, e) => a + e.value, 0) / rows.length
    : null;
}
export function weightChange(entries: Entry[], day: string) {
  const a = rolling(entries, day),
    b = rolling(entries, shiftDay(day, -7));
  return a !== null && b !== null ? a - b : null;
}
export function pace(km: number, minutes: number) {
  if (!km || !minutes) return "—";
  const seconds = Math.round((minutes / km) * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function assessment(entries: Entry[], day: string, settings: Settings) {
  const t = totals(entries, day),
    meals = entries.filter((e) => e.date === day && e.kind === "meal");
  if (!meals.length)
    return {
      tone: "unknown",
      title: "A little more context",
      text: "Log your meals to see a useful fuelling check. No training plan is connected.",
    };
  const energy =
    entries.filter((e) => e.date === day && e.kind === "energy").at(-1)
      ?.value ?? settings.tdee;
  if (energy && energy - t.calories > 1000)
    return {
      tone: "red",
      title: "Check your fuelling",
      text: "Logged intake is over 1,000 kcal below estimated expenditure. Check for missing meals; if complete, prioritise food and recovery. A larger deficit is not a better result.",
    };
  if (t.protein < 140)
    return {
      tone: "amber",
      title: "Keep building your day",
      text: `${Math.round(t.protein)} g protein logged against your 140–160 g guide. Logs may be incomplete; include protein with your next meal.`,
    };
  return {
    tone: "green",
    title: "Protein guide met",
    text: "Your logged protein meets the daily guide. This is a nutrition check only; complete fuelling and alignment with your Runna plan are not verified.",
  };
}
function validDay(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
function num(v: unknown, label: string, max = 100000): number {
  if (v === "" || v == null || typeof v === "boolean")
    throw new Error(`${label} is required.`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max)
    throw new Error(`${label} must be between 0 and ${max}.`);
  return n;
}
export function validateEntry(raw: unknown, batch: string): Entry {
  if (!raw || typeof raw !== "object")
    throw new Error("Each record must be an object.");
  const r = raw as Record<string, unknown>;
  if (!kinds.includes(r.kind as Kind))
    throw new Error(
      "Unknown kind. Use weight, meal, run, gym, steps, hydration or energy.",
    );
  if (!validDay(r.date)) throw new Error("Use a valid YYYY-MM-DD date.");
  const kind = r.kind as Kind,
    value = convert(num(r.value, "value"), String(r.unit || units[kind]), kind);
  if (["weight", "run", "gym"].includes(kind) && value <= 0)
    throw new Error(`${kind} must be greater than zero.`);
  const e = makeEntry(kind, r.date, value, {
    name: String(r.name || kind).slice(0, 200),
    source: String(r.source || "File import").slice(0, 100),
    batch,
    timestamp:
      typeof r.timestamp === "string" ? r.timestamp : new Date().toISOString(),
    timezone: String(r.timezone || "Europe/London"),
  });
  if (isNaN(Date.parse(e.timestamp))) throw new Error("Invalid timestamp.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: e.timezone });
  } catch {
    throw new Error("Invalid timezone.");
  }
  for (const field of ["protein", "duration", "hr", "effort"] as const)
    if (r[field] !== undefined && r[field] !== "")
      e[field] = num(
        r[field],
        field,
        field === "effort" ? 10 : field === "hr" ? 250 : 10000,
      );
  if (kind === "run" && !e.duration)
    throw new Error("Running duration in minutes is required.");
  if (kind === "meal" && e.protein === undefined)
    throw new Error("Meal protein in grams is required.");
  if (r.sessionType) e.sessionType = String(r.sessionType).slice(0, 100);
  e.dedupKey = key(e);
  return e;
}
export function mergeEntries(existing: Entry[], incoming: Entry[]) {
  const seen = new Set(existing.map(key));
  let duplicates = 0;
  const added: Entry[] = [];
  for (const e of incoming) {
    const k = key(e);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    added.push(e);
  }
  return { entries: [...existing, ...added], added: added.length, duplicates };
}
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift()?.map((s) => s.trim().replace(/^\uFEFF/, ""));
  if (!headers?.includes("kind"))
    throw new Error("CSV needs a kind header. Download the template.");
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => {
      if (r.length !== headers.length)
        throw new Error("CSV column counts do not match.");
      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    });
}
export function parseImport(
  text: string,
  filename: string,
): { entries: Entry[]; errors: string[]; backup?: State } {
  let input: unknown = filename.toLowerCase().endsWith(".csv")
    ? parseCSV(text)
    : JSON.parse(text);
  const object = input as Partial<State>;
  const raw = Array.isArray(input) ? input : object.entries;
  if (!Array.isArray(raw))
    throw new Error(
      "Expected an array of records or a Stride backup. Native Health Auto Export and COROS adapters are not connected yet. Use the template.",
    );
  if (raw.length > 10000) throw new Error("Maximum 10,000 records per import.");
  const entries: Entry[] = [],
    errors: string[] = [],
    batch = `import-${new Date().toISOString()}`;
  raw.forEach((r, i) => {
    try {
      entries.push(validateEntry(r, batch));
    } catch (e) {
      errors.push(`Row ${i + 1}: ${(e as Error).message}`);
    }
  });
  let backup: State | undefined;
  if (!Array.isArray(input) && object.version === 1) {
    if (
      !Array.isArray(object.presets) ||
      !object.settings ||
      typeof object.settings !== "object"
    )
      throw new Error("Backup requires presets and settings.");
    const presets = object.presets.map((p) => {
      if (!p || typeof p.name !== "string" || !p.name.trim())
        throw new Error("Invalid meal preset.");
      return {
        id: crypto.randomUUID(),
        name: p.name.slice(0, 200),
        ...(p.calories !== undefined
          ? { calories: num(p.calories, "Preset calories") }
          : {}),
        ...(p.protein !== undefined
          ? { protein: num(p.protein, "Preset protein", 10000) }
          : {}),
      };
    });
    const settings: Settings = {};
    for (const f of ["calorieTarget", "tdee"] as const)
      if (object.settings[f] !== undefined)
        settings[f] = num(object.settings[f], f, 10000);
    // Retain provenance from backups, while validating every record before replacement.
    entries.forEach((e, i) => {
      const r = raw[i];
      if (typeof r.batch === "string") e.batch = r.batch;
    });
    backup = { version: 1, entries, presets, settings };
  }
  return { entries, errors, backup };
}
export function csvExport(entries: Entry[]) {
  const columns = [
    "kind",
    "date",
    "value",
    "unit",
    "name",
    "protein",
    "duration",
    "hr",
    "effort",
    "sessionType",
    "timestamp",
    "timezone",
    "source",
    "batch",
    "dedupKey",
  ];
  const quote = (v: unknown) =>
    '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return [
    columns.join(","),
    ...entries.map((e) =>
      columns.map((k) => quote(e[k as keyof Entry])).join(","),
    ),
  ].join("\n");
}
export function sampleState(): State {
  const s = emptyState(),
    today = londonDay();
  s.settings = { tdee: 2600 };
  for (let i = 20; i >= 0; i--) {
    const date = shiftDay(today, -i);
    s.entries.push(
      makeEntry("weight", date, 79.8 - i * 0.015 + Math.sin(i) * 0.2, {
        source: "Synthetic sample",
      }),
    );
    if (i % 3 === 0)
      s.entries.push(
        makeEntry("run", date, 8 + (i % 5), {
          duration: 46 + i,
          sessionType: "Easy",
          name: "Easy run",
          source: "Synthetic sample",
        }),
      );
  }
  for (const [name, value, protein] of [
    ["Sample breakfast", 420, 32],
    ["Sample lunch", 610, 46],
  ] as const)
    s.entries.push(
      makeEntry("meal", today, value, {
        name,
        protein,
        source: "Synthetic sample",
      }),
    );
  s.entries.push(
    makeEntry("steps", today, 6840, { source: "Synthetic sample" }),
    makeEntry("hydration", today, 1500, { source: "Synthetic sample" }),
  );
  return s;
}
