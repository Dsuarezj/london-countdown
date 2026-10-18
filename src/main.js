import { createSky } from "@/backgrounds/index.js";
import { applyThemeTokens, loadConfig, readCachedConfig } from "@/services/config.js";
import { watchConnection } from "@/services/connection.js";
import { createTranslator } from "@/services/i18n.js";
import { mountCharacters, renderCharacterLabels } from "@/ui/characters.js";
import { renderCountdown } from "@/ui/countdown.js";
import { renderKicker, renderMeetingLabel, renderThreshold } from "@/ui/headline.js";
import { createInfoCard } from "@/ui/info-card.js";
import { prepareInstallPrompt } from "@/ui/install-prompt.js";
import { playMeeting } from "@/ui/meeting.js";
import { mountOriginPins, renderOriginPins } from "@/ui/origin-pins.js";
import { createTogetherPlayer } from "@/ui/together.js";
import { calendarDayNumber } from "@/utils/meeting-time.js";
import { TripPhase } from "@/utils/enums.js";
import { createTripTimeline } from "@/utils/trip-timeline.js";
import { loadStylesheet } from "@/utils/stylesheet.js";

const skyElement = document.getElementById("sky");
const meetingElement = document.getElementById("meeting");
const languageButton = document.getElementById("languageButton");
const languageCodeField = document.getElementById("languageCode");
const showSky = createSky(skyElement);

const cachedConfig = readCachedConfig();
if (cachedConfig) {
  applyThemeTokens(cachedConfig.theme.tokens);
  showSky(cachedConfig, { fadeIn: false });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
}

const offerInstall = prepareInstallPrompt();
const config = await loadConfig();
applyThemeTokens(config.theme.tokens);
showSky(config, { fadeIn: true });
const { meeting } = config;
const timeline = createTripTimeline(config);
const { meetingInstant, endInstant } = timeline;
document.body.dataset.tripPhase = timeline.phaseAt(Date.now());
renderCountdown(meetingInstant - Date.now());
const translator = await createTranslator(config.languages);
const infoCard = createInfoCard(config, translator);

const togetherPlayer = createTogetherPlayer(config.together);
let meetingPlayer;

function remainingMs() {
  return meetingInstant - Date.now();
}

function todayNumber() {
  return calendarDayNumber(Date.now(), meeting.timeZone);
}

function renderTick() {
  const phase = timeline.phaseAt(Date.now());
  const phaseChanged = document.body.dataset.tripPhase !== phase;
  document.body.dataset.tripPhase = phase;
  const remaining = remainingMs();
  renderCountdown(remaining);
  renderKicker(config, translator, todayNumber(), phase);
  if (phase === TripPhase.UPCOMING) {
    renderThreshold(config, translator, remaining);
  }
  if (phaseChanged) {
    renderMeetingLabel(config, translator, meetingInstant, phase, endInstant);
    renderCharacterLabels(meetingElement, config.characters, translator, phase);
    infoCard.render();
  }
  meetingPlayer?.setPhase(phase);
  if (phase === TripPhase.TOGETHER) {
    togetherPlayer.playWhenReady(remaining);
  } else if (phase === TripPhase.MEMORIES) {
    togetherPlayer.stop();
  }
  showSky(config, { fadeIn: true });
}

function renderLanguage() {
  translator.renderStaticStrings();
  languageCodeField.textContent = translator.language().toUpperCase();
  const phase = timeline.phaseAt(Date.now());
  renderMeetingLabel(config, translator, meetingInstant, phase, endInstant);
  renderOriginPins(config.origins, translator);
  renderCharacterLabels(meetingElement, config.characters, translator, phase);
  infoCard.render();
  renderTick();
}

renderLanguage();
setInterval(renderTick, 1000);
watchConnection();

languageButton.addEventListener("click", () => {
  translator.cycleLanguage();
  renderLanguage();
});
mountOriginPins(infoCard.open);

await Promise.all([
  mountCharacters(meetingElement, config),
  loadStylesheet(config.affection.stylesheet)
]);
renderCharacterLabels(meetingElement, config.characters, translator, timeline.phaseAt(Date.now()));
meetingPlayer = playMeeting(meetingElement, config.affection, () => {
  togetherPlayer.markArrived();
  if (timeline.phaseAt(Date.now()) === TripPhase.TOGETHER) {
    togetherPlayer.playWhenReady(remainingMs());
  }
  offerInstall();
}, timeline.phaseAt(Date.now()));
