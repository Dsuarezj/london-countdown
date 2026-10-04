import { pickDailyFact, refreshTopics } from "@/services/daily-fact.js";
import { calendarDayNumber } from "@/utils/meeting-time.js";

const dialog = document.getElementById("infoCard");
const nameField = document.getElementById("infoCardName");
const scientificNameField = document.getElementById("infoCardScientificName");
const arrivalField = document.getElementById("infoCardArrival");
const factField = document.getElementById("infoCardFact");
const factSourceField = document.getElementById("infoCardFactSource");

function slotTopics(origin, character) {
  return [character.topic, ...origin.topics];
}

export function createInfoCard({ origins, characters, meeting }, translator) {
  let selectedSlot;
  let factRequestNumber = 0;

  refreshTopics(Object.values(origins).flatMap((origin) => slotTopics(origin, characters[origin.character])));

  async function renderFact(topics) {
    factRequestNumber += 1;
    const requestNumber = factRequestNumber;
    factField.textContent = "";
    factSourceField.hidden = true;
    const fact = await pickDailyFact(topics, translator, calendarDayNumber(Date.now(), meeting.timeZone));
    if (requestNumber !== factRequestNumber) {
      return;
    }
    factField.textContent = fact.text;
    factSourceField.hidden = !fact.fromArticle;
  }

  function render() {
    if (!selectedSlot) {
      return;
    }
    const origin = origins[selectedSlot];
    const character = characters[origin.character];
    const characterText = translator.translate(character.text);
    const place = `${translator.translate(origin.city)}, ${translator.translate(origin.label)}`;

    dialog.dataset.origin = selectedSlot;
    nameField.textContent = characterText.name;
    scientificNameField.textContent = character.scientificName;
    arrivalField.textContent = translator.translate("ui.currentLocation").replace("{place}", place);
    renderFact(slotTopics(origin, character));
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
