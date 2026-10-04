import { CLEAR_NIGHT_SKY, applyPlaceSky, followPlaceSky } from "@/gateways/weather-gateway.js";

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

export const originWeather = {
  markup: `${hemisphereMarkup("north")}${hemisphereMarkup("south")}`,
  async decorate(skyElement, { origins, weather, fadeIn }) {
    await Promise.all(Object.entries(origins).map(async ([slot, origin]) => {
      const hemisphere = skyElement.querySelector(`.hemisphere--${slot}`);
      hemisphere.dataset.nightSky = origin.nightSky;
      if (!weather) {
        applyPlaceSky(hemisphere, CLEAR_NIGHT_SKY);
        return;
      }
      await followPlaceSky(hemisphere, origin, fadeIn);
    }));
  }
};
