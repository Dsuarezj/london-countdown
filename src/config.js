export async function loadConfig() {
  const response = await fetch("config.json");
  return response.json();
}

export function applyThemeTokens(tokens) {
  for (const [tokenName, tokenValue] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(tokenName, tokenValue);
  }
}
