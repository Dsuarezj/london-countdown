import { loadCachedJson } from "@/services/cached-json.js";

const LANGUAGE_KEY = "loa-language";

async function loadDictionary(language) {
  return [language, await loadCachedJson(`translations/${language}.json`)];
}

function readPath(dictionary, key) {
  return key.split(".").reduce((node, segment) => node?.[segment], dictionary);
}

function resolveInitialLanguage(languages) {
  const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
  if (languages.includes(storedLanguage)) {
    return storedLanguage;
  }
  const deviceLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const languageTag of deviceLanguages) {
    const baseLanguage = String(languageTag).toLowerCase().split("-")[0];
    if (languages.includes(baseLanguage)) {
      return baseLanguage;
    }
  }
  return languages[0];
}

export async function createTranslator(languages) {
  const dictionaries = Object.fromEntries(await Promise.all(languages.map(loadDictionary)));
  const fallbackLanguage = languages[0];
  let activeLanguage = resolveInitialLanguage(languages);

  function translate(key) {
    return readPath(dictionaries[activeLanguage], key) ?? readPath(dictionaries[fallbackLanguage], key);
  }

  return {
    translate,
    language: () => activeLanguage,
    localeChain: () => [dictionaries[activeLanguage].locale, dictionaries[fallbackLanguage].locale],
    cycleLanguage() {
      activeLanguage = languages[(languages.indexOf(activeLanguage) + 1) % languages.length];
      localStorage.setItem(LANGUAGE_KEY, activeLanguage);
    },
    renderStaticStrings() {
      document.documentElement.lang = activeLanguage;
      for (const element of document.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(element.dataset.i18n);
      }
      for (const element of document.querySelectorAll("[data-i18n-aria]")) {
        element.setAttribute("aria-label", translate(element.dataset.i18nAria));
      }
    }
  };
}
