import { FileContentType, FileNodeType, type FileNode, type Host } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ContextPackChunkPreset,
  ContextPackPart,
  ContextPackRequest,
  ContextPackResponse,
  ContextPackSnippetMode
} from "@/lib/types";

const CHUNK_PRESET_LIMITS: Record<ContextPackChunkPreset, number> = {
  small: 12_000,
  medium: 24_000,
  large: 40_000
};

const COMPACT_SNIPPET_LIMIT = 700;

const PRIORITY_HINTS = [
  ".env",
  "credential",
  "password",
  "secret",
  "token",
  "key",
  "id_rsa",
  "id_ed25519",
  ".ssh",
  "history",
  "config",
  "kube",
  "aws",
  "docker",
  "backup",
  "readme",
  "todo",
  "notes"
];

type PackBlock = {
  text: string;
  snippetCount: number;
};

export class ContextPackError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function formatBytes(value: number | null): string {
  if (value === null || value < 0) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString() : "-";
}

function normalizeTextForPack(input: string): string {
  return input.replaceAll("\r", "").replaceAll("\u0000", "");
}

function compactSnippet(input: string): { text: string; truncated: boolean } {
  const normalized = normalizeTextForPack(input);
  if (normalized.length <= COMPACT_SNIPPET_LIMIT) {
    return { text: normalized, truncated: false };
  }

  return {
    text: `${normalized.slice(0, COMPACT_SNIPPET_LIMIT)}\n...[compact snippet truncated]`,
    truncated: true
  };
}

function escapeFence(input: string): string {
  return input.replaceAll("~~~", "~ ~ ~");
}

function scorePath(path: string): number {
  const lower = path.toLowerCase();
  let score = 0;

  for (const hint of PRIORITY_HINTS) {
    if (lower.includes(hint)) {
      score += 12;
    }
  }

  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    score += 3;
  }

  if (lower.includes("/etc/") || lower.includes("/home/")) {
    score += 2;
  }

  return score;
}

function buildTreeLines(nodes: FileNode[]): string[] {
  return nodes.map((node) => {
    const depth = Math.max(0, node.path.split("/").length - 1);
    const indent = "  ".repeat(Math.min(depth, 8));
    const marker = node.type === FileNodeType.DIR ? "[D]" : "[F]";
    return `${indent}- ${marker} ${node.name}`;
  });
}

function splitForChunkLimit(content: string, maxChars: number): string[] {
  if (content.length <= maxChars) {
    return [content];
  }

  const parts: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      parts.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxChars);
    if (splitAt < 200) {
      splitAt = maxChars;
    }

    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return parts;
}

function chunkPackBlocks(blocks: PackBlock[], maxChars: number): PackBlock[] {
  const parts: PackBlock[] = [];
  let currentText = "";
  let currentSnippets = 0;

  const pushCurrent = (): void => {
    const trimmed = currentText.trim();
    if (!trimmed) {
      return;
    }

    parts.push({
      text: trimmed,
      snippetCount: currentSnippets
    });

    currentText = "";
    currentSnippets = 0;
  };

  for (const block of blocks) {
    const pieces = splitForChunkLimit(`${block.text.trim()}\n\n`, maxChars);
    let countedSnippet = false;

    for (const piece of pieces) {
      const normalizedPiece = `${piece.trim()}\n\n`;
      if (normalizedPiece.length > maxChars) {
        // Safety fallback for extremely long unbroken lines.
        let start = 0;
        while (start < normalizedPiece.length) {
          const segment = normalizedPiece.slice(start, start + maxChars);
          if (currentText.length + segment.length > maxChars) {
            pushCurrent();
          }
          currentText += segment;
          if (block.snippetCount > 0 && !countedSnippet) {
            currentSnippets += block.snippetCount;
            countedSnippet = true;
          }
          pushCurrent();
          start += maxChars;
        }
        continue;
      }

      if (currentText.length + normalizedPiece.length > maxChars) {
        pushCurrent();
      }

      currentText += normalizedPiece;

      if (block.snippetCount > 0 && !countedSnippet) {
        currentSnippets += block.snippetCount;
        countedSnippet = true;
      }
    }
  }

  pushCurrent();
  return parts.length > 0 ? parts : [{ text: "No data available.", snippetCount: 0 }];
}

function buildHeader(host: Host, generatedAt: string, partIndex: number, total: number, mode: ContextPackSnippetMode, preset: ContextPackChunkPreset): string {
  return [
    "# LanMap Context Pack",
    "",
    `Host: ${host.label} (${host.address})`,
    `Generated: ${generatedAt}`,
    `Part: ${partIndex + 1}/${total}`,
    `Snippet mode: ${mode}`,
    `Chunk preset: ${preset}`,
    ""
  ].join("\n");
}

