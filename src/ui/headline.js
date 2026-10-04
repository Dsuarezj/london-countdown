import { zoneAbbreviation } from "@/utils/meeting-time.js";
import { findActiveThreshold } from "@/utils/thresholds.js";

const kickerField = document.getElementById("kicker");
const thresholdField = document.getElementById("threshold");
const cityField = document.getElementById("city");
const meetingDateField = document.getElementById("meetingDate");
const meetingTimeField = document.getElementById("meetingTime");
const meetingZoneField = document.getElementById("meetingZone");

export function renderKicker({ kickers }, translator, dayNumber) {
  kickerField.textContent = translator.translate(kickers[dayNumber % kickers.length]);
}

export function renderThreshold({ thresholds }, translator, remainingMs) {
  const activeThreshold = findActiveThreshold(thresholds, remainingMs);
  if (!activeThreshold) {
    thresholdField.hidden = true;
    thresholdField.textContent = "";
    return;
  }
  thresholdField.textContent = translator.translate(activeThreshold.text);
  thresholdField.hidden = false;
}

export function renderMeetingLabel({ meeting }, translator, meetingInstant) {
  cityField.textContent = translator.translate(meeting.city);
  meetingDateField.textContent = new Intl.DateTimeFormat(translator.localeChain(), {
    timeZone: meeting.timeZone,
    day: "numeric",
    month: "long"
  }).format(new Date(meetingInstant));
  meetingTimeField.textContent = meeting.time;
  meetingZoneField.textContent = zoneAbbreviation(meeting.timeZone, meetingInstant);
}
