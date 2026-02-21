export type PayloadCompression = "gzip-base64" | "deflate-base64";

export type RawImportEntry = {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number | null;
  mtime?: string | null;
  isHidden?: boolean;
  contentType?: "text" | "binary" | "none";
  content?: string | null;
  sha256?: string | null;
};

export type ImportPayloadData = {
  version: "1";
  generatedAt: string;
  rootPath: string;
  runPath?: string;
  runParentPath?: string;
  host: {
    label: string;
    address: string;
  };
  entries: RawImportEntry[];
};

export type DecodedPayload = {
  compression: PayloadCompression;
  rawSize: number;
  data: ImportPayloadData;
};

export type HostListItem = {
  id: string;
  label: string;
  address: string;
  updatedAt: string;
  fileCount: number;
  rootPath: string | null;
  runPath: string | null;
  runParentPath: string | null;
  importedAt: string | null;
};

export type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "dir";
  children: TreeNode[];
};

export type ContextPackSnippetMode = "compact" | "full";
export type ContextPackChunkPreset = "small" | "medium" | "large";

export type ContextPackRequest = {
  hostId: string;
  snippetMode?: ContextPackSnippetMode;
  chunkPreset?: ContextPackChunkPreset;
};

export type ContextPackPart = {
  index: number;
  total: number;
  content: string;
  stats: {
    files: number;
    snippetCount: number;
    chars: number;
  };
};

export type ContextPackResponse = {
  parts: ContextPackPart[];
  summary: {
    hostId: string;
    generatedAt: string;
    truncatedFiles: number;
  };
};
