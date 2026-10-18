import assert from "node:assert/strict";
import { test } from "node:test";
import { createTripTimeline } from "@/utils/trip-timeline.js";

const config = {
  meeting: { date: "2026-11-13", time: "22:00", timeZone: "Europe/London" },
  trip: { end: { date: "2026-11-15", time: "10:00" } }
};

test("the meeting instant starts the stay and Sunday at 10 ends it", () => {
  const timeline = createTripTimeline(config);
  assert.equal(timeline.phaseAt(timeline.meetingInstant - 1), "upcoming");
  assert.equal(timeline.phaseAt(timeline.meetingInstant), "together");
  assert.equal(timeline.phaseAt(timeline.endInstant - 1), "together");
  assert.equal(timeline.phaseAt(timeline.endInstant), "memories");
  assert.equal(timeline.phaseAt(timeline.endInstant + 86400000), "memories");
});

test("a trip without an end keeps the reunion instead of inventing an expiry", () => {
  const timeline = createTripTimeline({ meeting: config.meeting });
  assert.equal(timeline.endInstant, null);
  assert.equal(timeline.phaseAt(Date.parse("2027-01-01T00:00:00Z")), "together");
});

test("trip end follows the meeting time zone, including daylight saving", () => {
  const timeline = createTripTimeline({
    meeting: { ...config.meeting, date: "2026-10-23" },
    trip: { end: { date: "2026-10-25", time: "10:00" } }
  });
  assert.equal(timeline.meetingInstant, Date.parse("2026-10-23T21:00:00Z"));
  assert.equal(timeline.endInstant, Date.parse("2026-10-25T10:00:00Z"));
});

test("an invalid end or an end before the meeting fails explicitly", () => {
  for (const end of [
    { date: "2026-11-13", time: "21:00" },
    { date: "2026-11-13", time: "22:00" },
    { date: "invalid", time: "10:00" }
  ]) {
    assert.throws(() => createTripTimeline({ ...config, trip: { end } }));
  }
});
