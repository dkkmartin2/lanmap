import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type Params = {
  params: { id: string } | Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);
  const file = await prisma.fileNode.findUnique({ where: { id } });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (file.type !== "FILE") {
    return NextResponse.json({ error: "Entry is a directory" }, { status: 400 });
  }

  return NextResponse.json({
    file: {
      id: file.id,
      path: file.path,
      name: file.name,
      size: file.size,
      mtime: file.mtime ? file.mtime.toISOString() : null,
      contentType: file.contentType.toLowerCase(),
      content: file.content,
      sha256: file.sha256
    }
  });
}
