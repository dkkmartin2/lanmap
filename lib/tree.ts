import type { FileNode, FileNodeType } from "@prisma/client";

import { parentPath } from "@/lib/path-utils";
import type { TreeNode } from "@/lib/types";

type TreeNodeMutable = TreeNode;

function normalizeType(type: FileNodeType): "file" | "dir" {
  return type === "DIR" ? "dir" : "file";
}

function makePlaceholderDirectory(path: string): TreeNodeMutable {
  const parts = path.split("/");
  return {
    id: `placeholder:${path}`,
    name: parts[parts.length - 1] ?? path,
    path,
    type: "dir",
    children: []
  };
}

export function buildTree(fileNodes: FileNode[]): TreeNode[] {
  const root: TreeNodeMutable = {
    id: "root",
    name: "/",
    path: "",
    type: "dir",
    children: []
  };

  const map = new Map<string, TreeNodeMutable>();
  map.set("", root);

  const ensureDirectory = (path: string): TreeNodeMutable => {
    if (map.has(path)) {
      return map.get(path)!;
    }

    const created = makePlaceholderDirectory(path);
    map.set(path, created);

    const parent = parentPath(path) ?? "";
    const parentNode = parent ? ensureDirectory(parent) : root;
    parentNode.children.push(created);
    return created;
  };

  for (const node of fileNodes) {
    const entry: TreeNodeMutable = {
      id: node.id,
      name: node.name,
      path: node.path,
      type: normalizeType(node.type),
      children: []
    };

    const parent = parentPath(node.path);
    const parentNode = parent ? ensureDirectory(parent) : root;
    parentNode.children.push(entry);

    if (entry.type === "dir") {
      map.set(node.path, entry);
    }
  }

  const sortNodes = (nodes: TreeNodeMutable[]): void => {
    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "dir" ? -1 : 1;
    });

    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root.children);
  return root.children;
}
