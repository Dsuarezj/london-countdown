import { zoneAbbreviation } from "@/utils/meeting-time.js";
import { findActiveThreshold } from "@/utils/thresholds.js";
import { TripPhase } from "@/utils/enums.js";

const kickerField = document.getElementById("kicker");
const thresholdField = document.getElementById("threshold");
const cityField = document.getElementById("city");
const meetingDateField = document.getElementById("meetingDate");
const meetingTimeField = document.getElementById("meetingTime");
const meetingZoneField = document.getElementById("meetingZone");
const meetingSchedule = document.getElementById("meetingSchedule");
const reunionField = document.getElementById("reunion");
const tripNoteField = document.getElementById("tripNote");

export function renderKicker({ kickers }, translator, dayNumber, phase = TripPhase.UPCOMING) {
  kickerField.textContent = translator.translate(phase === TripPhase.UPCOMING
    ? kickers[dayNumber % kickers.length]
    : `ui.${phase}Kicker`);
  reunionField.textContent = translator.translate(phase === TripPhase.MEMORIES ? "ui.memories" : "ui.reunion");
  tripNoteField.textContent = translator.translate(phase === TripPhase.MEMORIES ? "ui.memoriesNote" : "ui.togetherNote");
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

export function renderMeetingLabel({ meeting }, translator, meetingInstant, phase = TripPhase.UPCOMING, endInstant = null) {
  cityField.textContent = translator.translate(meeting.city);
  const formatter = new Intl.DateTimeFormat(translator.localeChain(), {
    timeZone: meeting.timeZone,
    day: "numeric",
    month: "long"
  });
  meetingDateField.textContent = phase !== TripPhase.UPCOMING && endInstant !== null
    ? formatter.formatRange(new Date(meetingInstant), new Date(endInstant))
    : formatter.format(new Date(meetingInstant));
  meetingSchedule.hidden = phase !== TripPhase.UPCOMING;
  meetingTimeField.textContent = meeting.time;
  meetingZoneField.textContent = zoneAbbreviation(meeting.timeZone, meetingInstant);
}
