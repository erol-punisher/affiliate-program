import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { GmailNotConnectedError } from "@/lib/gmail";
import { parseBrandedLayout, sendTestEmail } from "@/lib/emailOutreach";

// Sends one test copy of the email being written (rendered for the preview lead) to a single address.
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const text = typeof body?.body === "string" ? body.body : "";
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
    return NextResponse.json({ error: "Enter one valid email address to send the test to" }, { status: 400 });
  }
  if (typeof body?.previewLeadId !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  }

  try {
    await sendTestEmail({
      senderEmail: session.email,
      senderName: session.name,
      to,
      previewLeadId: body.previewLeadId,
      subject: typeof body?.subject === "string" ? body.subject : "",
      body: text,
      branded: parseBrandedLayout(body?.branded),
      useSignature: body?.useSignature === true,
      icebreakers:
        body?.icebreakers && typeof body.icebreakers === "object"
          ? Object.fromEntries(Object.entries(body.icebreakers).filter((e): e is [string, string] => typeof e[1] === "string"))
          : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "Connect your Gmail first", needsGmail: true }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Test email failed to send" }, { status: 500 });
  }
}
