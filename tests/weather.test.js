import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { requestPlaceSky } from "@/gateways/weather-gateway.js";
import { CLEAR_NIGHT_SKY, loadPlaceSky, readStoredPlaceSky, samePlaceSky } from "@/services/place-sky.js";
import { weatherResponse } from "./weather-fixture.js";

const place = { latitude: 51.5, longitude: -0.12, timeZone: "Europe/London" };
const cacheKey = "place-sky:51.5,-0.12";
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function serveWeather(current, units) {
  mock.method(globalThis, "fetch", async () => Response.json(weatherResponse(current, units)));
}

beforeEach(() => {
  const storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    configurable: true
  });
});

afterEach(() => {
  mock.restoreAll();
  if (originalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test("cloud coverage is preserved independently of a rainy weather code", async () => {
  serveWeather({ weather_code: 61, cloud_cover: 40, rain: 0.25, showers: 0.5 });
  assert.deepEqual(await requestPlaceSky(place), {
    phase: "day", cloudCoverPct: 40, rainMmPerHour: 3, snowfallCmPerHour: 0, thunder: false
  });
});

test("a fully covered sky can be dry", async () => {
  serveWeather({ weather_code: 3, cloud_cover: 100 });
  assert.deepEqual(await requestPlaceSky(place), {
    phase: "day", cloudCoverPct: 100, rainMmPerHour: 0, snowfallCmPerHour: 0, thunder: false
  });
});

test("a precipitation code does not invent rain or snow when amounts are zero", async () => {
  for (const weather_code of [51, 61, 71, 95]) {
    serveWeather({ weather_code });
    const sky = await requestPlaceSky(place);
    assert.equal(sky.rainMmPerHour, 0);
    assert.equal(sky.snowfallCmPerHour, 0);
  }
});

test("rain and snowfall coexist with different, explicit units", async () => {
  serveWeather({ weather_code: 73, rain: 0.125, snowfall: 0.5, is_day: 0 });
  const sky = await requestPlaceSky(place);
  assert.equal(sky.phase, "night");
  assert.equal(sky.rainMmPerHour, 0.5);
  assert.equal(sky.snowfallCmPerHour, 2);
});

test("equal precipitation rates do not change with the observation interval", async () => {
  serveWeather({ interval: 900, rain: 0.25, snowfall: 0.5 });
  const quarterHourSky = await requestPlaceSky(place);
  serveWeather({ interval: 3600, rain: 1, snowfall: 2 });
  assert.deepEqual(await requestPlaceSky(place), quarterHourSky);
});

test("all documented thunderstorm codes add thunder without forcing clouds or precipitation", async () => {
  for (const weather_code of [95, 96, 97, 99]) {
    serveWeather({ weather_code, cloud_cover: 40, showers: 0.25 });
    assert.deepEqual(await requestPlaceSky(place), {
      phase: "day", cloudCoverPct: 40, rainMmPerHour: 1, snowfallCmPerHour: 0, thunder: true
    });
  }
});

test("fog is not reclassified as a fully covered sky", async () => {
  for (const weather_code of [45, 48]) {
    serveWeather({ weather_code, cloud_cover: 20 });
    assert.equal((await requestPlaceSky(place)).cloudCoverPct, 20);
  }
});

test("invalid observations and unexpected units fail explicitly", async () => {
  for (const values of [
    { cloud_cover: null }, { cloud_cover: 101 }, { cloud_cover: -1 },
    { rain: null }, { rain: -0.1 }, { showers: "1" }, { snowfall: -1 },
    { interval: 0 }, { interval: null }, { is_day: 2 }, { weather_code: null }
  ]) {
    serveWeather(values);
    await assert.rejects(requestPlaceSky(place), /Invalid current weather values/);
  }
  for (const units of [{ rain: "inch" }, { showers: "inch" }, { snowfall: "mm" }, { cloud_cover: "" }, { interval: "minutes" }]) {
    serveWeather({}, units);
    await assert.rejects(requestPlaceSky(place), /Unexpected weather units/);
  }
});

test("HTTP failures are not presented as clear weather", async () => {
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  await assert.rejects(requestPlaceSky(place), /503/);
});

test("the last observation survives an offline reload with its units intact", async () => {
  serveWeather({ cloud_cover: 63, rain: 0.25, snowfall: 0.5 });
  const freshSky = await loadPlaceSky(place);
  assert.deepEqual(readStoredPlaceSky(place), freshSky);
  mock.method(globalThis, "fetch", async () => { throw new Error("Offline"); });
  assert.deepEqual(await loadPlaceSky(place), freshSky);
});

test("legacy and malformed caches are discarded rather than inventing cloud coverage", () => {
  for (const value of [
    JSON.stringify({ phase: "night", condition: "rain", rain: 1, snowfall: 0, thunder: false }),
    JSON.stringify({ version: 2, sky: { ...CLEAR_NIGHT_SKY, cloudCoverPct: null } }),
    JSON.stringify({ version: 2, sky: { ...CLEAR_NIGHT_SKY, rainMmPerHour: -1 } }),
    JSON.stringify({ version: 2, sky: {} }),
    "{invalid json",
    "null"
  ]) {
    localStorage.setItem(cacheKey, value);
    assert.equal(readStoredPlaceSky(place), null);
    assert.equal(localStorage.getItem(cacheKey), null);
  }
});

test("an unavailable cache does not discard a successful weather observation", async () => {
  serveWeather({ cloud_cover: 40, rain: 0.75 });
  mock.method(localStorage, "setItem", () => { throw new Error("Storage quota exceeded"); });
  const sky = await loadPlaceSky(place);
  assert.equal(sky.cloudCoverPct, 40);
  assert.equal(sky.rainMmPerHour, 3);
});

test("offline without an observation estimates only daylight, not a measured cloud percentage", async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error("Offline"); });
  mock.method(Date, "now", () => Date.parse("2026-10-18T12:00:00Z"));
  const sky = await loadPlaceSky(place);
  assert.equal(sky.phase, "day");
  assert.equal(sky.cloudCoverPct, null);
  assert.equal(sky.rainMmPerHour, 0);
  assert.equal(localStorage.getItem(cacheKey), null);
});

test("a change in any visual dimension is a different sky", () => {
  assert.equal(samePlaceSky(CLEAR_NIGHT_SKY, { ...CLEAR_NIGHT_SKY }), true);
  for (const change of [
    { phase: "day" }, { cloudCoverPct: 1 }, { cloudCoverPct: null },
    { rainMmPerHour: 0.1 }, { snowfallCmPerHour: 0.1 }, { thunder: true }
  ]) {
    assert.equal(samePlaceSky(CLEAR_NIGHT_SKY, { ...CLEAR_NIGHT_SKY, ...change }), false);
  }
});
