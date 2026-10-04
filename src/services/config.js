import { loadCachedJson } from "@/services/cached-json.js";

export function loadConfig() {
  return loadCachedJson("config.json");
}

export function applyThemeTokens(tokens) {
  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(tokenName, tokenValue);
  }
}
