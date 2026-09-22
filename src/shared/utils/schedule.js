function toLocalDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

export function toDateKey(value) {
  const date = toLocalDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfMonth(value) {
  const date = toLocalDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function moveMonth(value, offset) {
  const date = startOfMonth(value);
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function monthLabel(value) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(startOfMonth(value));
}

export function weekdayToJsDay(weekday) {
  const numericWeekday = Number(weekday);
  return numericWeekday === 8 ? 0 : numericWeekday - 1;
}

export function scheduledDatesInMonth(section, semester, monthDate) {
  if (!section || !semester) {
    return [];
  }

  const monthStart = startOfMonth(monthDate);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const semesterStart = toLocalDate(semester.startDate);
  const semesterEnd = toLocalDate(semester.endDate);
  const from = monthStart > semesterStart ? monthStart : semesterStart;
  const to = monthEnd < semesterEnd ? monthEnd : semesterEnd;

  if (from > to) {
    return [];
  }

  const targetDay = weekdayToJsDay(section.weekday);
  const cursor = new Date(from.getTime());

  while (cursor.getDay() !== targetDay) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const dates = [];
  while (cursor <= to) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return dates;
}

export function buildMonthCells(monthDate) {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayIndex }, () => null);

  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}
