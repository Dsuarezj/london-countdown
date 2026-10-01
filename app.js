const LONDON_TIME_ZONE = "Europe/London";
const TARGET_MONTH_INDEX = 10;
const TARGET_DAY_OF_MONTH = 13;
const TARGET_HOUR = 22;
const JOURNEY_SEEN_KEY = "loa-journey-seen";
const KISS_INTERVAL_MS = 17000;
const KISS_DURATION_MS = 2600;

function zoneOffsetMinutes(timeZone, instantMs) {
  const wholeSeconds = Math.floor(instantMs / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(wholeSeconds));

  const field = {};
  for (const part of parts) {
    field[part.type] = part.value;
  }

  const readAsUtc = Date.UTC(
    Number(field.year),
    Number(field.month) - 1,
    Number(field.day),
    Number(field.hour),
    Number(field.minute),
    Number(field.second)
  );

  return (readAsUtc - wholeSeconds) / 60000;
}

function londonMeetingInstant(year) {
  const wallClockAsUtc = Date.UTC(year, TARGET_MONTH_INDEX, TARGET_DAY_OF_MONTH, TARGET_HOUR, 0, 0);
  let instantMs = wallClockAsUtc;
  for (let i = 0; i < 2; i += 1) {
    instantMs = wallClockAsUtc - zoneOffsetMinutes(LONDON_TIME_ZONE, instantMs) * 60000;
  }
  return instantMs;
}

function resolveMeetingInstant(nowMs) {
  const currentYear = new Date(nowMs).getUTCFullYear();
  const thisYearInstant = londonMeetingInstant(currentYear);
  return thisYearInstant > nowMs ? thisYearInstant : londonMeetingInstant(currentYear + 1);
}

function londonZoneAbbreviation(instantMs) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    timeZoneName: "short"
  }).formatToParts(new Date(instantMs));
  const zonePart = parts.find((part) => part.type === "timeZoneName");
  return zonePart ? zonePart.value.replace(/\+0$/, "") : "GMT";
}

function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

function splitRemaining(remainingMs) {
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60
  };
}

const daysField = document.getElementById("days");
const hoursField = document.getElementById("hours");
const minutesField = document.getElementById("minutes");
const secondsField = document.getElementById("seconds");
const reunionMessage = document.getElementById("reunion");
const countdownSection = document.querySelector(".countdown");
const zoneSuffix = document.querySelector(".headline__when span");
const localTimeField = document.getElementById("localTime");
const localZoneField = document.getElementById("localZone");
const offlineState = document.getElementById("offlineState");

const meetingInstant = resolveMeetingInstant(Date.now());

function renderCountdown() {
  const remainingMs = meetingInstant - Date.now();

  if (remainingMs <= 0) {
    countdownSection.hidden = true;
    reunionMessage.hidden = false;
    return;
  }

  const remaining = splitRemaining(remainingMs);
  daysField.textContent = String(remaining.days);
  hoursField.textContent = String(remaining.hours).padStart(2, "0");
  minutesField.textContent = String(remaining.minutes).padStart(2, "0");
  secondsField.textContent = String(remaining.seconds).padStart(2, "0");
}

function renderLocalEquivalent() {
  const localFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localOffset = -new Date(meetingInstant).getTimezoneOffset();

  zoneSuffix.textContent = londonZoneAbbreviation(meetingInstant);
  localTimeField.textContent = localFormatter.format(new Date(meetingInstant));
  localZoneField.textContent = `${localZone} · ${formatUtcOffset(localOffset)}`;
}

function startKisses() {
  setInterval(() => {
    document.body.classList.add("kissing");
    setTimeout(() => document.body.classList.remove("kissing"), KISS_DURATION_MS);
  }, KISS_INTERVAL_MS);
}

function settleTogether() {
  document.body.classList.remove("journey");
  document.body.classList.add("arrived");
  startKisses();
}

function playArrival() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alreadySeen = localStorage.getItem(JOURNEY_SEEN_KEY) === "true";

  if (prefersReducedMotion || alreadySeen) {
    settleTogether();
    return;
  }

  const journeySeconds = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--journey-duration"));
  document.body.classList.add("journey");
  localStorage.setItem(JOURNEY_SEEN_KEY, "true");
  setTimeout(settleTogether, journeySeconds * 1000);
}

async function isOriginReachable() {
  try {
    const response = await fetch(`manifest.webmanifest?ping=${Date.now()}`, { cache: "no-store" });
    return response.ok;
  } catch (networkError) {
    return false;
  }
}

async function renderConnectionState() {
  offlineState.hidden = await isOriginReachable();
}

renderCountdown();
renderLocalEquivalent();
renderConnectionState();
playArrival();

setInterval(renderCountdown, 1000);
window.addEventListener("online", renderConnectionState);
window.addEventListener("offline", renderConnectionState);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
