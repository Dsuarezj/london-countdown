import { loadCachedJson, readCachedJson } from "@/services/cached-json.js";

const CONFIG_URL = "config.json";

export function readCachedConfig() {
  return readCachedJson(CONFIG_URL);
}

export function loadConfig() {
  return loadCachedJson(CONFIG_URL);
}

export function applyThemeTokens(tokens) {
  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(tokenName, tokenValue);
  }
}
