import { describe, it, expect } from "vitest";
import {
  toNumber,
  toDate,
  profileColumns,
  groupBy,
  timeSeries,
  histogram,
  correlation,
  scatterData,
  formatNumber,
  type Dataset,
} from "./dataEngine";
import { salesDemo, hrDemo } from "./demoData";

// ---------- toNumber ----------

describe("toNumber", () => {
  it("парсит целые и дробные", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.14")).toBe(3.14);
    expect(toNumber(-5)).toBe(-5);
  });

  it("парсит русские форматы с запятой", () => {
    expect(toNumber("1,5")).toBe(1.5);
    expect(toNumber("1234,56")).toBe(1234.56);
    expect(toNumber("0,5")).toBe(0.5);
  });

  it("парсит разделитель тысяч (несколько запятых)", () => {
    expect(toNumber("1,234,567")).toBe(1234567);
  });

  it("одиночная запятая — десятичная (русская локаль)", () => {
    expect(toNumber("1,000")).toBe(1.0);
    expect(toNumber("1,5")).toBe(1.5);
  });

  it("парсит валютные символы", () => {
    expect(toNumber("₽1234")).toBe(1234);
    expect(toNumber("$99.99")).toBe(99.99);
    expect(toNumber("1 234 ₽")).toBe(1234);
    expect(toNumber("50 €")).toBe(50);
  });

  it("парсит проценты", () => {
    expect(toNumber("45%")).toBe(45);
    expect(toNumber("12,5%")).toBe(12.5);
  });

  it("смешанные разделители: последний — десятичный", () => {
    expect(toNumber("1.234,56")).toBe(1234.56);
    expect(toNumber("1,234.56")).toBe(1234.56);
  });

  it("возвращает null для не-чисел", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(NaN)).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });

  it("не парсит даты как числа", () => {
    expect(toNumber(new Date())).toBeNull();
  });
});

// ---------- toDate ----------

describe("toDate", () => {
  it("парсит ISO", () => {
    const d = toDate("2025-03-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(15);
  });

  it("парсит DMY (русский формат)", () => {
    const d = toDate("15.03.2025");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getFullYear()).toBe(2025);
  });

  it("парсит DMY с дефисом", () => {
    const d = toDate("15-03-2025");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(2);
  });

  it("двузначные годы", () => {
    expect(toDate("15.03.25")!.getFullYear()).toBe(2025);
    expect(toDate("15.03.99")!.getFullYear()).toBe(1999);
  });

  it("возвращает null для не-дат", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate("not a date")).toBeNull();
    expect(toDate(42)).toBeNull();
  });
});

// ---------- profileColumns ----------

describe("profileColumns", () => {
  it("определяет типы колонок", () => {
    const rows = [
      { name: "A", age: 30, city: "Москва", joined: "2020-01-15" },
      { name: "B", age: 25, city: "Казань", joined: "2021-03-20" },
      { name: "C", age: 35, city: "Москва", joined: "2022-06-10" },
    ];
    const cols = profileColumns(rows);
    expect(cols).toHaveLength(4);
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(byName.age.type).toBe("numeric");
    expect(byName.city.type).toBe("categorical");
    expect(byName.joined.type).toBe("date");
  });

  it("считает numeric-статистики", () => {
    const rows = [{ x: 10 }, { x: 20 }, { x: 30 }];
    const [col] = profileColumns(rows);
    expect(col.min).toBe(10);
    expect(col.max).toBe(30);
    expect(col.sum).toBe(60);
    expect(col.mean).toBe(20);
    expect(col.median).toBe(20);
  });

  it("считает пропуски", () => {
    const rows = [{ x: 1 }, { x: "" }, { x: null }, { x: 3 }];
    const [col] = profileColumns(rows);
    expect(col.missingCount).toBe(2);
  });

  it("детектит ID-колонки", () => {
    const rows = [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }];
    const cols = profileColumns(rows);
    expect(cols[0].isId).toBe(true);
  });
});

// ---------- groupBy ----------

