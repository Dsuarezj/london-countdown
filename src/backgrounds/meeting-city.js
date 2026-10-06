import { WEATHER_BASE_LAYERS, WEATHER_CLOUD_LAYERS, followWeather } from "@/backgrounds/weather-scene.js";

export const meetingCity = {
  markup: `
    <div class="weather">
      ${WEATHER_BASE_LAYERS}
      <div class="stars"></div>
      <div class="confluence">
        <div class="confluence__current confluence__current--north"></div>
        <div class="confluence__current confluence__current--south"></div>
      </div>
      ${WEATHER_CLOUD_LAYERS}
      <div class="city-glow"></div>
      <div class="city-lights"></div>
    </div>
  `,
  decorate(skyElement, { meeting, weatherEnabled, fadeIn }) {
    return followWeather(skyElement.querySelector(".weather"), meeting, { enabled: weatherEnabled, fadeIn });
  }
};
