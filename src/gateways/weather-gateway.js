import { SkyCondition, SkyPhase } from "@/utils/enums.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const THUNDERSTORM_CODES = [95, 96, 99];

const CONDITIONS_BY_WEATHER_CODE = [
  { condition: SkyCondition.SNOW, weatherCodes: [71, 73, 75, 77, 85, 86] },
  { condition: SkyCondition.RAIN, weatherCodes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, ...THUNDERSTORM_CODES] },
  { condition: SkyCondition.OVERCAST, weatherCodes: [3, 45, 48] },
  { condition: SkyCondition.PARTLY, weatherCodes: [2] },
  { condition: SkyCondition.CLEAR, weatherCodes: [0, 1] }
];

function conditionFromWeatherCode(weatherCode) {
  const match = CONDITIONS_BY_WEATHER_CODE.find((entry) => entry.weatherCodes.includes(weatherCode));
  return match ? match.condition : SkyCondition.CLEAR;
}

export async function requestPlaceSky({ latitude, longitude }) {
  const response = await fetch(`${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=weather_code,rain,showers,snowfall,is_day`);
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  const { current } = await response.json();
  return {
    phase: current.is_day ? SkyPhase.DAY : SkyPhase.NIGHT,
    condition: conditionFromWeatherCode(current.weather_code),
    rain: current.rain + current.showers,
    snowfall: current.snowfall,
    thunder: THUNDERSTORM_CODES.includes(current.weather_code)
  };
}
