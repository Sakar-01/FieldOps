import { expect, test } from "@playwright/test";

// A tiny valid PNG, enough for the photo upload path (compression, signing, storage, metadata).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Section 12: demo owner creates and assigns a job; demo technician starts and completes it. */
test("demo owner books a job and the demo technician completes it", async ({ browser }) => {
  const title = `Smoke test ${Date.now()}`;

  // Owner, desktop
  const owner = await browser.newPage();
  await owner.goto("/login");
  await owner.getByRole("button", { name: "Try as Owner" }).click();
  await expect(owner.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await owner.goto("/jobs/new");
  await owner.getByRole("combobox", { name: "Customer" }).click();
  await owner.getByRole("option").first().click();
  await owner.getByLabel("Title").fill(title);
  // Seeded slots end at 16:30, so this evening window is free for the demo technician.
  await owner.getByLabel("Start").fill("18:00");
  await owner.getByLabel("End").fill("19:00");
  await owner.getByRole("combobox", { name: "Technician" }).click();
  await owner.getByRole("option", { name: "Ravi Kumar" }).click();
  await owner.getByRole("button", { name: "Create job" }).click();
  await expect(owner).toHaveURL(/\/jobs\/[a-f0-9]{24}$/);
  await expect(owner.getByText("Scheduled", { exact: true })).toBeVisible();
  const jobUrl = owner.url();

  // Technician, phone
  const techContext = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const tech = await techContext.newPage();
  await tech.goto("/login");
  await tech.getByRole("button", { name: "Try as Technician" }).click();
  await expect(tech.getByRole("heading", { name: "Today's jobs" })).toBeVisible();
  await tech.getByRole("link", { name: new RegExp(title) }).click();

  await tech.getByRole("button", { name: "Start job" }).click();
  await expect(tech.getByRole("button", { name: "Complete job" })).toBeDisabled();

  const chooser = tech.waitForEvent("filechooser");
  await tech.getByRole("button", { name: "Add after photo" }).click();
  await (await chooser).setFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
  await expect(tech.getByRole("img", { name: "After photo" })).toBeVisible();

  await tech.getByRole("button", { name: "Capture customer signature" }).click();
  const pad = tech.getByLabel("Signature area");
  const box = (await pad.boundingBox())!;
  await tech.mouse.move(box.x + 20, box.y + box.height / 2);
  await tech.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await tech.mouse.move(box.x + 20 + i * 25, box.y + box.height / 2 + (i % 2 ? 30 : -30));
  }
  await tech.mouse.up();
  await tech.getByRole("button", { name: "Save signature" }).click();
  await expect(tech.getByRole("img", { name: "Customer signature" })).toBeVisible();

  await tech.getByRole("button", { name: "Complete job" }).click();
  await expect(tech.getByText("Completed", { exact: true })).toBeVisible();

  // Back on the owner's screen: completed, with the PDF available.
  await owner.goto(jobUrl);
  await expect(owner.getByText("Completed", { exact: true })).toBeVisible();
  const pdf = await owner.request.get(`${jobUrl.replace("/jobs/", "/api/jobs/")}/report`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
