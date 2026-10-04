import { cachedPlaceSky, fetchPlaceSky } from "@/gateways/weather-gateway.js";

function applySky(skyElement, { phase, condition }) {
  skyElement.dataset.phase = phase;
  skyElement.dataset.condition = condition;
}

export const meetingCity = {
  stylesheet: "styles/backgrounds/meeting-city.css",
  markup: `
    <div class="daylight"></div>
    <div class="overcast"></div>
    <div class="stars"></div>
    <div class="confluence">
      <div class="confluence__current confluence__current--north"></div>
      <div class="confluence__current confluence__current--south"></div>
    </div>
    <div class="veil"></div>
    <div class="precipitation"></div>
    <div class="city-glow"></div>
    <div class="city-lights"></div>
  `,
  async decorate(skyElement, { meeting }) {
    applySky(skyElement, cachedPlaceSky(meeting));
    applySky(skyElement, await fetchPlaceSky(meeting));
  }
};
