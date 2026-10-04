const offlineMark = document.getElementById("offlineMark");

async function isOriginReachable() {
  try {
    const response = await fetch(`manifest.webmanifest?ping=${Date.now()}`, { cache: "no-store" });
    return response.ok;
  } catch (networkError) {
    return false;
  }
}

async function renderConnectionState() {
  offlineMark.hidden = await isOriginReachable();
}

export function watchConnection() {
  renderConnectionState();
  window.addEventListener("online", renderConnectionState);
  window.addEventListener("offline", renderConnectionState);
}
