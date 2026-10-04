import { fetchPlaceSky } from "@/weather-gateway.js";

export const meetingCity = {
  stylesheet: "styles/backgrounds/meeting-city.css",
  markup: `
    <div class="daylight"></div>
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
    const meetingSky = await fetchPlaceSky(meeting);
    skyElement.dataset.phase = meetingSky.phase;
    skyElement.dataset.condition = meetingSky.condition;
  }
};
