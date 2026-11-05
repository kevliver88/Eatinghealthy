import { test, expect } from "@playwright/test";
test("mobile manual workflow, reload, sample separation, export, import and deletion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Log food", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await page.getByLabel("Meal name", { exact: true }).fill("Test lunch");
  await page.getByLabel("Calories per portion").fill("400");
  await page.getByLabel("Protein per portion").fill("25");
  await page.getByLabel("Portions", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Entry saved");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Food", exact: true })
    .click();
  await expect(
    page.getByText("Test lunch × 1.5", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".record")).toContainText("600");
  await expect(page.locator(".record")).toContainText("38 g protein");
  await page.getByRole("button", { name: "Sample data", exact: true }).click();
  await expect(page.getByText("Test lunch × 1.5", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Exit sample" }).click();
  await expect(
    page.getByText("Test lunch × 1.5", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Weight", exact: true })
    .click();
  await page.getByRole("button", { name: "Log weight", exact: true }).click();
  await page.getByLabel("Value (kg)", { exact: true }).fill("80");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".record")).toContainText("80.0");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Training", exact: true })
    .click();
  await page.getByRole("button", { name: "Log activity" }).click();
  await page.getByLabel("Value (km)", { exact: true }).fill("5");
  await page.getByLabel("Duration (minutes)").fill("30");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".record")).toContainText("6:00 /km");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON backup" }).click();
  const backup = await downloaded;
  expect(backup.suggestedFilename()).toContain("stride-backup");
  const backupPath = (await backup.path())!;
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "kind,date,value,unit,name\nweight,2026-01-01,81,kg,Imported weight\n",
      ),
    });
  await expect(
    page.getByText("1 valid records · 0 errors · 0 duplicates to skip"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(page.getByRole("status")).toContainText("1 entries imported");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "kind,date,value,unit,name\nweight,2026-01-01,81,kg,Imported weight\n",
      ),
    });
  await expect(
    page.getByText("1 valid records · 0 errors · 1 duplicates to skip"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete all data", exact: true })
    .click();
  await page.getByLabel("Confirmation", { exact: true }).fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page.getByRole("status")).toContainText("deleted");
  await page.locator("input[type=file]").setInputFiles(backupPath);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Replace with backup" }).click();
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Food", exact: true })
    .click();
  await expect(
    page.getByText("Test lunch × 1.5", { exact: true }),
  ).toBeVisible();
});
test("offline shell and responsive sample dashboard", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.getByRole("button", { name: "Sample data", exact: true }).click();
  await expect(page.getByText("Exit sample")).toBeVisible();
  await page.screenshot({ path: "/tmp/stride-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: "/tmp/stride-desktop.png", fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "One day stronger." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log food", exact: true }),
  ).toBeEnabled();
});
test("saved meal edits and invalid import protection", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Food", exact: true })
    .click();
  const preset = page.locator(".preset").first();
  await preset.getByText("Edit preset", { exact: true }).click();
  await preset
    .getByLabel("Meal name", { exact: true })
    .fill("My verified breakfast");
  await preset.getByLabel("Calories · optional").fill("450");
  await preset.getByLabel("Protein g · optional").fill("35");
  await preset.getByRole("button", { name: "Save meal preset" }).click();
  await expect(preset.getByRole("heading")).toHaveText("My verified breakfast");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Food", exact: true })
    .click();
  await page
    .locator(".preset")
    .first()
    .getByRole("button", { name: "Log portion" })
    .click();
  await expect(page.getByLabel("Calories per portion")).toHaveValue("450");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".record")).toContainText("My verified breakfast");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('[{"kind":"weight","date":"2026-02-30","value":80}]'),
    });
  await expect(
    page.getByRole("button", { name: "Confirm merge" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Import blocked");
});
