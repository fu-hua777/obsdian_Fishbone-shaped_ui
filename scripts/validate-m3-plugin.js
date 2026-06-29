const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const testVault = process.env.FISHBONE_TEST_VAULT || "E:\\主线规划\\主线规划";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function requireFile(relativePath) {
  assert(exists(relativePath), `缺少文件: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} 缺少关键文本: ${pattern}`);
  }
}

function validatePluginProject() {
  requireFile("plugin/manifest.json");
  requireFile("plugin/package.json");
  requireFile("plugin/tsconfig.json");
  requireFile("plugin/esbuild.config.mjs");
  requireFile("plugin/styles.css");
  requireFile("plugin/src/main.ts");
  requireFile("plugin/src/settings.ts");
  requireFile("plugin/src/data/taskTypes.ts");
  requireFile("plugin/src/data/taskParser.ts");
  requireFile("plugin/src/data/taskRepository.ts");
  requireFile("plugin/src/data/mainlineRepository.ts");
  requireFile("plugin/src/views/TaskListView.ts");

  const manifest = readJson("plugin/manifest.json");
  assert(manifest.id === "obsidian-fishbone-planner", "manifest id 不符合安装目录约定");
  assert(manifest.name === "Fishbone Planner", "manifest name 不符合预期");

  const packageJson = readJson("plugin/package.json");
  assert(packageJson.scripts && packageJson.scripts.build, "plugin/package.json 缺少 build 脚本");

  requireText("plugin/src/main.ts", [
    "registerView",
    "open-fishbone-task-list",
    "refresh-fishbone-task-data",
    "cycle-first-fishbone-task-status"
  ]);
  requireText("plugin/src/data/mainlineRepository.ts", [
    "mainlines.json",
    "readMainlinesFile",
    "mainlines: []"
  ]);
  requireText("plugin/src/views/TaskListView.ts", [
    "未分配",
    "当前没有主线",
    "切换状态",
    "打开"
  ]);
  requireText("plugin/src/data/taskRepository.ts", [
    "processFrontMatter",
    "status",
    "updated"
  ]);
}

function validateBuildOutputIfPresent() {
  const mainJs = path.join(root, "plugin", "main.js");
  if (fs.existsSync(mainJs)) {
    const stat = fs.statSync(mainJs);
    assert(stat.size > 1000, "plugin/main.js 体积异常，可能未正确构建");
  }
}

function validateInstalledVaultIfPresent() {
  if (!fs.existsSync(testVault)) {
    return;
  }
  const obsidianDir = path.join(testVault, ".obsidian");
  assert(fs.existsSync(obsidianDir), `测试 Vault 缺少 .obsidian: ${testVault}`);

  const planningDir = path.join(testVault, "PlanningSystem");
  if (fs.existsSync(planningDir)) {
    assert(fs.existsSync(path.join(planningDir, "Mainlines", "mainlines.json")), "测试 Vault PlanningSystem 缺少 mainlines.json");
    const mainlines = JSON.parse(fs.readFileSync(path.join(planningDir, "Mainlines", "mainlines.json"), "utf8"));
    assert(Array.isArray(mainlines.mainlines), "测试 Vault mainlines 必须是数组");
  }

  const pluginDir = path.join(testVault, ".obsidian", "plugins", "obsidian-fishbone-planner");
  if (fs.existsSync(pluginDir)) {
    for (const file of ["main.js", "manifest.json", "styles.css"]) {
      assert(fs.existsSync(path.join(pluginDir, file)), `测试 Vault 插件目录缺少 ${file}`);
    }
  }
}

function main() {
  validatePluginProject();
  validateBuildOutputIfPresent();
  validateInstalledVaultIfPresent();
  console.log("M3 plugin validation passed.");
}

main();
