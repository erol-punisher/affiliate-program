import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchUserInfo } from "@/lib/googleOAuth";
import { createSessionCookie } from "@/lib/session";
import { prisma } from "@/lib/db";

const STATE_COOKIE = "oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const loginError = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.nextUrl.origin),
    );

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginError("Invalid or expired login attempt. Please try again.");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return loginError("Failed to sign in with Google. Please try again.");
  }

  if (!tokens.refresh_token) {
    return loginError(
      "Google did not grant offline access. Please remove app access at myaccount.google.com/permissions and try again.",
    );
  }

  const userInfo = await fetchUserInfo(tokens.access_token);

  if (!userInfo.email_verified) {
    return loginError("Your Google email is not verified.");
  }

  const allowedDomain = process.env.ALLOWED_DOMAIN;
  const emailDomain = userInfo.email.split("@")[1];
  if (allowedDomain && emailDomain !== allowedDomain) {
    return loginError(`Access is restricted to ${allowedDomain} accounts.`);
  }

  // Per-person allowlist, managed from "Manage access" — only enforced once someone's actually
  // added to it, so an empty list can never lock everyone out.
  const allowlistSize = await prisma.allowedUser.count();
  if (allowlistSize > 0) {
    const allowed = await prisma.allowedUser.findUnique({ where: { email: userInfo.email.toLowerCase() } });
    if (!allowed) {
      return loginError("Your account doesn't have access to this dashboard yet. Ask a teammate to add you under Manage access.");
    }
  }

  await createSessionCookie({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
  });

  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
