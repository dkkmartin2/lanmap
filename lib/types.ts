export type PayloadCompression = "gzip-base64" | "deflate-base64";

export type RawImportEntry = {
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

export type ImportPayloadData = {
  version: "1";
  generatedAt: string;
  rootPath: string;
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
};

export type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "dir";
  children: TreeNode[];
};
