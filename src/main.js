import { mountBackground, selectBackgroundId } from "@/backgrounds/index.js";
import { mountCharacters, renderCharacterLabels } from "@/characters.js";
import { applyThemeTokens, loadConfig } from "@/config.js";
import { watchConnection } from "@/connection.js";
import { renderCountdown } from "@/countdown.js";
import { renderKicker, renderMeetingLabel } from "@/headline.js";
import { createTranslator } from "@/i18n.js";
import { createInfoCard } from "@/info-card.js";
import { prepareInstallPrompt } from "@/install-prompt.js";
import { playMeeting } from "@/meeting.js";
import { calendarDayNumber, wallClockToInstant } from "@/meeting-time.js";
import { mountOriginPins, renderOriginPins } from "@/origin-pins.js";
import { loadStylesheet } from "@/stylesheet.js";

const skyElement = document.getElementById("sky");
const meetingElement = document.getElementById("meeting");
const languageButton = document.getElementById("languageButton");
const languageCodeField = document.getElementById("languageCode");

const offerInstall = prepareInstallPrompt();
const config = await loadConfig();
const translator = await createTranslator(config.languages);
const { meeting } = config;
const meetingInstant = wallClockToInstant(meeting.date, meeting.time, meeting.timeZone);
const infoCard = createInfoCard(config, translator);

function remainingMs() {
  return meetingInstant - Date.now();
}

function todayNumber() {
  return calendarDayNumber(Date.now(), meeting.timeZone);
}

function renderTick() {
  renderCountdown(remainingMs());
  renderKicker(config, translator, remainingMs(), todayNumber());
}

function renderLanguage() {
  translator.renderStaticStrings();
  languageCodeField.textContent = translator.language().toUpperCase();
  renderMeetingLabel(config, translator, meetingInstant);
  renderOriginPins(config.origins, translator);
  renderCharacterLabels(meetingElement, config.characters, translator);
  infoCard.render();
  renderTick();
}

applyThemeTokens(config.theme.tokens);
renderLanguage();
setInterval(renderTick, 1000);
watchConnection();

languageButton.addEventListener("click", () => {
  translator.cycleLanguage();
  renderLanguage();
});
mountOriginPins(infoCard.open);

const backgroundId = selectBackgroundId(config.backgrounds, {
  remainingMs: remainingMs(),
  isMeetingDay: todayNumber() === calendarDayNumber(meetingInstant, meeting.timeZone),
  dayNumber: todayNumber()
});

await Promise.all([
  mountBackground(skyElement, backgroundId, { origins: config.origins, meeting }),
  mountCharacters(meetingElement, config),
  loadStylesheet(config.affection.stylesheet)
]);
renderCharacterLabels(meetingElement, config.characters, translator);
playMeeting(meetingElement, config.affection, offerInstall);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
