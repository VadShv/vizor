// Демо-наборы данных для быстрого знакомства с сервисом

import { Dataset, profileColumns } from "./dataEngine";

// детерминированный генератор
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function salesDemo(): Dataset {
  const rnd = mulberry32(42);
  const regions = ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск", "Краснодар"];
  const categories = ["Электроника", "Одежда", "Дом и сад", "Красота", "Спорт"];
  const channels = ["Сайт", "Мобильное приложение", "Маркетплейс", "Розница"];
  const catBase: Record<string, number> = {
    Электроника: 18500,
    Одежда: 4200,
    "Дом и сад": 6800,
    Красота: 2900,
    Спорт: 5400,
  };
  const regionMult: Record<string, number> = {
    Москва: 1.8,
    "Санкт-Петербург": 1.4,
    Казань: 1.0,
    Екатеринбург: 1.1,
    Новосибирск: 0.9,
    Краснодар: 0.85,
  };

  const rows: Record<string, unknown>[] = [];
  const start = new Date(2025, 0, 5).getTime();
  for (let i = 0; i < 900; i++) {
    const dayOffset = Math.floor(rnd() * 590);
    const d = new Date(start + dayOffset * 86400000);
    const seasonal = 1 + 0.35 * Math.sin((d.getMonth() / 12) * Math.PI * 2 - 1.2);
    const growth = 1 + dayOffset / 900;
    const category = categories[Math.floor(rnd() * categories.length)];
    const region = regions[Math.floor(rnd() * regions.length)];
    const qty = 1 + Math.floor(rnd() * 5);
    const price = catBase[category] * (0.7 + rnd() * 0.6);
    rows.push({
      "Дата": `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      "Регион": region,
      "Категория": category,
      "Канал продаж": channels[Math.floor(rnd() * channels.length)],
      "Количество": qty,
      "Выручка": Math.round(price * qty * regionMult[region] * seasonal * growth),
      "Скидка %": Math.round(rnd() * 25),
    });
  }
  return { name: "Продажи (демо).csv", rows, columns: profileColumns(rows) };
}

export function hrDemo(): Dataset {
  const rnd = mulberry32(7);
  const depts = ["Разработка", "Продажи", "Маркетинг", "Поддержка", "Финансы", "HR"];
  const cities = ["Москва", "Санкт-Петербург", "Удалённо"];
  const grades = ["Junior", "Middle", "Senior", "Lead"];
  const gradeSalary: Record<string, number> = { Junior: 90, Middle: 175, Senior: 280, Lead: 380 };
  const deptMult: Record<string, number> = {
    Разработка: 1.35,
    Продажи: 1.0,
    Маркетинг: 0.95,
    Поддержка: 0.7,
    Финансы: 1.05,
    HR: 0.8,
  };
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 250; i++) {
    const dept = depts[Math.floor(rnd() * depts.length)];
    const grade = grades[Math.floor(rnd() * grades.length)];
    const exp = Math.round(rnd() * 12 * 10) / 10;
    const salary = Math.round(gradeSalary[grade] * deptMult[dept] * (0.85 + rnd() * 0.3 + exp * 0.015));
    const y = 2019 + Math.floor(rnd() * 7);
    const m = 1 + Math.floor(rnd() * 12);
    rows.push({
      "Отдел": dept,
      "Грейд": grade,
      "Город": cities[Math.floor(rnd() * cities.length)],
      "Стаж, лет": exp,
      "Зарплата, тыс ₽": salary,
      "Оценка (1–5)": Math.min(5, Math.max(1, Math.round((2.5 + rnd() * 2.5 + exp * 0.05) * 10) / 10)),
      "Дата найма": `${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`,
    });
  }
  return { name: "Сотрудники (демо).csv", rows, columns: profileColumns(rows) };
}
