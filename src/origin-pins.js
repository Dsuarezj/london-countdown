const pins = document.querySelectorAll("[data-origin]");

export function mountOriginPins(onSelect) {
  for (const pin of pins) {
    pin.addEventListener("click", () => onSelect(pin.dataset.origin));
  }
}

export function renderOriginPins(origins, translator) {
  for (const pin of pins) {
    pin.querySelector(".pin__label").textContent = translator.translate(origins[pin.dataset.origin].label);
  }
}
