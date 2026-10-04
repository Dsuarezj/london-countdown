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

function startAffection(meetingElement, { beats, intervalMs }) {
  const beatDurationMs = readDurationMs("--beat-duration");
  let affectionBusy = false;

  function playRandomBeat() {
    if (affectionBusy) {
      return;
    }
    affectionBusy = true;
    const beatName = pickRandomItem(beats);
    document.body.classList.add(beatName);
    setTimeout(() => {
      document.body.classList.remove(beatName);
      affectionBusy = false;
    }, beatDurationMs);
  }

  setTimeout(playRandomBeat, 1000);
  setInterval(playRandomBeat, intervalMs);
  meetingElement.addEventListener("click", playRandomBeat);
}

export function playMeeting(meetingElement, affection, onArrived) {
  function settleTogether() {
    document.body.classList.remove("journey");
    document.body.classList.add("arrived");
    startAffection(meetingElement, affection);
    onArrived();
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settleTogether();
    return;
  }

  document.body.classList.add("journey");
  setTimeout(settleTogether, readDurationMs("--journey-duration"));
}
