import { expect, test } from "@playwright/test";

test("creates a Witch Hunters draft and shows validation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new warband/i }).click();
  await expect(page.getByRole("heading", { name: /create warband/i })).toBeVisible();
  await page.getByLabel(/warband name/i).fill("The Bell and Brand");
  await expect(page.getByText(/Witch Hunter Captain/i)).toBeVisible();
  await page.getByRole("button", { name: /Witch Hunter · 25 gc/i }).click();
  await expect(page.getByText(/The Bell and Brand/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /save roster/i })).toBeVisible();
});

test("opens rules lookup from equipment picker", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new warband/i }).click();
  await page.getByRole("button", { name: /lookup dagger/i }).first().click();
  await expect(page.getByRole("dialog", { name: /dagger lookup/i })).toBeVisible();
  await expect(page.getByText(/first dagger/i)).toBeVisible();
});

test("can select a Mercenary variant in the creation wizard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new warband/i }).click();
  await page.getByLabel(/warband type/i).selectOption("marienburgers");
  await expect(page.getByText(/Marienburgers · MHR/i)).toBeVisible();
  await expect(page.getByText(/600 gc/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Champion · 35 gc/i })).toBeVisible();
});
