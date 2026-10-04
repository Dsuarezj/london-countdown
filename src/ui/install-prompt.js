const INSTALL_RECORD_KEY = "install-prompt";
const SESSION_KEY = "install-prompt-session";
const SESSION_OFFERED = "offered";
const DAY_MS = 86400000;
const INTRODUCING_DAYS = 3;
const LAST_CALL_DAY_INDEX = 6;

const InstallPhase = Object.freeze({
  INTRODUCING: "introducing",
  RESTING: "resting",
  LAST_CALL: "last-call",
  RETIRED: "retired",
  INSTALLED: "installed"
});

const InstallRoute = Object.freeze({
  NATIVE: "native",
  IOS_HINT: "ios-hint"
});

const SETTLED_PHASES = [InstallPhase.RETIRED, InstallPhase.INSTALLED];
const OFFERING_PHASES = [InstallPhase.INTRODUCING, InstallPhase.LAST_CALL];

const promptElement = document.getElementById("installPrompt");
const inviteText = document.getElementById("installInvite");
const iosHintText = document.getElementById("installIosHint");
const installButton = document.getElementById("installAction");
const closeButton = document.getElementById("installClose");

function saveInstallRecord(record) {
  localStorage.setItem(INSTALL_RECORD_KEY, JSON.stringify(record));
}

function readInstallRecord() {
  const storedRecord = localStorage.getItem(INSTALL_RECORD_KEY);
  if (storedRecord) {
    return JSON.parse(storedRecord);
  }
  const firstRecord = { firstVisitAt: Date.now() };
  saveInstallRecord(firstRecord);
  return firstRecord;
}

function settlePhase(settledPhase) {
  saveInstallRecord({ ...readInstallRecord(), settledPhase });
}

function currentPhase() {
  const record = readInstallRecord();
  if (SETTLED_PHASES.includes(record.settledPhase)) {
    return record.settledPhase;
  }
  const daysSinceFirstVisit = Math.floor((Date.now() - record.firstVisitAt) / DAY_MS);
  if (daysSinceFirstVisit < INTRODUCING_DAYS) {
    return InstallPhase.INTRODUCING;
  }
  if (daysSinceFirstVisit < LAST_CALL_DAY_INDEX) {
    return InstallPhase.RESTING;
  }
  return InstallPhase.LAST_CALL;
}

function isOfferDue() {
  return OFFERING_PHASES.includes(currentPhase()) && sessionStorage.getItem(SESSION_KEY) !== SESSION_OFFERED;
}

function isRunningInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function hidePrompt() {
  promptElement.hidden = true;
}

function showPrompt(route, installEvent) {
  if (currentPhase() === InstallPhase.LAST_CALL) {
    settlePhase(InstallPhase.RETIRED);
  }
  sessionStorage.setItem(SESSION_KEY, SESSION_OFFERED);

  inviteText.hidden = route !== InstallRoute.NATIVE;
  installButton.hidden = route !== InstallRoute.NATIVE;
  iosHintText.hidden = route !== InstallRoute.IOS_HINT;
  installButton.onclick = () => {
    installEvent.prompt();
    hidePrompt();
  };
  promptElement.hidden = false;
}

function waitForNativeInstall() {
  return new Promise((resolve) => {
    window.addEventListener("beforeinstallprompt", (installEvent) => {
      installEvent.preventDefault();
      resolve(installEvent);
    }, { once: true });
  });
}

export function prepareInstallPrompt() {
  if (isRunningInstalled()) {
    settlePhase(InstallPhase.INSTALLED);
  }
  window.addEventListener("appinstalled", () => {
    settlePhase(InstallPhase.INSTALLED);
    hidePrompt();
  });
  closeButton.addEventListener("click", hidePrompt);

  const nativeInstallReady = waitForNativeInstall();

  return async function offerInstall() {
    if (!isOfferDue()) {
      return;
    }
    if (isAppleMobile()) {
      showPrompt(InstallRoute.IOS_HINT);
      return;
    }
    const installEvent = await nativeInstallReady;
    if (isOfferDue()) {
      showPrompt(InstallRoute.NATIVE, installEvent);
    }
  };
}
