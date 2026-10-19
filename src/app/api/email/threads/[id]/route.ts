import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { isReplyCategory } from "@/lib/emailSafety";
import { applyReplyCategory } from "@/lib/emailOutreach";

// Sets a reply's category (interested / not interested / out of office / wrong person / unsubscribe).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isReplyCategory(body?.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  await applyReplyCategory(id, body.category, session.email);
  return NextResponse.json({ ok: true });
}
