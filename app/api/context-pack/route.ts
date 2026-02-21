import { NextResponse } from "next/server";

import { ContextPackError, generateContextPack } from "@/lib/context-pack";
import type { ContextPackRequest } from "@/lib/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ContextPackRequest;
    const result = await generateContextPack(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContextPackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not generate context pack"
      },
      { status: 400 }
    );
  }
}