export async function generateContextPack(request: ContextPackRequest): Promise<ContextPackResponse> {
  if (!request.hostId || typeof request.hostId !== "string") {
    throw new ContextPackError("hostId is required", 400);
  }

  const snippetMode: ContextPackSnippetMode = request.snippetMode ?? "compact";
  const chunkPreset: ContextPackChunkPreset = request.chunkPreset ?? "medium";

  if (!["compact", "full"].includes(snippetMode)) {
    throw new ContextPackError("Invalid snippet mode", 400);
  }

  if (!["small", "medium", "large"].includes(chunkPreset)) {
    throw new ContextPackError("Invalid chunk preset", 400);
  }

  const host = await prisma.host.findUnique({ where: { id: request.hostId } });
  if (!host) {
    throw new ContextPackError("Host not found", 404);
  }

  const nodes = await prisma.fileNode.findMany({
    where: { hostId: request.hostId },
    orderBy: { path: "asc" }
  });

  const files = nodes.filter((node) => node.type === FileNodeType.FILE);
  const directories = nodes.filter((node) => node.type === FileNodeType.DIR);
  const textFiles = files.filter((node) => node.contentType === FileContentType.TEXT && typeof node.content === "string");
  const binaryFiles = files.filter((node) => node.contentType === FileContentType.BINARY);
  const hiddenEntries = nodes.filter((node) => node.isHidden).length;

  const generatedAt = new Date().toISOString();
  const maxChars = CHUNK_PRESET_LIMITS[chunkPreset];

  const summaryBlock: PackBlock = {
    snippetCount: 0,
    text: [
      "## Host Summary",
      `- Total entries: ${nodes.length}`,
      `- Directories: ${directories.length}`,
      `- Files: ${files.length}`,
      `- Text files: ${textFiles.length}`,
      `- Binary files: ${binaryFiles.length}`,
      `- Hidden entries: ${hiddenEntries}`,
      ""
    ].join("\n")
  };

  const priorityPaths = [...files]
    .sort((a, b) => {
      const scoreDiff = scorePath(b.path) - scorePath(a.path);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.path.localeCompare(b.path);
    })
    .slice(0, 60);

  const priorityBlock: PackBlock = {
    snippetCount: 0,
    text: [
      "## Priority Paths",
      ...priorityPaths.map((node) => `- \`${node.path}\` (${node.contentType.toLowerCase()})`),
      ""
    ].join("\n")
  };

  const treeLines = buildTreeLines(nodes);
  const treeBlock: PackBlock = {
    snippetCount: 0,
    text: ["## Directory Tree", "~~~text", ...treeLines, "~~~", ""].join("\n")
  };

  const inventoryBlock: PackBlock = {
    snippetCount: 0,
    text: [
      "## File Inventory",
      ...nodes.map(
        (node) =>
          `- \`${node.path}\` | ${node.type === FileNodeType.DIR ? "dir" : "file"} | ${formatBytes(node.size)} | ${formatDate(node.mtime)} | ${node.contentType.toLowerCase()}`
      ),
      ""
    ].join("\n")
  };

  let truncatedFiles = 0;

  const snippetBlocks: PackBlock[] = [
    {
      snippetCount: 0,
      text: "## Key Text Snippets"
    }
  ];

  const snippetCandidates = [...textFiles].sort((a, b) => {
    const scoreDiff = scorePath(b.path) - scorePath(a.path);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.path.localeCompare(b.path);
  });

  for (const node of snippetCandidates) {
    const source = node.content ?? "";
    const snippet = snippetMode === "compact" ? compactSnippet(source) : { text: normalizeTextForPack(source), truncated: false };
    if (snippet.truncated) {
      truncatedFiles += 1;
    }

    snippetBlocks.push({
      snippetCount: 1,
      text: [
        `### ${node.path}`,
        "~~~text",
        escapeFence(snippet.text),
        "~~~",
        ""
      ].join("\n")
    });
  }

  const blockParts = chunkPackBlocks(
    [summaryBlock, priorityBlock, treeBlock, inventoryBlock, ...snippetBlocks],
    maxChars
  );

  const parts: ContextPackPart[] = blockParts.map((part, index) => {
    const header = buildHeader(host, generatedAt, index, blockParts.length, snippetMode, chunkPreset);
    const content = `${header}${part.text.trimEnd()}\n`;

    return {
      index: index + 1,
      total: blockParts.length,
      content,
      stats: {
        files: files.length,
        snippetCount: part.snippetCount,
        chars: content.length
      }
    };
  });

  return {
    parts,
    summary: {
      hostId: host.id,
      generatedAt,
      truncatedFiles
    }
  };
}
