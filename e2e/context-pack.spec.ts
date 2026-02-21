import { expect, test } from "@playwright/test";

import { makePayload, uniqueAddress } from "./helpers/payload";

test.describe("Context pack", () => {
  test("generates chunked pack and supports compact/full snippets", async ({ page }) => {
    const hostLabel = `Pack Host ${Date.now().toString(36)}`;
    const longA = `A-${"alpha ".repeat(5000)}tail-a`;
    const longB = `B-${"beta ".repeat(5000)}tail-b`;
    const longC = `C-${"gamma ".repeat(5000)}tail-c`;

    const payload = makePayload(
      { label: hostLabel, address: uniqueAddress("pack-host") },
      [
        { path: "loot", name: "loot", type: "dir", contentType: "none" },
        {
          path: "loot/a.txt",
          name: "a.txt",
          type: "file",
          contentType: "text",
          content: longA
        },
        {
          path: "loot/b.txt",
          name: "b.txt",
          type: "file",
          contentType: "text",
          content: longB
        },
        {
          path: "loot/c.txt",
          name: "c.txt",
          type: "file",
          contentType: "text",
          content: longC
        }
      ]
    );

    await page.goto("/");
    await page.getByTestId("payload-input").fill(payload);
    await page.getByTestId("import-button").click();

    await page.getByTestId("context-pack-open").click();
    await expect(page.getByTestId("context-pack-modal")).toBeVisible();

    await page.getByTestId("context-pack-chunk-preset").selectOption("small");
    await page.getByTestId("context-pack-snippet-mode").selectOption("compact");
    await page.getByTestId("context-pack-generate").click();

    await expect(page.getByTestId("global-notice")).toContainText("Generated");
    await expect(page.getByTestId("context-pack-tab-1")).toBeVisible();
    await expect(page.getByTestId("context-pack-tab-2")).toBeVisible();

    const compactTabCount = await page.locator('[data-testid^="context-pack-tab-"]').count();
    let foundCompactMarker = false;

    for (let index = 1; index <= compactTabCount; index += 1) {
      await page.getByTestId(`context-pack-tab-${index}`).click();
      const partContent = await page.getByTestId("context-pack-content").inputValue();
      if (partContent.includes("[compact snippet truncated]")) {
        foundCompactMarker = true;
        break;
      }
    }

    expect(foundCompactMarker).toBeTruthy();

    await page.getByTestId("context-pack-snippet-mode").selectOption("full");
    await page.getByTestId("context-pack-generate").click();

    await expect(page.getByTestId("context-pack-content")).toContainText("Snippet mode: full");
  });
});
