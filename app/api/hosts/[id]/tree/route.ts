import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildTree } from "@/lib/tree";

type Params = {
  params: { id: string } | Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const host = await prisma.host.findUnique({ where: { id } });
  if (!host) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const fileNodes = await prisma.fileNode.findMany({
    where: { hostId: id },
    orderBy: { path: "asc" }
  });

  return NextResponse.json({ tree: buildTree(fileNodes) });
}
