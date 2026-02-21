"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, JSX } from "react";

import { TreeView } from "@/components/tree-view";
import type {
  ContextPackChunkPreset,
  ContextPackPart,
  ContextPackResponse,
  ContextPackSnippetMode,
  HostListItem,
  TreeNode
} from "@/lib/types";

type SelectedFile = {
  id: string;
  path: string;
  name: string;
  size: number | null;
  mtime: string | null;
  contentType: "text" | "binary" | "none";
  content: string | null;
  sha256: string | null;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : "Request failed";
    throw new Error(message);
  }

  return body;
}

export function Dashboard(): JSX.Element {
  const [hosts, setHosts] = useState<HostListItem[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [hostLabel, setHostLabel] = useState("");
  const [hostAddress, setHostAddress] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [packSnippetMode, setPackSnippetMode] = useState<ContextPackSnippetMode>("compact");
  const [packChunkPreset, setPackChunkPreset] = useState<ContextPackChunkPreset>("medium");
  const [packParts, setPackParts] = useState<ContextPackPart[]>([]);
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);

  const [isLoadingHosts, setIsLoadingHosts] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedHost = useMemo(
    () => hosts.find((host) => host.id === selectedHostId) ?? null,
    [hosts, selectedHostId]
  );

  const treeForView = useMemo<TreeNode[]>(() => {
    if (!selectedHost?.runParentPath) {
      return tree;
    }

    const parentPath = selectedHost.runParentPath;
    const segments = parentPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      return tree;
    }

    let wrapped = tree;
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segmentPath = `/${segments.slice(0, index + 1).join("/")}`;
      wrapped = [
        {
          id: `virtual-parent:${selectedHost.id}:${segmentPath}`,
          name: segments[index],
          path: segmentPath,
          type: "dir",
          children: wrapped
        }
      ];
    }

    return wrapped;
  }, [selectedHost, tree]);

  const activePackPart = packParts[activePackIndex] ?? null;

  const loadTreeForHost = useCallback(async (hostId: string): Promise<void> => {
    setIsLoadingTree(true);
    setSelectedFileId(null);
    setSelectedFile(null);

    try {
      const data = await fetchJson<{ tree: TreeNode[] }>(`/api/hosts/${hostId}/tree`);
      setTree(data.tree);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tree");
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  const loadHosts = async (): Promise<void> => {
    setIsLoadingHosts(true);
    try {
      const data = await fetchJson<{ hosts: HostListItem[] }>("/api/hosts");
      setHosts(data.hosts);

      if (!selectedHostId && data.hosts.length > 0) {
        setSelectedHostId(data.hosts[0].id);
      }

      if (selectedHostId && data.hosts.every((host) => host.id !== selectedHostId)) {
        setSelectedHostId(data.hosts[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load hosts");
    } finally {
      setIsLoadingHosts(false);
    }
  };

  useEffect(() => {
    void loadHosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedHostId) {
      setTree([]);
      setSelectedFileId(null);
      setSelectedFile(null);
      setPackParts([]);
      setActivePackIndex(0);
      setIsContextModalOpen(false);
      return;
    }

    void loadTreeForHost(selectedHostId);
  }, [selectedHostId, loadTreeForHost]);

  const onAddHost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    try {
      const data = await fetchJson<{ host: HostListItem }>("/api/hosts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ label: hostLabel, address: hostAddress })
      });

      setHostLabel("");
      setHostAddress("");
      setNotice(`Created host ${data.host.label}`);
      await loadHosts();
      setSelectedHostId(data.host.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create host");
    }
  };

  const onImportPayload = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsImporting(true);

    try {
      const data = await fetchJson<{
        hostId: string;
        importedCount: number;
        skippedCount: number;
        warnings: string[];
      }>("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payload: importPayload })
      });

      setImportPayload("");
      await loadHosts();
      setSelectedHostId(data.hostId);
      await loadTreeForHost(data.hostId);

      const warningSuffix = data.warnings.length > 0 ? ` Warnings: ${data.warnings.length}` : "";
      setNotice(`Imported ${data.importedCount} entries.${warningSuffix}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const onSelectFile = async (fileId: string): Promise<void> => {
    setSelectedFileId(fileId);
    setIsLoadingFile(true);

    try {
      const data = await fetchJson<{ file: SelectedFile }>(`/api/files/${fileId}/content`);
      setSelectedFile(data.file);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Failed to load file");
      setSelectedFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const onGenerateContextPack = async (): Promise<void> => {
    if (!selectedHostId) {
      setError("Select a host before generating a context pack");
      return;
    }

    setError(null);
    setNotice(null);
    setIsGeneratingPack(true);

    try {
      const data = await fetchJson<ContextPackResponse>("/api/context-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostId: selectedHostId,
          snippetMode: packSnippetMode,
          chunkPreset: packChunkPreset
        })
      });

      setPackParts(data.parts);
      setActivePackIndex(0);
      setNotice(
        `Generated ${data.parts.length} context pack part${data.parts.length === 1 ? "" : "s"} for ${selectedHost?.label ?? "host"}.`
      );
    } catch (packError) {
      setError(packError instanceof Error ? packError.message : "Could not generate context pack");
    } finally {
      setIsGeneratingPack(false);
    }
  };

  const onOpenContextPack = async (): Promise<void> => {
    setIsContextModalOpen(true);
    if (packParts.length === 0) {
      await onGenerateContextPack();
    }
  };

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied ${label} to clipboard`);
    } catch {
      setError("Clipboard copy failed");
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1>LanMap</h1>
        <p>Pentest host memory map dashboard</p>
      </header>

      {error ? (
        <p className="alert error" data-testid="global-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="alert notice" data-testid="global-notice">
          {notice}
        </p>
      ) : null}

      <section className="workspace">
        <aside className="panel left-panel">
          <h2>Hosts</h2>
          <form className="stack" onSubmit={onAddHost}>
            <label>
              Label
              <input
                data-testid="host-label-input"
                value={hostLabel}
                onChange={(event) => setHostLabel(event.target.value)}
                placeholder="Target-Alpha"
                required
              />
            </label>
            <label>
              Address
              <input
                data-testid="host-address-input"
                value={hostAddress}
                onChange={(event) => setHostAddress(event.target.value)}
                placeholder="192.168.1.10"
                required
              />
            </label>
            <button type="submit" data-testid="add-host-button">
              Add host
            </button>
          </form>

          <div className="divider" />

          <form className="stack" onSubmit={onImportPayload}>
            <label>
              Compressed payload
              <textarea
                data-testid="payload-input"
                value={importPayload}
                onChange={(event) => setImportPayload(event.target.value)}
                placeholder="LANMAP1:gzip-base64:..."
                rows={8}
                required
              />
            </label>
            <button type="submit" disabled={isImporting} data-testid="import-button">
              {isImporting ? "Importing..." : "Import scan"}
            </button>
          </form>

          <div className="divider" />

          <div className="hosts-list" aria-busy={isLoadingHosts}>
            {hosts.length === 0 ? <p className="panel-empty">No hosts yet.</p> : null}
            {hosts.map((host) => (
              <button
                data-testid={`host-item-${host.id}`}
                key={host.id}
                type="button"
                className={`host-item ${selectedHostId === host.id ? "active" : ""}`}
                onClick={() => setSelectedHostId(host.id)}
              >
                <span>{host.label}</span>
                <small>
                  {host.address} • {host.fileCount} entries
                </small>
              </button>
            ))}
          </div>
        </aside>

        <main className="panel center-panel">
          <h2>File Reader</h2>
          {selectedHost ? <p className="context">Host: {selectedHost.label}</p> : null}

          {!selectedFileId && !isLoadingFile ? <p className="panel-empty">Select a file to inspect content.</p> : null}
          {isLoadingFile ? <p className="panel-empty">Loading file...</p> : null}

          {selectedFile ? (
            <article className="file-card file-content-shell" data-testid="file-card">
              <header>
                <h3>{selectedFile.path}</h3>
                <p>
                  type: {selectedFile.contentType} {selectedFile.size !== null ? `• ${selectedFile.size} bytes` : ""}
                </p>
              </header>

              {selectedFile.contentType === "text" ? (
                <pre className="file-content" data-testid="file-content">
                  {selectedFile.content ?? ""}
                </pre>
              ) : (
                <div className="binary-card" data-testid="binary-content">
                  <p>Binary or non-readable content is stored as metadata only.</p>
                  {selectedFile.sha256 ? <p>sha256: {selectedFile.sha256}</p> : null}
                </div>
              )}
            </article>
          ) : null}

          <div className="divider" />

          <section className="context-pack-launch">
            <button
              type="button"
              data-testid="context-pack-open"
              disabled={isGeneratingPack || !selectedHostId}
              onClick={() => {
                void onOpenContextPack();
              }}
            >
              {isGeneratingPack ? "Generating..." : "Open Context Pack"}
            </button>
            <small>
              {packParts.length > 0 ? `${packParts.length} part${packParts.length === 1 ? "" : "s"} ready.` : "Generate and copy host context."}
            </small>
          </section>
        </main>

        <aside className="panel right-panel">
          <h2>Directory Tree</h2>
          {selectedHost ? <p className="context">{selectedHost.address}</p> : null}
          {isLoadingTree ? (
            <p className="panel-empty">Loading tree...</p>
          ) : (
            <TreeView nodes={treeForView} selectedFileId={selectedFileId} onFileSelect={onSelectFile} />
          )}
        </aside>
      </section>

      {isContextModalOpen ? (
        <div
          className="modal-backdrop"
          data-testid="context-pack-modal"
          onClick={() => setIsContextModalOpen(false)}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Context pack"
          >
            <header className="modal-header">
              <h3>Context Pack</h3>
              <button
                type="button"
                data-testid="context-pack-close"
                onClick={() => setIsContextModalOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="context-pack-controls">
              <label>
                Snippet mode
                <select
                  data-testid="context-pack-snippet-mode"
                  value={packSnippetMode}
                  onChange={(event) => setPackSnippetMode(event.target.value as ContextPackSnippetMode)}
                >
                  <option value="compact">Compact</option>
                  <option value="full">Full</option>
                </select>
              </label>

              <label>
                Chunk size
                <select
                  data-testid="context-pack-chunk-preset"
                  value={packChunkPreset}
                  onChange={(event) => setPackChunkPreset(event.target.value as ContextPackChunkPreset)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>

              <button
                type="button"
                data-testid="context-pack-generate"
                disabled={isGeneratingPack || !selectedHostId}
                onClick={() => {
                  void onGenerateContextPack();
                }}
              >
                {isGeneratingPack ? "Generating..." : "Generate"}
              </button>
            </div>

            {packParts.length === 0 ? (
              <p className="panel-empty">Generate a context pack to copy host context.</p>
            ) : (
              <>
                <div className="context-pack-tabs" data-testid="context-pack-tabs">
                  {packParts.map((part, index) => (
                    <button
                      key={`part-${part.index}`}
                      type="button"
                      className={`pack-tab ${activePackIndex === index ? "active" : ""}`}
                      data-testid={`context-pack-tab-${part.index}`}
                      onClick={() => setActivePackIndex(index)}
                    >
                      Part {part.index}
                    </button>
                  ))}
                </div>

                <div className="context-pack-actions">
                  <button
                    type="button"
                    data-testid="context-pack-copy-part"
                    onClick={() => {
                      if (activePackPart) {
                        void copyToClipboard(activePackPart.content, `Part ${activePackPart.index}`);
                      }
                    }}
                  >
                    Copy Part
                  </button>
                  <button
                    type="button"
                    data-testid="context-pack-copy-all"
                    onClick={() => {
                      const combined = packParts.map((part) => part.content).join("\n\n---\n\n");
                      void copyToClipboard(combined, "all parts");
                    }}
                  >
                    Copy All Parts
                  </button>
                  {activePackPart ? (
                    <small>
                      chars: {activePackPart.stats.chars} • snippets: {activePackPart.stats.snippetCount}
                    </small>
                  ) : null}
                </div>

                <textarea
                  className="context-pack-output"
                  data-testid="context-pack-content"
                  value={activePackPart?.content ?? ""}
                  readOnly
                  rows={14}
                />
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
