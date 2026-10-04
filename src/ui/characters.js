import { loadStylesheet } from "@/utils/stylesheet.js";

async function createBird(slot, characterId, character) {
  const [markupResponse] = await Promise.all([fetch(character.markup), loadStylesheet(character.stylesheet)]);
  const bird = document.createElement("div");
  bird.className = `bird bird--${slot} character--${characterId}`;
  bird.dataset.character = characterId;
  bird.setAttribute("role", "img");
  bird.innerHTML = `<div class="bird__body">${await markupResponse.text()}</div>`;
  return bird;
}

export async function mountCharacters(meetingElement, { origins, characters }) {
  const birds = await Promise.all(
    Object.entries(origins).map(([slot, origin]) => createBird(slot, origin.character, characters[origin.character]))
  );
  meetingElement.append(...birds);
}

export function renderCharacterLabels(meetingElement, characters, translator) {
  for (const bird of meetingElement.querySelectorAll(".bird")) {
    bird.setAttribute("aria-label", translator.translate(`${characters[bird.dataset.character].text}.ariaLabel`));
  }
}
