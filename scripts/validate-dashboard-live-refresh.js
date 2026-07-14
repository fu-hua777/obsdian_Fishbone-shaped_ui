const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "plugin/src/main.ts"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(main.includes('this.app.vault.on("create"'), "must refresh after planning files are created");
assert(main.includes('this.app.vault.on("modify"'), "must refresh after planning files are modified");
assert(main.includes('this.app.vault.on("delete"'), "must refresh after planning files are deleted");
assert(main.includes('this.app.vault.on("rename"'), "must refresh after planning files are renamed");
assert(main.includes('this.app.metadataCache.on("changed"'), "task refresh must wait for current frontmatter metadata");
assert(main.includes('normalizedPath === `${root}/Mainlines/mainlines.json`'), "must watch the mainline source file");
assert(main.includes('normalizedPath.startsWith(`${root}/Tasks/`)'), "must watch authoritative task markdown files");
assert(main.includes("void this.refreshPlanningViews()"), "planning changes must trigger a shared view refresh");
assert(main.includes("leaf.view instanceof FishboneTimelineView"), "shared refresh must include the fishbone dashboard");
assert(main.includes("leaf.view instanceof TaskListView"), "shared refresh must include the task list");

console.log("Dashboard live refresh validation passed.");
