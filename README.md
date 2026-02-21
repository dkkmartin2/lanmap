# LanMap

LanMap is a local Next.js dashboard for tracking hosts and filesystem intel during pentests.

## Features

- Host sidebar with manual add/select
- Compressed scan import (`LANMAP1:gzip-base64:<payload>`)
- Directory tree per host
- File reader for text files
- Binary files stored as metadata only
- Context pack generator (chunked markdown, compact/full snippets)
- SQLite persistence with Prisma
- Full Playwright E2E suite for critical flows

## Stack

- Next.js (App Router, TypeScript)
- Prisma + SQLite
- Playwright E2E
- POSIX shell scanner script (`scripts/scan.sh`)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
cp .env.example .env
```

3. Create/update SQLite schema

```bash
npm run db:push
```

4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scanner Usage

Run scanner from target host/path to emit a one-line compressed payload:

```bash
./scripts/scan.sh --label host-alpha --address 192.168.1.55
```

Options:

- `--root PATH`: root folder to scan (default: current directory)
- `--label LABEL`: host label
- `--address ADDRESS`: host address

The script includes hidden files and source/documentation text content (`.py`, `.c`, `.js`, `.html`, `.css`, `.java`, etc.). Binary or non-readable files are imported as metadata only.

Copy the emitted string and paste it into the dashboard import textarea.

## Testing

Run E2E tests:

```bash
npm run test:e2e
```

Notes:

- Playwright starts the app on port `3100`.
- Test DB is `file:./e2e/e2e.db`.
