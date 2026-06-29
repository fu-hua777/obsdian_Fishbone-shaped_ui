const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const skills = [
  "planning-task-skill",
  "obsidian-plugin-dev-skill",
  "obsidian-vault-ops-skill",
  "daily-summary-skill"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function requireText(file, patterns) {
  const content = read(file);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${file} 缺少关键文本: ${pattern}`);
  }
}

function validateSkillFiles() {
  for (const skill of skills) {
    assert(exists(`.agents/skills/${skill}/SKILL.md`), `${skill} 缺少 SKILL.md`);
    assert(exists(`.agents/skills/${skill}/agents/openai.yaml`), `${skill} 缺少 agents/openai.yaml`);
    const skillMd = read(`.agents/skills/${skill}/SKILL.md`);
    assert(skillMd.startsWith("---\nname: "), `${skill} frontmatter 格式异常`);
    assert(skillMd.includes(`name: ${skill}`), `${skill} frontmatter name 不匹配`);
    assert(skillMd.includes("description:"), `${skill} 缺少 description`);
  }
}

function validatePlanningSkill() {
  requireText(".agents/skills/planning-task-skill/SKILL.md", [
    "不要写死主线",
    "mainline: null",
    "主线列表为空",
    "先创建主线或确认任务归属",
    "relations",
    "confidence < 0.7",
    "questions"
  ]);
}

function validatePluginSkill() {
  requireText(".agents/skills/obsidian-plugin-dev-skill/SKILL.md", [
    "不要一次性开发完整规划系统",
    "主视图",
    "自定义",
    "npm run build",
    "标准任务 md",
    "relations",
    "真实 Vault"
  ]);
}

function validateVaultOpsSkill() {
  requireText(".agents/skills/obsidian-vault-ops-skill/SKILL.md", [
    "sample-vault",
    "真实 Vault",
    "备份或 commit",
    "停止并等待用户确认",
    "source_file",
    "source_excerpt",
    "relations"
  ]);
}

function validateDailySummarySkill() {
  requireText(".agents/skills/daily-summary-skill/SKILL.md", [
    "不要编造已完成事项",
    "不确定内容",
    "需要用户确认的事项",
    "relation 变化",
    "明日建议",
    "mainlines.json"
  ]);
}

function validateReplayCases() {
  const replayFiles = [
    "tests/skill-replay/planning-task-replay.json",
    "tests/skill-replay/vault-ops-replay.json",
    "tests/skill-replay/plugin-dev-replay.json",
    "tests/skill-replay/daily-summary-replay.json"
  ];

  for (const file of replayFiles) {
    const cases = readJson(file);
    assert(Array.isArray(cases) && cases.length > 0, `${file} 必须包含至少一个用例`);
    for (const item of cases) {
      assert(typeof item.case_id === "string" && item.case_id.length > 0, `${file} 存在缺少 case_id 的用例`);
      assert(skills.includes(item.skill), `${file} 的 skill 非法: ${item.skill}`);
      assert(Array.isArray(item.expected_rules) && item.expected_rules.length > 0, `${item.case_id} 缺少 expected_rules`);
    }
  }

  const planningCases = readJson("tests/skill-replay/planning-task-replay.json");
  const emptyMainlinesCase = planningCases.find((item) => item.case_id === "planning-empty-mainlines-001");
  assert(emptyMainlinesCase, "缺少 planning-empty-mainlines-001 回放用例");
  assert(Array.isArray(emptyMainlinesCase.input_context.mainlines), "planning-empty-mainlines-001 缺少 mainlines 上下文");
  assert(emptyMainlinesCase.input_context.mainlines.length === 0, "planning-empty-mainlines-001 必须验证空主线场景");
  assert(
    emptyMainlinesCase.expected_rules.some((rule) => rule.includes("mainline 必须为 null")),
    "空主线用例必须要求 mainline 为 null"
  );
}

function validateNoDefaultMainlineAssumption() {
  const planningCases = read("tests/skills/planning-task-skill-cases.md");
  const forbiddenPatterns = [
    /"mainline":\s*"项目"/,
    /"mainline":\s*"学习"/,
    /"mainline":\s*"论文"/,
    /"mainline":\s*"生活"/,
    /"mainline":\s*"健康"/,
    /"mainline":\s*"事业"/,
    /"mainline":\s*"财务"/
  ];
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(planningCases), `planning-task 测试样例仍暗示默认主线: ${pattern}`);
  }

  const m2Plan = read("PLANS/M2-skills-validation.md");
  assert(m2Plan.includes("默认没有主线"), "M2 计划必须明确默认没有主线");
  assert(m2Plan.includes("不能把概念图中的健康、学习、事业、生活、财务当作系统默认主线"), "M2 计划必须禁止概念图主线默认化");
}

function validateMainlinesDefaultState() {
  const mainlines = readJson("sample-vault/PlanningSystem/Mainlines/mainlines.json");
  assert(Array.isArray(mainlines.mainlines), "mainlines.json 的 mainlines 必须是数组");
  assert(mainlines.mainlines.length === 0, "M2 要求当前默认主线为空数组");
}

function main() {
  validateSkillFiles();
  validatePlanningSkill();
  validatePluginSkill();
  validateVaultOpsSkill();
  validateDailySummarySkill();
  validateReplayCases();
  validateNoDefaultMainlineAssumption();
  validateMainlinesDefaultState();
  console.log("M2 skill validation passed.");
}

main();
