"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { createSession, destroySession } from "@/lib/auth/session";
import { s } from "@/lib/validators";

export async function login(formData: FormData) {
  const email = s(formData, "email").toLowerCase();
  const password = s(formData, "password");

  if (!email || !password) redirect("/login?error=missing");

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function loginWithGoogle(credential: string) {
  let email: string;
  try {
    const identity = await verifyGoogleIdToken(credential);
    email = identity.email;
  } catch {
    redirect("/login?error=google");
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) redirect("/login?error=notallowed");

  await createSession(user.id);
  redirect("/");
}
