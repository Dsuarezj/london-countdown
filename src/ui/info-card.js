import { createFactTopics, pickFact } from "@/services/facts.js";

const dialog = document.getElementById("infoCard");
const nameField = document.getElementById("infoCardName");
const scientificNameField = document.getElementById("infoCardScientificName");
const arrivalField = document.getElementById("infoCardArrival");
const factField = document.getElementById("infoCardFact");
const factContextField = document.getElementById("infoCardFactContext");
const factNoticeField = document.getElementById("infoCardFactNotice");
const factAttributionField = document.getElementById("infoCardFactAttribution");
const factSourceField = document.getElementById("infoCardFactSource");

export function createInfoCard({ origins, characters, languages }, translator) {
  let selectedSlot;
  let requestNumber = 0;
  const selectionBySlot = new Map();

  async function renderFact(origin, character) {
    const request = ++requestNumber;
    const language = translator.language();
    factField.textContent = translator.translate("ui.factLoading");
    factField.lang = language;
    factContextField.hidden = true;
    factNoticeField.hidden = true;
    factAttributionField.hidden = true;
    try {
      const topics = createFactTopics(origin, character, translator, languages[0]);
      const fact = await pickFact(topics, selectionBySlot.get(selectedSlot));
      if (request !== requestNumber) {
        return;
      }
      factField.textContent = fact.text;
      factField.lang = fact.language;
      factContextField.textContent = [fact.title, fact.section].filter(Boolean).join(" · ");
      factContextField.lang = fact.language;
      factContextField.hidden = false;
      const notices = [];
      if (fact.language !== language) {
        const languageName = new Intl.DisplayNames([language], { type: "language" }).of(fact.language);
        notices.push(translator.translate("ui.factOriginalLanguage").replace("{language}", languageName));
      }
      if (fact.stale) {
        notices.push(translator.translate("ui.factSaved"));
      }
      factNoticeField.textContent = notices.join(" ");
      factNoticeField.hidden = notices.length === 0;
      factSourceField.href = fact.sourceUrl;
      factAttributionField.hidden = false;
    } catch (error) {
      if (request !== requestNumber) {
        return;
      }
      console.warn("Could not load the configured topic's fact", error);
      factField.textContent = translator.translate("ui.factUnavailable");
      factField.lang = language;
    }
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
    renderFact(origin, character);
  }

  function open(slot) {
    selectedSlot = slot;
    selectionBySlot.set(slot, (selectionBySlot.get(slot) ?? -1) + 1);
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
