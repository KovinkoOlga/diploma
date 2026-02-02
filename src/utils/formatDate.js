export function formatLongRuDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(date);
  } catch {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}.${m}`;
  }
}

export function formatShortRuDay(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date);
  } catch {
    return "дн";
  }
}

export function formatDayNumber(date = new Date()) {
  return String(date.getDate());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toISODate(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

