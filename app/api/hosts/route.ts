import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const hosts = await prisma.host.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          fileNodes: true
        }
      }
    }
  });

  return NextResponse.json({
    hosts: hosts.map((host) => ({
      id: host.id,
      label: host.label,
      address: host.address,
      updatedAt: host.updatedAt.toISOString(),
      fileCount: host._count.fileNodes
    }))
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as Partial<{ label: string; address: string }>;

  const label = body.label?.trim();
  const address = body.address?.trim();

  if (!label || !address) {
    return NextResponse.json({ error: "label and address are required" }, { status: 400 });
  }

  let host;
  try {
    host = await prisma.host.create({
      data: {
        label,
        address
      }
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Host address already exists" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(
    {
      host: {
        id: host.id,
        label: host.label,
        address: host.address,
        updatedAt: host.updatedAt.toISOString(),
        fileCount: 0
      }
    },
    { status: 201 }
  );
}
