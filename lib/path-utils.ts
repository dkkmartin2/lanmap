export function normalizeImportPath(input: string): string {
  const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/").trim();

  if (!normalized) {
    throw new Error("Empty path is not allowed");
  }

  if (normalized.startsWith("/")) {
    throw new Error(`Absolute path is not allowed: ${input}`);
  }

  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Unsafe path detected: ${input}`);
  }

  return parts.join("/");
}

export function isHiddenPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

export function parentPath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length <= 1) {
    return null;
  }
  return parts.slice(0, -1).join("/");
}
