import { inflateSync, gunzipSync } from "node:zlib";

import { isHiddenPath, normalizeImportPath } from "@/lib/path-utils";
import type { DecodedPayload, ImportPayloadData, RawImportEntry } from "@/lib/types";

const PAYLOAD_PREFIX = "LANMAP1:";

function decodeBuffer(compression: string, rawBody: string): Buffer {
  const source = Buffer.from(rawBody, "base64");

  if (compression === "gzip-base64") {
    return gunzipSync(source);
  }

  if (compression === "deflate-base64") {
    return inflateSync(source);
  }

  throw new Error(`Unsupported compression method: ${compression}`);
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function validateEntry(raw: RawImportEntry): RawImportEntry {
  const path = normalizeImportPath(ensureString(raw.path, "entry.path"));
  const name = ensureString(raw.name, "entry.name");

  if (raw.type !== "file" && raw.type !== "dir") {
    throw new Error(`Invalid entry.type for path ${path}`);
  }

  if (raw.type === "dir" && raw.content) {
    throw new Error(`Directory entry cannot contain content: ${path}`);
  }

  if (
    raw.contentType !== undefined &&
    raw.contentType !== "text" &&
    raw.contentType !== "binary" &&
    raw.contentType !== "none"
  ) {
    throw new Error(`Invalid contentType for path ${path}`);
  }

  if (raw.size !== undefined && (!Number.isFinite(raw.size) || raw.size < 0)) {
    throw new Error(`Invalid size for path ${path}`);
  }

  if (raw.mtime !== undefined) {
    const timestamp = Date.parse(raw.mtime);
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid mtime for path ${path}`);
    }
  }

  if (raw.type === "dir" && raw.contentType && raw.contentType !== "none") {
    throw new Error(`Directory contentType must be none: ${path}`);
  }

  return {
    ...raw,
    path,
    name,
    isHidden: raw.isHidden ?? isHiddenPath(path),
    contentType: raw.contentType ?? (raw.type === "dir" ? "none" : "binary"),
    content: raw.content ?? null,
    sha256: raw.sha256 ?? null
  };
}

function validatePayloadShape(value: unknown): ImportPayloadData {
  if (typeof value !== "object" || value === null) {
    throw new Error("Payload is not an object");
  }

  const parsed = value as Partial<ImportPayloadData>;
  if (parsed.version !== "1") {
    throw new Error("Payload version must be '1'");
  }

  const generatedAt = ensureString(parsed.generatedAt, "generatedAt");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Invalid generatedAt");
  }

  const rootPath = ensureString(parsed.rootPath, "rootPath");

  if (typeof parsed.host !== "object" || parsed.host === null) {
    throw new Error("Missing host metadata");
  }

  const host = {
    label: ensureString(parsed.host.label, "host.label").trim(),
    address: ensureString(parsed.host.address, "host.address").trim()
  };

  if (!Array.isArray(parsed.entries)) {
    throw new Error("entries must be an array");
  }

  const dedupe = new Set<string>();
  const entries = parsed.entries.map((entry) => {
    const validated = validateEntry(entry);
    if (dedupe.has(validated.path)) {
      throw new Error(`Duplicate path in payload: ${validated.path}`);
    }
    dedupe.add(validated.path);
    return validated;
  });

  return {
    version: "1",
    generatedAt,
    rootPath,
    host,
    entries
  };
}

export function decodeImportPayload(payload: string): DecodedPayload {
  if (typeof payload !== "string" || payload.trim().length === 0) {
    throw new Error("Payload is required");
  }

  const trimmed = payload.trim();
  if (!trimmed.startsWith(PAYLOAD_PREFIX)) {
    throw new Error("Payload prefix must be LANMAP1:");
  }

  const segments = trimmed.split(":");
  if (segments.length < 3) {
    throw new Error("Payload format must be LANMAP1:<compression>:<base64>");
  }

  const compression = segments[1];
  const encoded = segments.slice(2).join(":");

  let decodedBuffer: Buffer;
  try {
    decodedBuffer = decodeBuffer(compression, encoded);
  } catch (error) {
    throw new Error(
      `Could not decode payload: ${error instanceof Error ? error.message : "unknown failure"}`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(decodedBuffer.toString("utf8"));
  } catch {
    throw new Error("Decoded payload is not valid JSON");
  }

  const data = validatePayloadShape(json);

  return {
    compression: compression as DecodedPayload["compression"],
    rawSize: decodedBuffer.length,
    data
  };
}
