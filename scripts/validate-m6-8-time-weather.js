const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing file: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} missing required text: ${pattern}`);
  }
}

function main() {
  requireFile("plugin/src/dashboard/timeWeather.ts");
  requireFile("plugin/src/data/weatherRepository.ts");
  requireFile("tests/plugin/m6-8-manual-test-checklist.md");

  requireText("plugin/src/dashboard/timeWeather.ts", [
    "WeatherDisplayData",
    "networkTime",
    "formatCurrentTime",
    "formatCurrentDate",
    "parseNetworkWeatherTime",
    "formatWeatherSummary",
    "weatherCodeLabel"
  ]);

  requireText("plugin/src/data/weatherRepository.ts", [
    "WeatherRepository",
    "requestUrl",
    "requestUrlWithTimeout",
    "联网同步超时",
    "api.open-meteo.com/v1/forecast",
    "current=time,temperature_2m,weather_code,wind_speed_10m",
    "WeatherCache",
    "readCachedWeather",
    "fetchAndCacheCurrentWeather"
  ]);

  requireText("plugin/src/settings.ts", [
    "WEATHER_REGION_PRESETS",
    "weatherRegionPreset",
    "weatherLocationName",
    "weatherLatitude",
    "weatherLongitude",
    "weatherUnit",
    "time-weather"
  ]);

  requireText("plugin/src/main.ts", [
    "WeatherRepository",
    "weatherRepository",
    "new WeatherRepository"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "renderTimeWeatherModule",
    "updateTimeWeatherClock",
    "timeWeatherTimer",
    "timeWeatherSyncedOffsetMs",
    "updateTimeWeatherDisplay",
    "readCachedWeather",
    "fetchAndCacheCurrentWeather",
    "同步",
    "正在联网同步",
    "sync.disabled = false"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-time-weather-module",
    ".fishbone-time-weather-clock",
    ".fishbone-time-weather-summary"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  const settings = read("plugin/src/settings.ts");
  assert(!settings.includes("enableWeather"), "Weather should no longer require a settings enable switch.");
  assert(!view.includes("settings.enableWeather"), "Time/weather module should always render weather state without an enable gate.");
  assert(view.includes("window.setInterval") && view.includes("window.clearInterval"), "Time module should update without full canvas render and clear timer on close.");
  assert(view.indexOf("fetchAndCacheCurrentWeather") > view.indexOf("sync.addEventListener"), "Weather fetch should be user-triggered by the sync button.");

  console.log("M6.8 time/weather validation passed.");
}

main();
