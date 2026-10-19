import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { GmailNotConnectedError } from "@/lib/gmail";
import { MAX_EMAILS_PER_SEND, sendOutreachEmails } from "@/lib/emailOutreach";

// Sends are spaced ~1s apart, so a full batch needs more than the default duration.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const leadIds: string[] = Array.isArray(body?.leadIds) ? body.leadIds.filter((id: unknown) => typeof id === "string") : [];
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const text = typeof body?.body === "string" ? body.body : "";
  if (leadIds.length === 0 || !text.trim()) {
    return NextResponse.json({ error: "Pick at least one lead and write a message" }, { status: 400 });
  }
  if (leadIds.length > MAX_EMAILS_PER_SEND) {
    return NextResponse.json({ error: `Send to at most ${MAX_EMAILS_PER_SEND} leads at a time` }, { status: 400 });
  }

  try {
    const results = await sendOutreachEmails({
      senderEmail: session.email,
      senderName: session.name,
      leadIds,
      subject: subject || "Partnership with Releasit",
      body: text,
      replyInThread: body?.replyInThread !== false,
    });
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "Connect your Gmail first", needsGmail: true }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Sending failed" }, { status: 500 });
  }
}
