const INSTALL_RECORD_KEY = "install-prompt";
const DAY_MS = 86400000;
const OFFER_DAYS = 7;

const InstallRoute = Object.freeze({
  NATIVE: "native",
  IOS_HINT: "ios-hint"
});

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

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function markInstalled() {
  saveInstallRecord({ ...readInstallRecord(), installed: true });
}

function dismissForToday() {
  saveInstallRecord({ ...readInstallRecord(), dismissedOn: todayKey() });
  hidePrompt();
}

function isRunningInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isOfferDue() {
  const record = readInstallRecord();
  if (record.installed || isRunningInstalled()) {
    return false;
  }
  const daysSinceFirstVisit = Math.floor((Date.now() - record.firstVisitAt) / DAY_MS);
  if (daysSinceFirstVisit >= OFFER_DAYS) {
    return false;
  }
  return record.dismissedOn !== todayKey();
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function hidePrompt() {
  promptElement.hidden = true;
}

function showPrompt(route, installEvent) {
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
    markInstalled();
  }
  window.addEventListener("appinstalled", () => {
    markInstalled();
    hidePrompt();
  });
  closeButton.addEventListener("click", dismissForToday);

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
