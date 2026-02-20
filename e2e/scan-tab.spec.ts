import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

function createDesktopScanPayload(): string {
  const tempRoot = mkdtempSync(join(tmpdir(), "lanmap-scan-"));
  const desktopFile = join(tempRoot, "sample.desktop");

  // Include tab-indented content that previously broke JSON payload parsing.
  writeFileSync(
    desktopFile,
    "#!/usr/bin/env xdg-open\n\t[Desktop Entry]\n\tName=Sample\n\tExec=/usr/bin/true\n",
    "utf8"
  );

  const scriptPath = join(process.cwd(), "scripts", "scan.sh");
  return execFileSync(scriptPath, ["--root", tempRoot, "--label", "tab-host", "--address", "127.0.0.1"], {
    encoding: "utf8"
  }).trim();
}

test("imports scanner payload containing tab characters", async ({ page }) => {
  const payload = createDesktopScanPayload();

  await page.goto("/");
  await page.getByTestId("payload-input").fill(payload);
  await page.getByTestId("import-button").click();

  await expect(page.getByTestId("global-notice")).toContainText("Imported 1 entries");
  await expect(page.getByTestId("global-error")).toHaveCount(0);

  await page.getByTestId("tree-file-sample.desktop").click();
  await expect(page.getByTestId("file-content")).toContainText("Desktop Entry");
  await expect(page.getByTestId("file-content")).toContainText("Name=Sample");
});
