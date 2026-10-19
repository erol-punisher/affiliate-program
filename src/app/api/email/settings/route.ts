import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { getEmailSettings, saveEmailSettings } from "@/lib/emailSafety";
import { sentTodayCount } from "@/lib/emailOutreach";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ settings: await getEmailSettings(), sentToday: await sentTodayCount(session.email) });
}

export async function PUT(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  await saveEmailSettings(body?.settings ?? {}, session.email);
  return NextResponse.json({ settings: await getEmailSettings() });
}
