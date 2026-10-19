import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncReplies } from "@/lib/emailOutreach";

export const maxDuration = 60;
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const FORCED_MIN_INTERVAL_MS = 30 * 1000; // "Check for replies now" button

// Checks the signed-in user's dashboard threads for replies (called when the CRM opens).
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const connection = await prisma.gmailConnection.findUnique({ where: { email: session.email }, select: { lastSyncAt: true } });
  if (!connection) return NextResponse.json({ skipped: "not-connected" });
  const minInterval = request.nextUrl.searchParams.get("force") ? FORCED_MIN_INTERVAL_MS : MIN_INTERVAL_MS;
  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < minInterval) {
    return NextResponse.json({ skipped: "recent" });
  }
  try {
    return NextResponse.json(await syncReplies(session.email));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Reply check failed" }, { status: 500 });
  }
}
