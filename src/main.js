import { mountBackground, selectBackgroundId } from "@/backgrounds/index.js";
import { applyThemeTokens, loadConfig } from "@/services/config.js";
import { watchConnection } from "@/services/connection.js";
import { createTranslator } from "@/services/i18n.js";
import { mountCharacters, renderCharacterLabels } from "@/ui/characters.js";
import { renderCountdown } from "@/ui/countdown.js";
import { renderKicker, renderMeetingLabel } from "@/ui/headline.js";
import { createInfoCard } from "@/ui/info-card.js";
import { prepareInstallPrompt } from "@/ui/install-prompt.js";
import { playMeeting } from "@/ui/meeting.js";
import { mountOriginPins, renderOriginPins } from "@/ui/origin-pins.js";
import { calendarDayNumber, wallClockToInstant } from "@/utils/meeting-time.js";
import { loadStylesheet } from "@/utils/stylesheet.js";

const skyElement = document.getElementById("sky");
const meetingElement = document.getElementById("meeting");
const languageButton = document.getElementById("languageButton");
const languageCodeField = document.getElementById("languageCode");
const splashElement = document.getElementById("splash");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
}

const offerInstall = prepareInstallPrompt();
const config = await loadConfig();
const { meeting } = config;
const meetingInstant = wallClockToInstant(meeting.date, meeting.time, meeting.timeZone);
renderCountdown(meetingInstant - Date.now());
const translator = await createTranslator(config.languages);
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
splashElement.dataset.dismissed = "true";
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
