import { NextResponse } from "next/server";

import { importPayload } from "@/lib/import-service";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<{ payload: string }>;
    const payload = body.payload;

    if (!payload || typeof payload !== "string") {
      return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const result = await importPayload(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed"
      },
      { status: 400 }
    );
  }
}
