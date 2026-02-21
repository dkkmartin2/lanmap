import { FileContentType, FileNodeType } from "@prisma/client";
import { dirname } from "node:path";

import { decodeImportPayload } from "@/lib/payload";
import { prisma } from "@/lib/prisma";

type ImportResult = {
  hostId: string;
  importedCount: number;
  skippedCount: number;
  warnings: string[];
};

function mapNodeType(type: "file" | "dir"): FileNodeType {
  return type === "dir" ? FileNodeType.DIR : FileNodeType.FILE;
}

function mapContentType(type: "text" | "binary" | "none"): FileContentType {
  if (type === "text") {
    return FileContentType.TEXT;
  }
  if (type === "binary") {
    return FileContentType.BINARY;
  }
  return FileContentType.NONE;
}

export async function importPayload(payload: string): Promise<ImportResult> {
  const decoded = decodeImportPayload(payload);
  const { data } = decoded;
  const runPath = data.runPath ?? data.rootPath;
  const runParentPath = data.runParentPath ?? dirname(runPath);

  const warnings: string[] = [];

  const host = await prisma.host.upsert({
    where: { address: data.host.address },
    update: { label: data.host.label },
    create: {
      label: data.host.label,
      address: data.host.address
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.fileNode.deleteMany({ where: { hostId: host.id } });

    const batchSize = 300;
    for (let index = 0; index < data.entries.length; index += batchSize) {
      const chunk = data.entries.slice(index, index + batchSize);
      await tx.fileNode.createMany({
        data: chunk.map((entry) => {
          const resolvedContentType =
            entry.contentType ?? (entry.type === "dir" ? "none" : entry.content ? "text" : "binary");

          if (entry.type === "dir" && entry.content) {
            warnings.push(`Directory had content and was ignored: ${entry.path}`);
          }

          return {
            hostId: host.id,
            path: entry.path,
            name: entry.name,
            type: mapNodeType(entry.type),
            size: entry.size ?? null,
            mtime: entry.mtime ? new Date(entry.mtime) : null,
            isHidden: Boolean(entry.isHidden),
            contentType: mapContentType(resolvedContentType),
            content: entry.type === "file" && resolvedContentType === "text" ? entry.content : null,
            sha256: entry.sha256
          };
        })
      });
    }

    await tx.importRun.create({
      data: {
        hostId: host.id,
        version: data.version,
        generatedAt: new Date(data.generatedAt),
        rootPath: data.rootPath,
        runPath,
        runParentPath,
        entryCount: data.entries.length,
        payloadSize: decoded.rawSize,
        warnings: warnings.length > 0 ? warnings.join("\n") : null
      }
    });
  });

  return {
    hostId: host.id,
    importedCount: data.entries.length,
    skippedCount: 0,
    warnings
  };
}
