const LONDON_TIME_ZONE = "Europe/London";
const TARGET_MONTH_INDEX = 10;
const TARGET_DAY_OF_MONTH = 13;
const TARGET_HOUR = 22;
const LANGUAGE_KEY = "loa-language";
const AFFECTION_BEATS = ["kissing", "nestling", "circling", "swaying"];
const BEAT_INTERVAL_MS = 17000;
const BEAT_DURATION_MS = 2600;

const TRANSLATIONS = {
  en: {
    locale: "en-GB",
    kicker: "Halfway point",
    city: "London",
    north: "Iceland",
    south: "Ecuador",
    days: "days",
    hours: "hours",
    minutes: "min",
    seconds: "sec",
    localIntro: "In your time zone that is",
    reunion: "You are both here.",
    countdownLabel: "Time left until the meeting",
    offline: "Offline · showing your saved version",
    language: "Change language",
    plover: "Lóa, a golden plover flying in from Iceland",
    hummingbird: "A hummingbird hopping up from Ecuador"
  },
  es: {
    locale: "es-ES",
    kicker: "Punto medio",
    city: "Londres",
    north: "Islandia",
    south: "Ecuador",
    days: "días",
    hours: "horas",
    minutes: "min",
    seconds: "seg",
    localIntro: "En tu zona horaria es",
    reunion: "Ya están las dos aquí.",
    countdownLabel: "Tiempo que falta para el encuentro",
    offline: "Sin conexión · mostrando tu versión guardada",
    language: "Cambiar idioma",
    plover: "Lóa, un chorlito dorado que llega volando desde Islandia",
    hummingbird: "Un colibrí que llega a saltos desde Ecuador"
  },
  is: {
    locale: "is-IS",
    kicker: "Miðpunktur",
    city: "London",
    north: "Ísland",
    south: "Ekvador",
    days: "dagar",
    hours: "klst",
    minutes: "mín",
    seconds: "sek",
    localIntro: "Á þínu tímasvæði er það",
    reunion: "Þið eruð báðar hér.",
    countdownLabel: "Tíminn sem er eftir fram að endurfundunum",
    offline: "Ótengt · sýnir vistaða útgáfu",
    language: "Breyta tungumáli",
    plover: "Lóa sem flýgur frá Íslandi",
    hummingbird: "Kolibrífugl sem hoppar norður frá Ekvador"
  }
};

const FALLBACK_LANGUAGE = "en";

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
const meetingDateField = document.getElementById("meetingDate");
const londonZoneField = document.getElementById("londonZone");
const localTimeField = document.getElementById("localTime");
const localZoneField = document.getElementById("localZone");
const offlineMark = document.getElementById("offlineMark");
const languageButton = document.getElementById("languageButton");
const languageCodeField = document.getElementById("languageCode");

const meetingInstant = resolveMeetingInstant(Date.now());
const languageOrder = Object.keys(TRANSLATIONS);
let activeLanguage = resolveInitialLanguage();

function resolveInitialLanguage() {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored && TRANSLATIONS[stored]) {
    return stored;
  }
  const deviceLanguages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const tag of deviceLanguages) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (TRANSLATIONS[base]) {
      return base;
    }
  }
  return FALLBACK_LANGUAGE;
}

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

function renderLanguage() {
  const strings = TRANSLATIONS[activeLanguage];

  document.documentElement.lang = activeLanguage;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = strings[element.dataset.i18n];
  }
  for (const element of document.querySelectorAll("[data-i18n-aria]")) {
    element.setAttribute("aria-label", strings[element.dataset.i18nAria]);
  }

  languageCodeField.textContent = activeLanguage.toUpperCase();
  languageButton.setAttribute("aria-label", strings.language);
  languageButton.title = strings.language;
  offlineMark.setAttribute("aria-label", strings.offline);
  offlineMark.title = strings.offline;

  renderMeetingTimes();
}

function renderMeetingTimes() {
  const localeChain = [TRANSLATIONS[activeLanguage].locale, TRANSLATIONS[FALLBACK_LANGUAGE].locale];
  const meetingDate = new Date(meetingInstant);
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localOffset = -meetingDate.getTimezoneOffset();

  meetingDateField.textContent = new Intl.DateTimeFormat(localeChain, {
    timeZone: LONDON_TIME_ZONE,
    day: "numeric",
    month: "long"
  }).format(meetingDate);

  londonZoneField.textContent = londonZoneAbbreviation(meetingInstant);

  localTimeField.textContent = new Intl.DateTimeFormat(localeChain, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(meetingDate);

  localZoneField.textContent = `${localZone} · ${formatUtcOffset(localOffset)}`;
}

function cycleLanguage() {
  const nextIndex = (languageOrder.indexOf(activeLanguage) + 1) % languageOrder.length;
  activeLanguage = languageOrder[nextIndex];
  localStorage.setItem(LANGUAGE_KEY, activeLanguage);
  renderLanguage();
}

function playRandomAffection() {
  const beatName = AFFECTION_BEATS[Math.floor(Math.random() * AFFECTION_BEATS.length)];
  document.body.classList.add(beatName);
  setTimeout(() => document.body.classList.remove(beatName), BEAT_DURATION_MS);
}

function startAffectionBeats() {
  setInterval(playRandomAffection, BEAT_INTERVAL_MS);
}

function settleTogether() {
  document.body.classList.remove("journey");
  document.body.classList.add("arrived");
  startAffectionBeats();
}

function playArrival() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    settleTogether();
    return;
  }

  const journeySeconds = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--journey-duration"));
  document.body.classList.add("journey");
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
  offlineMark.hidden = await isOriginReachable();
}

renderLanguage();
renderCountdown();
renderConnectionState();
playArrival();

languageButton.addEventListener("click", cycleLanguage);
setInterval(renderCountdown, 1000);
window.addEventListener("online", renderConnectionState);
window.addEventListener("offline", renderConnectionState);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
