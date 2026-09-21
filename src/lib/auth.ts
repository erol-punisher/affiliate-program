import { getSession, createSessionCookie, type SessionPayload } from "@/lib/session";
import { refreshAccessToken } from "@/lib/googleOAuth";

const REFRESH_MARGIN_MS = 60_000;

export async function getSessionWithFreshToken(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return session;
  }

  const tokens = await refreshAccessToken(session.refreshToken);
  const refreshed: SessionPayload = {
    ...session,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
  };

  await createSessionCookie(refreshed);
  return refreshed;
}
