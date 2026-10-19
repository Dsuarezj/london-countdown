import { SkyPhase } from "@/utils/enums.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const THUNDERSTORM_CODES = [95, 96, 97, 99];
// WMO rain intensity lower bounds (mm/h): the 15-minute sample can under-report what the code classifies.
const MIN_RAIN_MM_PER_HOUR_BY_CODE = { 63: 2.5, 65: 7.6, 81: 2.5, 82: 7.6 };
const WEATHER_DEBUG = new URLSearchParams(globalThis.location?.search).has("weatherDebug");

export async function requestPlaceSky({ latitude, longitude }) {
  const response = await fetch(`${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=weather_code,cloud_cover,rain,showers,snowfall,is_day&precipitation_unit=mm`);
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  const { current, current_units: units } = await response.json();
  if (WEATHER_DEBUG) {
    console.groupCollapsed(`[weather] API ${latitude},${longitude}`);
    console.table(Object.entries(current ?? {}).map(([variable, value]) => ({
      variable, value, unit: units?.[variable]
    })));
    console.groupEnd();
  }
  if (units?.cloud_cover !== "%" || units?.rain !== "mm" || units?.showers !== "mm"
    || units?.snowfall !== "cm" || units?.interval !== "seconds") {
    throw new Error("Unexpected weather units; expected %, mm, cm and seconds");
  }
  if (!current || ![current.cloud_cover, current.rain, current.showers, current.snowfall]
    .every((value) => Number.isFinite(value) && value >= 0)
    || current.cloud_cover > 100 || !Number.isFinite(current.interval) || current.interval <= 0
    || ![0, 1].includes(current.is_day) || !Number.isInteger(current.weather_code)) {
    throw new Error("Invalid current weather values");
  }
  const intervalsPerHour = 3600 / current.interval;
  return {
    phase: current.is_day ? SkyPhase.DAY : SkyPhase.NIGHT,
    cloudCoverPct: current.cloud_cover,
    rainMmPerHour: Math.max((current.rain + current.showers) * intervalsPerHour, MIN_RAIN_MM_PER_HOUR_BY_CODE[current.weather_code] ?? 0),
    snowfallCmPerHour: current.snowfall * intervalsPerHour,
    thunder: THUNDERSTORM_CODES.includes(current.weather_code)
  };
}
