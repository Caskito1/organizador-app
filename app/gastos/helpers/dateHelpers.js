// gastos/helpers/dateHelpers.js

export function getMonthRange(date) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );

  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  return { start, end };
}