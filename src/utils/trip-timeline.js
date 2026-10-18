import { TripPhase } from "@/utils/enums.js";
import { wallClockToInstant } from "@/utils/meeting-time.js";

export function createTripTimeline({ meeting }) {
  const meetingInstant = wallClockToInstant(meeting.date, meeting.time, meeting.timeZone);
  const endInstant = meeting.end
    ? wallClockToInstant(meeting.end.date, meeting.end.time, meeting.timeZone)
    : null;
  if (!Number.isFinite(meetingInstant) || (endInstant !== null && (!Number.isFinite(endInstant) || endInstant <= meetingInstant))) {
    throw new Error("Trip end must be a valid date and time after the meeting.");
  }

  return {
    meetingInstant,
    endInstant,
    phaseAt(nowMs) {
      if (nowMs < meetingInstant) {
        return TripPhase.UPCOMING;
      }
      return endInstant !== null && nowMs >= endInstant ? TripPhase.MEMORIES : TripPhase.TOGETHER;
    }
  };
}
