import { CLEAR_NIGHT_SKY, applyPlaceSky, followPlaceSky } from "@/gateways/weather-gateway.js";

export const meetingCity = {
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
  async decorate(skyElement, { meeting, weather, fadeIn }) {
    if (!weather) {
      applyPlaceSky(skyElement, CLEAR_NIGHT_SKY);
      return;
    }
    await followPlaceSky(skyElement, meeting, fadeIn);
  }
};
