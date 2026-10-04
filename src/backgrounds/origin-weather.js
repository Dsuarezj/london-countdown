import { cachedPlaceSky, fetchPlaceSky } from "@/gateways/weather-gateway.js";

function hemisphereMarkup(slot) {
  return `
    <div class="hemisphere hemisphere--${slot}">
      <div class="daylight"></div>
      <div class="overcast"></div>
      <div class="aurora-field">
        <div class="aurora aurora--one"></div>
        <div class="aurora aurora--two"></div>
        <div class="aurora aurora--three"></div>
      </div>
      <div class="stars"></div>
      <div class="veil"></div>
      <div class="precipitation"></div>
    </div>
  `;
}

function applySky(hemisphere, { phase, condition }) {
  hemisphere.dataset.phase = phase;
  hemisphere.dataset.condition = condition;
}

export const originWeather = {
  stylesheet: "styles/backgrounds/origin-weather.css",
  markup: `${hemisphereMarkup("north")}${hemisphereMarkup("south")}`,
  async decorate(skyElement, { origins }) {
    await Promise.all(Object.entries(origins).map(async ([slot, origin]) => {
      const hemisphere = skyElement.querySelector(`.hemisphere--${slot}`);
      hemisphere.dataset.nightSky = origin.nightSky;
      applySky(hemisphere, cachedPlaceSky(origin));
      applySky(hemisphere, await fetchPlaceSky(origin));
    }));
  }
};
