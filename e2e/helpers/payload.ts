import { gzipSync } from "node:zlib";

type Host = {
  label: string;
  address: string;
};

type PayloadMeta = {
  rootPath?: string;
  runPath?: string;
  runParentPath?: string;
};

type Entry = {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  mtime?: string;
  isHidden?: boolean;
  contentType?: "text" | "binary" | "none";
  content?: string | null;
  sha256?: string | null;
};

export function makePayload(host: Host, entries: Entry[], meta: PayloadMeta = {}): string {
  const data = {
    version: "1",
    generatedAt: new Date().toISOString(),
    rootPath: meta.rootPath ?? "/home/user",
    runPath: meta.runPath ?? "/home/user/projects/sample",
    runParentPath: meta.runParentPath ?? "/home/user/projects",
    host,
    entries
  };

  const json = JSON.stringify(data);
  const compressed = gzipSync(Buffer.from(json, "utf8")).toString("base64");
  return `LANMAP1:gzip-base64:${compressed}`;
}

export function uniqueAddress(prefix: string): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${stamp}-${random}`;
}
