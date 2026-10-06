import { auroraTropics } from "@/backgrounds/aurora-tropics.js";
import { converging } from "@/backgrounds/converging.js";
import { meetingCity } from "@/backgrounds/meeting-city.js";
import { originWeather } from "@/backgrounds/origin-weather.js";
import { BackgroundId, BackgroundMode } from "@/utils/enums.js";
import { calendarDayNumber, wallClockToInstant } from "@/utils/meeting-time.js";
import { findActiveThreshold } from "@/utils/thresholds.js";

const BACKGROUNDS = {
  [BackgroundId.AURORA_TROPICS]: auroraTropics,
  [BackgroundId.ORIGIN_WEATHER]: originWeather,
  [BackgroundId.CONVERGING]: converging,
  [BackgroundId.MEETING_CITY]: meetingCity
};

function seededIndex(seed, length) {
  const noise = Math.sin(seed + 1) * 10000;
  return Math.floor((noise - Math.floor(noise)) * length);
}

function selectBackgroundId(backgroundsConfig, { remainingMs, isMeetingDay, dayNumber }) {
  if (isMeetingDay && backgroundsConfig.meetingDay) {
    return backgroundsConfig.meetingDay;
  }
  const countdownBackground = findActiveThreshold(backgroundsConfig.countdown, remainingMs);
  if (countdownBackground) {
    return countdownBackground.background;
  }
  if (backgroundsConfig.mode === BackgroundMode.RANDOM) {
    const { pool, everyDays } = backgroundsConfig.random;
    return pool[seededIndex(Math.floor(dayNumber / everyDays), pool.length)];
  }
  return backgroundsConfig.fixed;
}

function planSky({ meeting, backgrounds, origins }) {
  const meetingInstant = wallClockToInstant(meeting.date, meeting.time, meeting.timeZone);
  const todayNumber = calendarDayNumber(Date.now(), meeting.timeZone);
  return {
    backgroundId: selectBackgroundId(backgrounds, {
      remainingMs: meetingInstant - Date.now(),
      isMeetingDay: todayNumber === calendarDayNumber(meetingInstant, meeting.timeZone),
      dayNumber: todayNumber
    }),
    context: { origins, meeting, weatherEnabled: backgrounds.weather }
  };
}

function mountBackground(skyElement, { backgroundId, context }, fadeIn) {
  const background = BACKGROUNDS[backgroundId];
  skyElement.className = `sky sky--${backgroundId}`;
  skyElement.innerHTML = background.markup;
  background.decorate?.(skyElement, { ...context, fadeIn });
}

export function createSky(skyElement) {
  let mountedPlanKey = "";

  return function showSky(config, { fadeIn }) {
    const skyPlan = planSky(config);
    const skyPlanKey = JSON.stringify(skyPlan);
    if (skyPlanKey === mountedPlanKey) {
      return;
    }
    mountedPlanKey = skyPlanKey;
    mountBackground(skyElement, skyPlan, fadeIn);
  };
}
