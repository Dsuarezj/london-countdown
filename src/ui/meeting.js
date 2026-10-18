import { TripPhase } from "@/utils/enums.js";

function readDurationMs(propertyName) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(propertyName)) * 1000;
}

function pickRandomItem(items) {
  const randomValues = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / items.length) * items.length;
  let randomValue;
  do {
    crypto.getRandomValues(randomValues);
    randomValue = randomValues[0];
  } while (randomValue >= limit);
  return items[randomValue % items.length];
}

function startAffection(meetingElement, { beats, intervalMs }, openingDelayMs) {
  const beatDurationMs = readDurationMs("--beat-duration");
  let affectionBusy = false;
  let activeBeat;
  let beatTimeout;

  function playRandomBeat() {
    if (affectionBusy) {
      return;
    }
    affectionBusy = true;
    const beatName = pickRandomItem(beats);
    activeBeat = beatName;
    document.body.classList.add(beatName);
    beatTimeout = setTimeout(() => {
      document.body.classList.remove(beatName);
      affectionBusy = false;
    }, beatDurationMs);
  }

  const openingTimeout = setTimeout(playRandomBeat, openingDelayMs);
  const interval = setInterval(playRandomBeat, intervalMs);
  meetingElement.addEventListener("click", playRandomBeat);
  return () => {
    clearTimeout(openingTimeout);
    clearTimeout(beatTimeout);
    clearInterval(interval);
    meetingElement.removeEventListener("click", playRandomBeat);
    if (activeBeat) {
      document.body.classList.remove(activeBeat);
    }
  };
}

function startFlybys() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
  const flightMs = readDurationMs("--flyby-duration");
  let timeout;
  let activeClass;

  function scheduleNext() {
    timeout = setTimeout(() => {
      activeClass = `flyby-${pickRandomItem(["north", "south"])}`;
      document.body.classList.add(activeClass);
      timeout = setTimeout(() => {
        document.body.classList.remove(activeClass);
        scheduleNext();
      }, flightMs);
    }, 12000 + Math.random() * 14000);
  }

  scheduleNext();
  return () => {
    clearTimeout(timeout);
    if (activeClass) {
      document.body.classList.remove(activeClass);
    }
  };
}

export function playMeeting(meetingElement, affection, onArrived, initialPhase = TripPhase.UPCOMING) {
  let currentPhase;
  let journeyTimeout;
  let stopAffection;

  function settleTogether() {
    document.body.classList.remove("journey");
    document.body.classList.add("arrived");
    stopAffection = currentPhase === TripPhase.MEMORIES
      ? startFlybys()
      : startAffection(meetingElement, affection, currentPhase === TripPhase.TOGETHER ? 1800 : 1000);
    onArrived();
  }

  function setPhase(phase) {
    if (phase === currentPhase) {
      return;
    }
    currentPhase = phase;
    clearTimeout(journeyTimeout);
    stopAffection?.();
    if (phase !== TripPhase.UPCOMING || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settleTogether();
      return;
    }
    document.body.classList.remove("arrived");
    document.body.classList.add("journey");
    journeyTimeout = setTimeout(settleTogether, readDurationMs("--journey-duration"));
  }

  setPhase(initialPhase);
  return { setPhase };
}
