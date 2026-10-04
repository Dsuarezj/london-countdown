const dialog = document.getElementById("infoCard");
const originField = document.getElementById("infoCardOrigin");
const nameField = document.getElementById("infoCardName");
const scientificNameField = document.getElementById("infoCardScientificName");
const factsList = document.getElementById("infoCardFacts");

export function createInfoCard({ origins, characters }, translator) {
  let selectedSlot;

  function render() {
    if (!selectedSlot) {
      return;
    }
    const origin = origins[selectedSlot];
    const character = characters[origin.character];
    const characterText = translator.translate(character.text);

    dialog.dataset.origin = selectedSlot;
    originField.textContent = `${origin.city} · ${translator.translate(origin.label)}`;
    nameField.textContent = characterText.name;
    scientificNameField.textContent = character.scientificName;
    factsList.replaceChildren(...characterText.facts.map((fact) => {
      const factItem = document.createElement("li");
      factItem.textContent = fact;
      return factItem;
    }));
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
