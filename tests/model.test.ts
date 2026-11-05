import { describe, it, expect } from "vitest";
import {
  makeEntry,
  totals,
  rolling,
  weightChange,
  convert,
  londonDay,
  weekStart,
  mergeEntries,
  parseImport,
  csvExport,
  assessment,
  emptyState,
  validateEntry,
  pace,
} from "../src/model";
describe("nutrition and energy", () => {
  it("sums logged meals only for selected day", () => {
    const rows = [
      makeEntry("meal", "2026-06-01", 400, { protein: 30 }),
      makeEntry("meal", "2026-06-01", 650, { protein: 45 }),
      makeEntry("meal", "2026-06-02", 500, { protein: 25 }),
    ];
    expect(totals(rows, "2026-06-01")).toMatchObject({
      calories: 1050,
      protein: 75,
    });
  });
  it("reports unknown without meals and flags large estimated shortfalls", () => {
    expect(assessment([], "2026-06-01", {}).tone).toBe("unknown");
    expect(
      assessment(
        [makeEntry("meal", "2026-06-01", 800, { protein: 150 })],
        "2026-06-01",
        { tdee: 2600 },
      ).tone,
    ).toBe("red");
  });
  it("does not add exercise expenditure to a daily estimate", () => {
    const rows = [
      makeEntry("meal", "2026-06-01", 2300, { protein: 145 }),
      makeEntry("run", "2026-06-01", 20, { duration: 120 }),
    ];
    expect(assessment(rows, "2026-06-01", { tdee: 2600 }).tone).toBe("green");
  });
});
describe("weight trends and UK dates", () => {
  it("uses daily means and a calendar seven-day window", () => {
    const r = [
      makeEntry("weight", "2026-06-01", 80),
      makeEntry("weight", "2026-06-01", 82),
      makeEntry("weight", "2026-06-07", 79),
      makeEntry("weight", "2026-05-31", 100),
    ];
    expect(rolling(r, "2026-06-07")).toBe(80);
    expect(rolling(r, "2026-06-20")).toBeNull();
  });
  it("compares adjacent seven-day trends", () => {
    const r = [
      makeEntry("weight", "2026-06-01", 80),
      makeEntry("weight", "2026-06-08", 79.5),
    ];
    expect(weightChange(r, "2026-06-08")).toBe(-0.5);
    expect(weightChange(r, "2026-06-01")).toBeNull();
  });
  it("handles London summer time and DST transitions", () => {
    expect(londonDay(new Date("2026-06-01T23:30:00Z"))).toBe("2026-06-02");
    expect(londonDay(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-01");
    expect(londonDay(new Date("2026-03-29T23:30:00Z"))).toBe("2026-03-30");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });
});
describe("imports, backups and conversion", () => {
  it("converts imperial and hydration units", () => {
    expect(convert(10, "mi", "run")).toBeCloseTo(16.09344);
    expect(convert(180, "lb", "weight")).toBeCloseTo(81.6466);
    expect(convert(1.5, "l", "hydration")).toBe(1500);
    expect(() => convert(5, "oz", "weight")).toThrow();
  });
  it("deduplicates across sources and repeated imports", () => {
    const a = makeEntry("weight", "2026-06-01", 80);
    const b = { ...a, id: "second", source: "Health export" };
    expect(mergeEntries([a], [b, b])).toMatchObject({
      added: 0,
      duplicates: 2,
    });
  });
  it("rejects malformed dates, values, units, duration and protein", () => {
    for (const r of [
      { kind: "weight", date: "2026-02-30", value: 80 },
      { kind: "weight", date: "2026-01-01", value: -1 },
      { kind: "run", date: "2026-01-01", value: 5 },
      { kind: "meal", date: "2026-01-01", value: 400 },
      { kind: "weight", date: "2026-01-01", value: 80, timezone: "Bad/Zone" },
    ])
      expect(() => validateEntry(r, "test")).toThrow();
  });
  it("CSV round trips quotes, commas and provenance", () => {
    const a = makeEntry("meal", "2026-01-01", 400, {
      name: 'Rice, "chicken"',
      protein: 25,
    });
    const result = parseImport(csvExport([a]), "test.csv");
    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({
      name: a.name,
      protein: 25,
      value: 400,
      timestamp: a.timestamp,
    });
  });
  it("validates backup settings and preserves entries and presets", () => {
    const s = emptyState();
    s.entries = [makeEntry("weight", "2026-01-01", 80)];
    s.settings = { tdee: 2500 };
    const r = parseImport(JSON.stringify(s), "backup.json");
    expect(r.backup?.settings.tdee).toBe(2500);
    expect(r.backup?.entries[0].batch).toBe("manual");
    expect(() =>
      parseImport(JSON.stringify({ ...s, settings: { tdee: -1 } }), "b.json"),
    ).toThrow();
  });
  it("does not silently accept unrecognised native exports", () => {
    expect(() => parseImport('{"data":{"metrics":[]}}', "health.json")).toThrow(
      "Native Health",
    );
  });
  it("retains row errors for an all-or-nothing preview", () => {
    expect(
      parseImport(
        '[{"kind":"weight","date":"2026-01-01","value":80},{"kind":"bad"}]',
        "x.json",
      ).errors,
    ).toHaveLength(1);
  });
  it("formats pace without seconds overflowing", () => {
    expect(pace(10, 59.99)).toBe("6:00");
  });
});
