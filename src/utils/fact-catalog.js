export function createFactTopics(config, translate) {
  function label(key) {
    const value = translate(key, "en");
    const text = typeof value === "string" ? value : value?.name;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`Missing English label for ${key}`);
    }
    return text;
  }

  return Object.fromEntries(Object.entries(config.origins).map(([slot, origin]) => {
    const character = config.characters[origin.character];
    return [slot, [
      {
        key: `city:${origin.city}`,
        kind: "city",
        label: origin.city,
        name: label(origin.city),
        country: label(origin.label),
        latitude: origin.latitude,
        longitude: origin.longitude
      },
      { key: `country:${origin.label}`, kind: "country", label: origin.label, name: label(origin.label) },
      {
        key: `species:${origin.character}`,
        kind: "species",
        label: character.text,
        name: label(character.text).split(" · ").at(-1),
        ...(character.scientificName ? { scientificName: character.scientificName } : {})
      }
    ]];
  }));
}

export function normalizeFactText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("A curiosity must have non-empty English text");
  }
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateFactCatalog(catalog, topicsBySlot, languages) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.languages)
    || !languages.every((language) => catalog.languages.includes(language))) {
    throw new Error("Curiosity catalog has an unsupported format or missing languages");
  }
  for (const topic of Object.values(topicsBySlot).flat()) {
    const entry = catalog.topics?.[topic.key];
    if (JSON.stringify(entry?.subject) !== JSON.stringify(topic)) {
      throw new Error(`Curiosity catalog does not match the configured topic: ${topic.key}`);
    }
    if (!Array.isArray(entry.facts) || entry.facts.length < 1 || entry.facts.length > 100) {
      throw new Error(`The topic ${topic.key} must contain between 1 and 100 curiosities`);
    }
    const ids = new Set();
    const texts = new Set();
    for (const fact of entry.facts) {
      if (!fact || !/^[a-f0-9]{64}$/.test(fact.id)) {
        throw new Error(`Invalid curiosity ID in ${topic.key}`);
      }
      const missingLanguages = catalog.languages.filter((language) =>
        typeof fact.text?.[language] !== "string" || !fact.text[language].trim());
      if (missingLanguages.length) {
        throw new Error(`Missing translations in ${topic.key}: ${missingLanguages.join(", ")}`);
      }
      if (!Array.isArray(fact.sources) || !fact.sources.length) {
        throw new Error(`Missing sources in ${topic.key}`);
      }
      for (const source of fact.sources) {
        let url;
        try {
          url = new URL(source);
        } catch {
          throw new Error(`Invalid source URL in ${topic.key}: ${source}`);
        }
        if (url.protocol !== "https:") {
          throw new Error(`Source URL must use HTTPS in ${topic.key}: ${source}`);
        }
      }
      const text = normalizeFactText(fact.text.en);
      if (ids.has(fact.id) || texts.has(text)) {
        throw new Error(`Duplicate curiosity in ${topic.key}`);
      }
      ids.add(fact.id);
      texts.add(text);
    }
  }
}
