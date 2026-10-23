import { createFactDeck } from "@/services/facts.js";
import { TripPhase } from "@/utils/enums.js";
import { createTripTimeline } from "@/utils/trip-timeline.js";

const dialog = document.getElementById("infoCard");
const locationField = document.getElementById("infoCardLocation");
const factField = document.getElementById("infoCardFact");
const contextField = document.getElementById("infoCardFactContext");
const sourcesField = document.getElementById("infoCardFactSources");

export function createInfoCard(config, translator) {
  const { origins, meeting } = config;
  const timeline = createTripTimeline(config);
  let selectedSlot;
  let selectedFact;
  let deck;
  let loadFailed = false;

  createFactDeck(config, translator).then((loadedDeck) => {
    deck = loadedDeck;
    if (selectedSlot) {
      selectedFact = deck.next(selectedSlot);
      render();
    }
  }).catch((error) => {
    loadFailed = true;
    console.error("Could not load the configured curiosity catalog", error);
    render();
  });

  function render() {
    if (!selectedSlot) {
      return;
    }
    const origin = origins[selectedSlot];
    const place = timeline.phaseAt(Date.now()) === TripPhase.TOGETHER
      ? translator.translate(meeting.city)
      : `${translator.translate(origin.city)}, ${translator.translate(origin.label)}`;

    dialog.dataset.origin = selectedSlot;
    locationField.textContent = translator.translate("ui.currentLocation").replace("{place}", place);
    factField.textContent = selectedFact
      ? selectedFact.text[translator.language()]
      : translator.translate(loadFailed ? "ui.factUnavailable" : "ui.factLoading");
    contextField.hidden = !selectedFact;
    sourcesField.hidden = !selectedFact;
    sourcesField.replaceChildren();
    if (selectedFact) {
      const label = translator.translate(selectedFact.topic.label);
      contextField.textContent = typeof label === "string" ? label : label.name;
      for (const source of selectedFact.sources) {
        const link = document.createElement("a");
        link.href = source;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = new URL(source).hostname;
        sourcesField.append(link);
      }
    }
  }

  function open(slot) {
    selectedSlot = slot;
    selectedFact = deck?.next(slot);
    render();
    dialog.showModal();
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  return { open, render };
}
