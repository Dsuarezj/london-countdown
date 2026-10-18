export function weatherResponse(current = {}, units = {}) {
  return {
    current_units: {
      time: "iso8601",
      interval: "seconds",
      weather_code: "wmo code",
      cloud_cover: "%",
      rain: "mm",
      showers: "mm",
      snowfall: "cm",
      is_day: "",
      ...units
    },
    current: {
      time: "2026-10-18T09:15",
      interval: 900,
      weather_code: 0,
      cloud_cover: 0,
      rain: 0,
      showers: 0,
      snowfall: 0,
      is_day: 1,
      ...current
    }
  };
}
