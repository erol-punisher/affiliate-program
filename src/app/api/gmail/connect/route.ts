import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildGoogleAuthUrl } from "@/lib/googleOAuth";
import { getSession } from "@/lib/session";
import { GMAIL_SCOPE } from "@/lib/gmail";

const STATE_COOKIE = "oauth_state";

// Starts the "Connect Gmail" consent flow; finishes in /api/auth/callback/google.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const state = `gmail.${randomBytes(16).toString("hex")}`;
  const response = NextResponse.redirect(buildGoogleAuthUrl(state, { extraScopes: [GMAIL_SCOPE], loginHint: session.email }));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
