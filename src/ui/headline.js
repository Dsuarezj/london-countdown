import { zoneAbbreviation } from "@/utils/meeting-time.js";
import { findActiveThreshold } from "@/utils/thresholds.js";

const kickerField = document.getElementById("kicker");
const cityField = document.getElementById("city");
const meetingDateField = document.getElementById("meetingDate");
const meetingTimeField = document.getElementById("meetingTime");
const meetingZoneField = document.getElementById("meetingZone");

export function renderKicker({ kickers, thresholds }, translator, remainingMs, dayNumber) {
  const activeThreshold = findActiveThreshold(thresholds, remainingMs);
  const kickerKey = activeThreshold ? activeThreshold.text : kickers[dayNumber % kickers.length];
  kickerField.textContent = translator.translate(kickerKey);
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
