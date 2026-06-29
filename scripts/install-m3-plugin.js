const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const testVault = process.env.FISHBONE_TEST_VAULT || "E:\\主线规划\\主线规划";
const pluginSource = path.join(root, "plugin");
const pluginTarget = path.join(testVault, ".obsidian", "plugins", "obsidian-fishbone-planner");
const planningSource = path.join(root, "sample-vault", "PlanningSystem");
const planningTarget = path.join(testVault, "PlanningSystem");

function assertExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function main() {
  assertExists(testVault, `测试 Vault 不存在: ${testVault}`);
  assertExists(path.join(testVault, ".obsidian"), `目标不是 Obsidian Vault，缺少 .obsidian: ${testVault}`);
  assertExists(path.join(pluginSource, "main.js"), "缺少 plugin/main.js，请先运行 npm run build");
  assertExists(path.join(pluginSource, "manifest.json"), "缺少 plugin/manifest.json");
  assertExists(path.join(pluginSource, "styles.css"), "缺少 plugin/styles.css");

  copyRecursive(planningSource, planningTarget);
  fs.mkdirSync(pluginTarget, { recursive: true });
  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    fs.copyFileSync(path.join(pluginSource, file), path.join(pluginTarget, file));
  }

  console.log(`Installed PlanningSystem to ${planningTarget}`);
  console.log(`Installed plugin to ${pluginTarget}`);
}

main();
