const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const root = path.resolve(__dirname, "..");
const defaultVault = "E:\\主线规划\\主线规划";
const vaultPath = process.env.FISHBONE_REAL_VAULT || defaultVault;
const pluginId = "obsidian-fishbone-planner";
const restPluginId = "obsidian-local-rest-api";
const realPluginPath = path.join(vaultPath, ".obsidian", "plugins", pluginId);
const restSettingsPath = path.join(vaultPath, ".obsidian", "plugins", restPluginId, "data.json");
const testTaskPath = path.join(
  vaultPath,
  "PlanningSystem",
  "Tasks",
  "2026",
  "07",
  "2026-07-02_项目_M7真实闭环测试任务.md"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(match, "M7 test task is missing frontmatter.");

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    result[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

function requestJson(baseUrl, apiKey, pathname) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      `${baseUrl}${pathname}`,
      {
        method: "GET",
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`REST ${pathname} returned ${response.statusCode}.`));
            return;
          }
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.setTimeout(5000, () => {
      request.destroy(new Error(`REST ${pathname} timed out.`));
    });
    request.on("error", reject);
    request.end();
  });
}

async function validateOptionalRest() {
  if (process.env.FISHBONE_VALIDATE_REST !== "1") return;
  assert(fs.existsSync(restSettingsPath), "Local REST API settings file is missing.");
  const settings = JSON.parse(read(restSettingsPath));
  assert(settings.port, "Local REST API port is missing.");
  assert(settings.apiKey, "Local REST API key is missing.");

  const baseUrl = `https://127.0.0.1:${settings.port}`;
  const commands = await requestJson(baseUrl, settings.apiKey, "/commands/");
  const commandList = Array.isArray(commands?.commands)
    ? commands.commands
    : Array.isArray(commands)
      ? commands
      : Object.values(commands?.commands || commands || {});
  const commandIds = commandList.map(command => command.id).filter(Boolean);
  assert(
    commandIds.includes("obsidian-fishbone-planner:open-fishbone-timeline"),
    "Fishbone timeline open command is not visible through Local REST API."
  );
  assert(
    commandIds.includes("obsidian-fishbone-planner:refresh-fishbone-timeline"),
    "Fishbone timeline refresh command is not visible through Local REST API."
  );
}

async function main() {
  assert(fs.existsSync(vaultPath), `Real vault does not exist: ${vaultPath}`);
  assert(fs.existsSync(realPluginPath), "Real vault Fishbone Planner plugin folder is missing.");
  assert(fs.existsSync(path.join(realPluginPath, "manifest.json")), "Real plugin manifest is missing.");
  assert(fs.existsSync(path.join(realPluginPath, "main.js")), "Real plugin main.js is missing.");
  assert(fs.existsSync(path.join(realPluginPath, "styles.css")), "Real plugin styles.css is missing.");
  assert(fs.existsSync(restSettingsPath), "Local REST API plugin settings are missing.");

  assert(
    hash(path.join(root, "plugin", "main.js")) === hash(path.join(realPluginPath, "main.js")),
    "Real vault plugin main.js does not match repository build artifact."
  );
  assert(
    hash(path.join(root, "plugin", "styles.css")) === hash(path.join(realPluginPath, "styles.css")),
    "Real vault plugin styles.css does not match repository stylesheet."
  );

  assert(fs.existsSync(testTaskPath), "M7 real-loop test task is missing.");
  const frontmatter = parseFrontmatter(read(testTaskPath));
  assert(frontmatter.task_id === "task_20260702_m7_real_loop", "M7 test task id mismatch.");
  assert(frontmatter.title === "M7真实闭环测试任务", "M7 test task title mismatch.");
  assert(frontmatter.date === "2026-07-02", "M7 test task date mismatch.");
  assert(frontmatter.mainline === "项目", "M7 test task mainline mismatch.");
  assert(frontmatter.status === "doing", "M7 test task status should be doing after the closed-loop update.");
  assert(frontmatter.source_type === "quick-input", "M7 test task should preserve quick-input source type.");
  assert(frontmatter.source_excerpt, "M7 test task should preserve source_excerpt.");

  await validateOptionalRest();
  console.log("M7 real use loop validation passed.");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
