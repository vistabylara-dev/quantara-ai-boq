import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { generateRawToken, hashToken } from "./tokens";
import { SESSION_COOKIE_NAME } from "./session-cookie-name";

export { SESSION_COOKIE_NAME };
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(userId: string): Promise<void> {
  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  (await cookies()).set(SESSION_COOKIE_NAME, rawToken, cookieOptions(expiresAt));
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSessionTokenFromCookies(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}
