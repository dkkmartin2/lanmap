"use client";

import type { JSX } from "react";

import type { TreeNode } from "@/lib/types";

type TreeViewProps = {
  nodes: TreeNode[];
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
};

function TreeBranch({
  node,
  selectedFileId,
  onFileSelect
}: {
  node: TreeNode;
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
}): JSX.Element {
  if (node.type === "file") {
    return (
      <li>
        <button
          className={`tree-file ${selectedFileId === node.id ? "active" : ""}`}
          type="button"
          data-testid={`tree-file-${node.path.replaceAll("/", "__")}`}
          onClick={() => onFileSelect(node.id)}
        >
          {node.name}
        </button>
      </li>
    );
  }

  return (
    <li>
      <details open>
        <summary className="tree-dir" data-testid={`tree-dir-${node.path.replaceAll("/", "__")}`}>
          {node.name}
        </summary>
        {node.children.length > 0 ? (
          <ul className="tree-list">
            {node.children.map((child) => (
              <TreeBranch
                key={child.id + child.path}
                node={child}
                selectedFileId={selectedFileId}
                onFileSelect={onFileSelect}
              />
            ))}
          </ul>
        ) : null}
      </details>
    </li>
  );
}

export function TreeView({ nodes, selectedFileId, onFileSelect }: TreeViewProps): JSX.Element {
  if (nodes.length === 0) {
    return <p className="panel-empty">No imported files yet.</p>;
  }

  return (
    <ul className="tree-list">
      {nodes.map((node) => (
        <TreeBranch
          key={node.id + node.path}
          node={node}
          selectedFileId={selectedFileId}
          onFileSelect={onFileSelect}
        />
      ))}
    </ul>
  );
}
