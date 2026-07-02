const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} missing required text: ${pattern}`);
  }
}

function main() {
  const modules = read("plugin/src/dashboard/dashboardModules.ts");
  const settings = read("plugin/src/settings.ts");
  const view = read("plugin/src/views/FishboneTimelineView.ts");
  const main = read("plugin/src/main.ts");
  const styles = read("plugin/styles.css");

  assert(!fs.existsSync(path.join(root, "plugin/src/dashboard/timeWeather.ts")), "Old time/weather helper should be renamed.");

  requireText("plugin/src/dashboard/toolbarTime.ts", [
    "formatCurrentTime",
    "formatCurrentDate"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "renderToolbarLocalTime",
    "fishbone-toolbar-task-time-group",
    "fishbone-toolbar-local-time-clock",
    "fishbone-toolbar-local-time-date",
    "updateToolbarLocalTime",
    "window.setInterval",
    "window.clearInterval"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-toolbar-task-time-group",
    ".fishbone-toolbar-local-time",
    ".fishbone-toolbar-local-time-clock",
    ".fishbone-toolbar-local-time-date"
  ]);

  assert(!modules.includes("time-weather"), "time-weather should not be registered as a dashboard module.");
  assert(!settings.includes("weatherRegionPreset"), "Weather settings should be removed from the settings UI/data contract.");
  assert(!settings.includes("weatherOnlineProvider"), "Weather provider settings should be removed.");
  assert(!view.includes("renderTimeWeatherModule"), "The right-side time/weather module renderer should be removed.");
  assert(!view.includes("fetchAndCacheCurrentWeather"), "Timeline view should not call weather network fetches.");
  assert(!view.includes("readCachedWeather"), "Timeline view should not read weather cache for a visible module.");
  assert(!main.includes("WeatherRepository"), "Plugin should not initialize the weather repository while weather UI is closed.");
  assert(!styles.includes("fishbone-time-weather"), "Old right-side time/weather module styles should be removed.");
  assert(!fs.existsSync(path.join(root, "plugin/src/data/weatherRepository.ts")), "Weather repository should be removed while weather is closed.");
  assert(!view.includes("timeWeatherTimer"), "Toolbar clock timer should no longer use time/weather naming.");
  assert(!view.includes("fishbone-toolbar-task-time-button"), "Local time should not be rendered inside the task button.");

  console.log("M6.8 toolbar local time validation passed.");
}

main();
