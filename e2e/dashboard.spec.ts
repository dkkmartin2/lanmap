import { expect, test } from "@playwright/test";

import { makePayload, uniqueAddress } from "./helpers/payload";

test.describe("LanMap dashboard e2e", () => {
  test("shows empty state and can add a host", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("No hosts yet.")).toBeVisible();

    await page.getByTestId("host-label-input").fill("Manual Host");
    await page.getByTestId("host-address-input").fill(uniqueAddress("manual-host"));
    await page.getByTestId("add-host-button").click();

    await expect(page.getByTestId("global-notice")).toContainText("Created host Manual Host");
    await expect(page.getByRole("button", { name: /Manual Host/ })).toBeVisible();
  });

  test("imports payload and reads source-code file contents", async ({ page }) => {
    const payload = makePayload(
      { label: "Code Host", address: uniqueAddress("code-host") },
      [
        {
          path: "docs",
          name: "docs",
          type: "dir",
          isHidden: false,
          contentType: "none"
        },
        {
          path: "docs/readme.md",
          name: "readme.md",
          type: "file",
          size: 18,
          mtime: new Date().toISOString(),
          isHidden: false,
          contentType: "text",
          content: "hello from markdown"
        },
        {
          path: "src/app.js",
          name: "app.js",
          type: "file",
          size: 26,
          mtime: new Date().toISOString(),
          isHidden: false,
          contentType: "text",
          content: "console.log('lanmap test');"
        },
        {
          path: "src/main.py",
          name: "main.py",
          type: "file",
          size: 31,
          mtime: new Date().toISOString(),
          isHidden: false,
          contentType: "text",
          content: "print('python payload content')"
        }
      ]
    );

    await page.goto("/");
    await page.getByTestId("payload-input").fill(payload);
    await page.getByTestId("import-button").click();

    await expect(page.getByTestId("global-notice")).toContainText("Imported 4 entries");

    await page.getByTestId("tree-file-src__app.js").click();
    await expect(page.getByTestId("file-content")).toContainText("console.log('lanmap test');");

    await page.getByTestId("tree-file-src__main.py").click();
    await expect(page.getByTestId("file-content")).toContainText("python payload content");
  });

  test("renders binary metadata without text body", async ({ page }) => {
    const payload = makePayload(
      { label: "Binary Host", address: uniqueAddress("binary-host") },
      [
        { path: "loot", name: "loot", type: "dir", contentType: "none" },
        {
          path: "loot/image.bin",
          name: "image.bin",
          type: "file",
          size: 2048,
          mtime: new Date().toISOString(),
          contentType: "binary",
          content: null,
          sha256: "abc123"
        }
      ]
    );

    await page.goto("/");
    await page.getByTestId("payload-input").fill(payload);
    await page.getByTestId("import-button").click();

    await page.getByTestId("tree-file-loot__image.bin").click();
    await expect(page.getByTestId("binary-content")).toContainText("metadata only");
    await expect(page.getByTestId("binary-content")).toContainText("abc123");
  });

  test("shows hidden files in directory tree", async ({ page }) => {
    const payload = makePayload(
      { label: "Hidden Host", address: uniqueAddress("hidden-host") },
      [
        { path: ".ssh", name: ".ssh", type: "dir", isHidden: true, contentType: "none" },
        {
          path: ".ssh/config",
          name: "config",
          type: "file",
          size: 32,
          mtime: new Date().toISOString(),
          isHidden: true,
          contentType: "text",
          content: "Host *\n  StrictHostKeyChecking no"
        }
      ]
    );

    await page.goto("/");
    await page.getByTestId("payload-input").fill(payload);
    await page.getByTestId("import-button").click();

    await expect(page.getByTestId("tree-dir-.ssh")).toBeVisible();
    await page.getByTestId("tree-file-.ssh__config").click();
    await expect(page.getByTestId("file-content")).toContainText("StrictHostKeyChecking no");
  });

  test("replaces host tree on re-import", async ({ page }) => {
    const address = uniqueAddress("replace-host");

    const payloadA = makePayload(
      { label: "Replace Host", address },
      [
        { path: "first.txt", name: "first.txt", type: "file", contentType: "text", content: "version A" }
      ]
    );

    const payloadB = makePayload(
      { label: "Replace Host", address },
      [
        { path: "second.txt", name: "second.txt", type: "file", contentType: "text", content: "version B" }
      ]
    );

    await page.goto("/");
    await page.getByTestId("payload-input").fill(payloadA);
    await page.getByTestId("import-button").click();
    await expect(page.getByTestId("tree-file-first.txt")).toBeVisible();

    await page.getByTestId("payload-input").fill(payloadB);
    await page.getByTestId("import-button").click();

    await expect(page.getByTestId("tree-file-second.txt")).toBeVisible();
    await expect(page.getByTestId("tree-file-first.txt")).toHaveCount(0);
  });

  test("handles invalid payload", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("payload-input").fill("LANMAP1:gzip-base64:not-base64");
    await page.getByTestId("import-button").click();

    await expect(page.getByTestId("global-error")).toContainText("Could not decode payload");
  });

  test("switches between hosts and keeps tree scoped", async ({ page }) => {
    const hostA = uniqueAddress("scope-a");
    const hostB = uniqueAddress("scope-b");

    await page.goto("/");

    await page.getByTestId("payload-input").fill(
      makePayload(
        { label: "Scope A", address: hostA },
        [{ path: "a.txt", name: "a.txt", type: "file", contentType: "text", content: "alpha" }]
      )
    );
    await page.getByTestId("import-button").click();

    await page.getByTestId("payload-input").fill(
      makePayload(
        { label: "Scope B", address: hostB },
        [{ path: "b.txt", name: "b.txt", type: "file", contentType: "text", content: "bravo" }]
      )
    );
    await page.getByTestId("import-button").click();

    await page.getByRole("button", { name: /Scope A/ }).click();
    await expect(page.getByTestId("tree-file-a.txt")).toBeVisible();
    await expect(page.getByTestId("tree-file-b.txt")).toHaveCount(0);

    await page.getByRole("button", { name: /Scope B/ }).click();
    await expect(page.getByTestId("tree-file-b.txt")).toBeVisible();
    await expect(page.getByTestId("tree-file-a.txt")).toHaveCount(0);
  });

  test("mobile layout still supports import and file read", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");

    await page.goto("/");
    const payload = makePayload(
      { label: "Mobile Host", address: uniqueAddress("mobile-host") },
      [{ path: "mobile.txt", name: "mobile.txt", type: "file", contentType: "text", content: "mobile text" }]
    );

    await page.getByTestId("payload-input").fill(payload);
    await page.getByTestId("import-button").click();

    await page.getByTestId("tree-file-mobile.txt").click();
    await expect(page.getByTestId("file-content")).toContainText("mobile text");
  });
});
