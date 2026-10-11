import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";

const COOKIE_NAME = SESSION_COOKIE;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function createSession(userId: string): Promise<string> {
  const id = nanoid(48);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await db.insert(sessions).values({ id, userId, expiresAt });
  cookies().set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE
      ? process.env.SESSION_COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return id;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  cookies().delete(COOKIE_NAME);
}

export { SESSION_COOKIE };
