import { test, expect } from "@playwright/test";

test("home page should have correct heading", async ({ page }) => {
  await page.goto("/");
  // Checking for the big heading in the landing page
  const h1 = page.locator("h1");
  await expect(h1).toContainText("EXPLORE YOUR");
  await expect(h1).toContainText("CODEBASE.");
});
