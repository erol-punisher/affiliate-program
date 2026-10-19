import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncReplies } from "@/lib/emailOutreach";

export const maxDuration = 60;

// Daily Vercel Cron: checks every connected mailbox for replies. Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET env var is set.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connections = await prisma.gmailConnection.findMany({ select: { email: true } });
  const results: Record<string, unknown> = {};
  for (const { email } of connections) {
    results[email] = await syncReplies(email).catch((err) => ({ error: err instanceof Error ? err.message : "failed" }));
  }
  return NextResponse.json({ results });
}