describe("groupBy", () => {
  const rows = [
    { cat: "A", val: 10 },
    { cat: "B", val: 20 },
    { cat: "A", val: 30 },
    { cat: "C", val: 5 },
  ];

  it("группирует и суммирует", () => {
    const result = groupBy(rows, "cat", "val", "sum");
    const a = result.find((r) => r.label === "A");
    expect(a?.value).toBe(40);
  });

  it("сортирует по убыванию", () => {
    const result = groupBy(rows, "cat", "val", "sum");
    expect(result[0].label).toBe("A");
    expect(result[0].value).toBe(40);
  });

  it("свёртка «Прочее» при >topN", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ cat: `C${i}`, val: i }));
    const result = groupBy(many, "cat", "val", "sum", 5);
    expect(result).toHaveLength(5);
    expect(result[result.length - 1].label).toBe("Прочее");
  });

  it("count без метрики", () => {
    const result = groupBy(rows, "cat", null, "count");
    const a = result.find((r) => r.label === "A");
    expect(a?.value).toBe(2);
  });
});

// ---------- timeSeries ----------

describe("timeSeries", () => {
  it("авто-крупность day для короткого периода", () => {
    const rows = [
      { d: "2025-01-01", v: 1 },
      { d: "2025-01-02", v: 2 },
      { d: "2025-01-03", v: 3 },
    ];
    const { data, grain } = timeSeries(rows, "d", "v", "sum");
    expect(grain).toBe("day");
    expect(data).toHaveLength(3);
  });

  it("авто-крупность year для длинного периода", () => {
    const rows = [
      { d: "2015-01-01", v: 1 },
      { d: "2020-06-01", v: 2 },
      { d: "2025-12-01", v: 3 },
    ];
    const { grain } = timeSeries(rows, "d", "v", "sum");
    expect(grain).toBe("year");
  });
});

// ---------- correlation ----------

describe("correlation", () => {
  it("прямая связь r ≈ 1", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2 }));
    const r = correlation(rows, "x", "y");
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1, 1);
  });

  it("обратная связь r ≈ -1", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ x: i, y: -i * 2 }));
    const r = correlation(rows, "x", "y");
    expect(r!).toBeCloseTo(-1, 1);
  });

  it("null при <5 точек", () => {
    const rows = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(correlation(rows, "x", "y")).toBeNull();
  });
});

// ---------- histogram ----------

describe("histogram", () => {
  it("строит бины", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ x: i }));
    const bins = histogram(rows, "x", 10);
    expect(bins).toHaveLength(10);
    const total = bins.reduce((a, b) => a + b.value, 0);
    expect(total).toBe(100);
  });

  it("пустой массив при <2 значений", () => {
    expect(histogram([{ x: 1 }], "x")).toEqual([]);
  });
});

// ---------- scatterData ----------

describe("scatterData", () => {
  it("даунсэмплинг до maxPoints", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2 }));
    const pts = scatterData(rows, "x", "y", 100);
    expect(pts.length).toBeLessThanOrEqual(100);
  });
});

// ---------- formatNumber ----------

describe("formatNumber", () => {
  it("тысячи", () => {
    expect(formatNumber(15000)).toContain("тыс");
  });
  it("миллионы", () => {
    expect(formatNumber(1500000)).toContain("млн");
  });
  it("миллиарды", () => {
    expect(formatNumber(1500000000)).toContain("млрд");
  });
  it("небольшие числа", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(3.14)).toBe("3,14");
  });
});

// ---------- demoData (детерминированность) ----------

describe("demoData", () => {
  it("salesDemo детерминирован", () => {
    const a = salesDemo();
    const b = salesDemo();
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);
    expect(a.rows.length).toBe(900);
  });

  it("hrDemo детерминирован", () => {
    const a = hrDemo();
    const b = hrDemo();
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);
    expect(a.rows.length).toBe(250);
  });

  it("demo-наборы имеют колонки", () => {
    expect(salesDemo().columns.length).toBeGreaterThan(0);
    expect(hrDemo().columns.length).toBeGreaterThan(0);
  });
});
