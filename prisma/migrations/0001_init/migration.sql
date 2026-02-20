-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FileNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER,
    "mtime" DATETIME,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "contentType" TEXT NOT NULL DEFAULT 'NONE',
    "content" TEXT,
    "sha256" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileNode_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "rootPath" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryCount" INTEGER NOT NULL,
    "payloadSize" INTEGER NOT NULL,
    "warnings" TEXT,
    CONSTRAINT "ImportRun_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Host_address_key" ON "Host"("address");

-- CreateIndex
CREATE UNIQUE INDEX "FileNode_hostId_path_key" ON "FileNode"("hostId", "path");

-- CreateIndex
CREATE INDEX "FileNode_hostId_type_idx" ON "FileNode"("hostId", "type");

-- CreateIndex
CREATE INDEX "FileNode_hostId_path_idx" ON "FileNode"("hostId", "path");
