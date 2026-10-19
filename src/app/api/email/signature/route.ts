import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { GmailNotConnectedError, gmailAccessToken } from "@/lib/gmail";
import { fetchGmailSignature, getSignature, saveSignature } from "@/lib/emailSignature";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ html: await getSignature(session.email) });
}

// Save an edited signature: { html }
export async function PUT(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.html !== "string" || body.html.length > 50_000) {
    return NextResponse.json({ error: "Signature is missing or too long" }, { status: 400 });
  }
  return NextResponse.json({ html: await saveSignature(session.email, body.html) });
}

// Import the signature set in Gmail and save it.
export async function POST() {
  const session = await getSessionWithFreshToken();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const token = await gmailAccessToken(session.email);
    const gmailSignature = await fetchGmailSignature(token, session.email);
    if (!gmailSignature.trim()) {
      return NextResponse.json({ error: "Your Gmail has no signature set (Gmail → Settings → General → Signature)" }, { status: 404 });
    }
    return NextResponse.json({ html: await saveSignature(session.email, gmailSignature) });
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "Connect your Gmail first", needsGmail: true }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Couldn't read your Gmail signature" }, { status: 502 });
  }
}
