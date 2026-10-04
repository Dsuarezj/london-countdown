import { splitRemaining } from "@/meeting-time.js";

const countdownSection = document.getElementById("countdown");
const reunionMessage = document.getElementById("reunion");
const daysField = document.getElementById("days");
const hoursField = document.getElementById("hours");
const minutesField = document.getElementById("minutes");
const secondsField = document.getElementById("seconds");

export function renderCountdown(remainingMs) {
  if (remainingMs <= 0) {
    countdownSection.hidden = true;
    reunionMessage.hidden = false;
    return;
  }

  const remaining = splitRemaining(remainingMs);
  daysField.textContent = String(remaining.days);
  hoursField.textContent = String(remaining.hours).padStart(2, "0");
  minutesField.textContent = String(remaining.minutes).padStart(2, "0");
  secondsField.textContent = String(remaining.seconds).padStart(2, "0");
}
