import { TripPhase } from "@/utils/enums.js";
import { createTripTimeline } from "@/utils/trip-timeline.js";

const dialog = document.getElementById("infoCard");
const locationField = document.getElementById("infoCardLocation");

export function createInfoCard(config, translator) {
  const { origins, meeting } = config;
  const timeline = createTripTimeline(config);
  let selectedSlot;

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
  }

  function open(slot) {
    selectedSlot = slot;
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
