import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const TIME_ZONE = process.env.DEFAULT_TIMEZONE ?? "Asia/Jakarta";
const TASK_NAME = "E2E Detailed Task";

function todayInZone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

interface ApiTask {
  id: string;
  name: string;
  categoryId: string;
  startedAt: string | null;
  priority: string;
}

test("task details: show on Today and Timeline, edit via dialog, no data loss", async ({
  page,
}) => {
  await login(page);
  const today = todayInZone();

  // Seed a task with details through the API.
  const catRes = await page.request.get("/api/categories");
  expect(catRes.ok()).toBe(true);
  const categories = (await catRes.json()) as { id: string; name: string }[];
  const website = categories.find((c) => c.name === "Website Management");
  const other = categories.find((c) => c.name === "Other Tasks");
  expect(website, "Website Management category").toBeTruthy();
  expect(other, "Other Tasks category").toBeTruthy();

  const created = await page.request.post("/api/tasks", {
    data: {
      name: TASK_NAME,
      categoryId: website!.id,
      priority: "high",
      description: "Prepare slides",
      dueAt: `${today}T23:59:59Z`,
    },
  });
  expect(created.ok()).toBe(true);

  async function findTask(): Promise<ApiTask> {
    const res = await page.request.get("/api/tasks");
    expect(res.ok()).toBe(true);
    const task = ((await res.json()) as ApiTask[]).find((t) => t.name === TASK_NAME);
    expect(task, "seeded task is listed").toBeTruthy();
    return task!;
  }
  const taskId = (await findTask()).id;

  // Today: reload so Today's Focus fetches the freshly created task, then clock in and start the task from its Today's Focus row.
  await page.goto("/");
  await page.getByTestId("clock-in").click();
  await expect(page.getByTestId("break-start")).toBeVisible({ timeout: 10_000 });

  const focusCard = page.getByTestId("today-tasks-card");
  await expect(focusCard).toContainText(TASK_NAME, { timeout: 15_000 });
  await focusCard.locator(`button[title='Start tracking "${TASK_NAME}"']`).click();

  // Scope badge locators to the active card: Focus rows may render their own badges.
  const activeCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByTestId("active-timer") });
  await expect(activeCard).toBeVisible({ timeout: 10_000 });
  await expect(activeCard.getByTestId("active-task-description")).toContainText(
    "Prepare slides",
    { timeout: 10_000 },
  );
  await expect(activeCard.getByTestId("task-priority-badge")).toHaveText("High");
  await expect(activeCard.getByTestId("task-due-badge")).toContainText("Due today");

  // Edit the priority from the active card through the task dialog.
  await activeCard.getByTestId("active-task-details").click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("task-dialog-priority").click();
  await page.getByRole("option", { name: /Urgent/ }).click();
  await dialog.getByTestId("task-dialog-save").click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(activeCard.getByTestId("task-priority-badge")).toHaveText("Urgent", {
    timeout: 10_000,
  });

  // Regression: saving the dialog must not wipe tasks.started_at.
  const afterSave = await findTask();
  expect(afterSave.priority).toBe("urgent");
  expect(afterSave.startedAt).not.toBeNull();

  await page.getByTestId("stop-task").click();
  await page.getByTestId("stop-task-confirm").click();
  await expect(page.getByTestId("active-timer")).toBeHidden({ timeout: 10_000 });

  // Category regression: make the task's category differ from the entry's.
  const patch = await page.request.patch(`/api/tasks/${taskId}`, {
    data: { categoryId: other!.id },
  });
  expect(patch.ok()).toBe(true);
  // A PATCH without startedAt must not clear it either (schema regression).
  expect((await findTask()).startedAt).not.toBeNull();

  const dayBeforeRes = await page.request.get(`/api/days/${today}`);
  expect(dayBeforeRes.ok()).toBe(true);
  const dayBefore = (await dayBeforeRes.json()) as {
    timeEntries: { taskName: string; categoryKey: string }[];
  };
  const entryBefore = dayBefore.timeEntries.find((e) => e.taskName === TASK_NAME);
  expect(entryBefore, "time entry for the task").toBeTruthy();

  // Timeline: entry card shows the details and opens the dialog.
  await page.getByTestId("nav-timeline").click();
  await expect(page).toHaveURL(/\/timeline/, { timeout: 15_000 });

  const entryCard = page
    .locator('[data-testid="timeline"] > li')
    .filter({ has: page.getByTestId("open-task-details") });
  await expect(entryCard).toHaveCount(1, { timeout: 15_000 });
  await expect(entryCard).toContainText(TASK_NAME);
  await expect(entryCard.getByTestId("task-priority-badge")).toHaveText("Urgent");
  await expect(entryCard.getByTestId("task-notes")).toContainText("Prepare slides");

  await entryCard.getByTestId("open-task-details").click();
  const taskDialog = page.locator('[role="dialog"]');
  await expect(taskDialog).toBeVisible();
  await expect(taskDialog.locator("#task-name")).toHaveValue(TASK_NAME);
  // The category picker marks the selected option with the primary border.
  await expect(taskDialog.getByRole("button", { name: "Other Tasks" })).toHaveClass(
    /border-primary\/60/,
  );
  await expect(taskDialog.getByRole("button", { name: "Website Management" })).not.toHaveClass(
    /border-primary\/60/,
  );
  await expect(taskDialog.getByRole("button", { name: /delete/i })).toHaveCount(0);

  // Save without changes: neither the task nor the entry category may change.
  await taskDialog.getByTestId("task-dialog-save").click();
  await expect(taskDialog).toBeHidden({ timeout: 10_000 });

  const finalTask = await findTask();
  expect(finalTask.categoryId).toBe(other!.id);
  expect(finalTask.startedAt).not.toBeNull();

  const dayAfterRes = await page.request.get(`/api/days/${today}`);
  const dayAfter = (await dayAfterRes.json()) as {
    timeEntries: { taskName: string; categoryKey: string }[];
  };
  const entryAfter = dayAfter.timeEntries.find((e) => e.taskName === TASK_NAME);
  expect(entryAfter?.categoryKey).toBe(entryBefore!.categoryKey);
});
