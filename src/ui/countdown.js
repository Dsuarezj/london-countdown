import { splitRemaining } from "@/utils/meeting-time.js";

const countdownSection = document.getElementById("countdown");
const countdownScene = document.getElementById("countdownScene");
const countdownPanel = document.getElementById("countdownPanel");
const reunionPanel = document.getElementById("reunionPanel");
const daysField = document.getElementById("days");
const hoursField = document.getElementById("hours");
const minutesField = document.getElementById("minutes");
const secondsField = document.getElementById("seconds");

export function renderCountdown(remainingMs) {
  const complete = remainingMs <= 0;
  countdownScene.classList.toggle("is-complete", complete);
  countdownPanel.setAttribute("aria-hidden", String(complete));
  reunionPanel.setAttribute("aria-hidden", String(!complete));
  const remaining = splitRemaining(Math.max(0, remainingMs));
  daysField.textContent = String(remaining.days);
  hoursField.textContent = String(remaining.hours).padStart(2, "0");
  minutesField.textContent = String(remaining.minutes).padStart(2, "0");
  secondsField.textContent = String(remaining.seconds).padStart(2, "0");
  countdownSection.dataset.ready = "true";
}
