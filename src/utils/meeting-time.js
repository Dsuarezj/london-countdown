export const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

function zonedParts(timeZone, instantMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(instantMs));

  const field = {};
  for (const part of parts) {
    field[part.type] = Number(part.value);
  }
  return field;
}

function zoneOffsetMinutes(timeZone, instantMs) {
  const wholeSeconds = Math.floor(instantMs / 1000) * 1000;
  const field = zonedParts(timeZone, wholeSeconds);
  const readAsUtc = Date.UTC(field.year, field.month - 1, field.day, field.hour, field.minute, field.second);
  return (readAsUtc - wholeSeconds) / 60000;
}

export function wallClockToInstant(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let instantMs = wallClockAsUtc;
  for (let i = 0; i < 2; i += 1) {
    instantMs = wallClockAsUtc - zoneOffsetMinutes(timeZone, instantMs) * 60000;
  }
  return instantMs;
}

export function zoneAbbreviation(timeZone, instantMs) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(new Date(instantMs));
  const zonePart = parts.find((part) => part.type === "timeZoneName");
  return zonePart ? zonePart.value.replace(/\+0$/, "") : "";
}

export function calendarDayNumber(instantMs, timeZone) {
  const field = zonedParts(timeZone, instantMs);
  return Date.UTC(field.year, field.month - 1, field.day) / DAY_MS;
}

export function zonedHour(instantMs, timeZone) {
  return zonedParts(timeZone, instantMs).hour;
}

export function splitRemaining(remainingMs) {
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60
  };
}
