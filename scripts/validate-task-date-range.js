const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const view = read("plugin/src/views/FishboneTimelineView.ts");
const repository = read("plugin/src/data/taskRepository.ts");
const parser = read("plugin/src/data/taskParser.ts");
const types = read("plugin/src/data/taskTypes.ts");
const taskSchema = JSON.parse(read("schemas/task.schema.json"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((view.match(/inputEl\.type = "date"/g) || []).length >= 4, "new/edit task forms must use native date pickers");
assert(view.includes('.setName("开始日期")'), "task forms must expose a start date");
assert(view.includes('.setName("结束日期")'), "task forms must expose an end date");
assert(view.includes("结束日期不能早于开始日期"), "task forms must reject reversed date ranges");
assert(view.includes("endDate: date.length > 0 ? endDate || date : null"), "new tasks must persist an end date");
assert(view.includes("endDate: this.date.length > 0 ? this.endDate || this.date : null"), "task editor must persist an end date");
assert(repository.includes("endDate?: string | null"), "task writes must accept endDate");
assert(repository.includes("frontmatter.end_date = patch.endDate"), "task updates must write end_date frontmatter");
assert(repository.includes('`end_date: ${input.endDate ?? input.date ?? "null"}`'), "new task markdown must contain end_date");
assert(parser.includes("endDate: asNullableString(frontmatter.end_date)"), "task parser must read end_date");
assert(types.includes("endDate: string | null"), "PlanningTask must expose endDate");
assert(taskSchema.properties.end_date, "task schema must allow end_date");

console.log("Task date range validation passed.");
