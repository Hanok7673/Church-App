import { churches, membershipJoinRequests, profilePrivate, profiles, refreshSessions, users } from "@church/database";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.js";

const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(8).max(128);
const privateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  phone: z.string().regex(/^\+977(?:97|98)\d{8}$/),
  dateOfBirth: z.iso.date().refine((value) => new Date(`${value}T00:00:00Z`) < new Date(), "Date of birth must be in the past."),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say"]),
  permanentAddress: z.string().trim().min(3).max(500),
  temporaryAddress: z.string().trim().min(3).max(500),
  churchId: z.number().int().positive().optional(),
});
const registerBody = privateProfileSchema.extend({ email, password });
const loginBody = z.object({ email, password });
const refreshBody = z.object({ refreshToken: z.string().min(64).max(300) });
const authResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({ id: z.string().uuid(), email: z.string().email(), fullName: z.string() }),
});

type SessionUser = { id: string; email: string; fullName: string; tokenVersion: number };

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/register", { schema: { body: registerBody } }, async (request, reply) => {
    const body = request.body;
    const passwordHash = await hashPassword(body.password);

    if (body.churchId) {
      const [church] = await app.db.select({ id: churches.id }).from(churches)
        .where(and(eq(churches.id, body.churchId), eq(churches.status, "active"))).limit(1);
      if (!church) {
        return reply.code(400).send({ error: "INVALID_CHURCH", message: "Please select an active church." });
      }
    }

    const account = await app.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email: body.email, passwordHash }).returning();
      if (!user) throw new Error("Account creation did not return a user.");
      await tx.insert(profiles).values({ id: user.id, fullName: body.fullName });
      await tx.insert(profilePrivate).values({
        id: user.id,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
        permanentAddress: body.permanentAddress,
        temporaryAddress: body.temporaryAddress,
      });
      if (body.churchId) {
        await tx.insert(membershipJoinRequests).values({ userId: user.id, churchId: body.churchId, requestedRole: "member" });
      }
      return { id: user.id, email: user.email, fullName: body.fullName, tokenVersion: user.tokenVersion };
    });

    return reply.code(201).send(await issueSession(app, account));
  });

  app.post("/login", { schema: { body: loginBody } }, async (request, reply) => {
    const [account] = await app.db.select({
      id: users.id, email: users.email, passwordHash: users.passwordHash, status: users.status,
      tokenVersion: users.tokenVersion, fullName: profiles.fullName,
    }).from(users).innerJoin(profiles, eq(profiles.id, users.id)).where(eq(users.email, request.body.email)).limit(1);

    if (!account || account.status !== "active" || !(await verifyPassword(account.passwordHash, request.body.password))) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    }
    return reply.send(await issueSession(app, account));
  });

  app.post("/refresh", { schema: { body: refreshBody } }, async (request, reply) => {
    const [sessionId] = request.body.refreshToken.split(".", 1);
    if (!sessionId || !z.string().uuid().safeParse(sessionId).success) {
      return reply.code(401).send({ error: "INVALID_SESSION", message: "Refresh session is invalid." });
    }
    const tokenHash = sha256(request.body.refreshToken);
    const [session] = await app.db.select({
      sessionId: refreshSessions.id, userId: users.id, email: users.email, fullName: profiles.fullName,
      tokenVersion: users.tokenVersion, status: users.status,
    }).from(refreshSessions)
      .innerJoin(users, eq(users.id, refreshSessions.userId))
      .innerJoin(profiles, eq(profiles.id, users.id))
      .where(and(eq(refreshSessions.id, sessionId), eq(refreshSessions.tokenHash, tokenHash), isNull(refreshSessions.revokedAt), gt(refreshSessions.expiresAt, new Date())))
      .limit(1);
    if (!session || session.status !== "active") {
      return reply.code(401).send({ error: "INVALID_SESSION", message: "Refresh session is invalid or expired." });
    }
    const [revoked] = await app.db.update(refreshSessions).set({ revokedAt: new Date() }).where(and(
      eq(refreshSessions.id, session.sessionId),
      isNull(refreshSessions.revokedAt),
      gt(refreshSessions.expiresAt, new Date()),
    )).returning({ id: refreshSessions.id });
    if (!revoked) {
      return reply.code(401).send({ error: "INVALID_SESSION", message: "Refresh session was already used." });
    }
    return reply.send(await issueSession(app, { id: session.userId, email: session.email, fullName: session.fullName, tokenVersion: session.tokenVersion }));
  });

  app.post("/logout", { preHandler: app.authenticate, schema: { body: refreshBody } }, async (request, reply) => {
    const [sessionId] = request.body.refreshToken.split(".", 1);
    if (sessionId && z.string().uuid().safeParse(sessionId).success) {
      await app.db.update(refreshSessions).set({ revokedAt: new Date() }).where(and(eq(refreshSessions.id, sessionId), eq(refreshSessions.userId, request.user.sub)));
    }
    return reply.code(204).send();
  });
};

async function issueSession(app: FastifyInstance, user: SessionUser) {
  const accessToken = app.jwt.sign({ sub: user.id, email: user.email, tokenVersion: user.tokenVersion });
  const secret = randomBytes(48).toString("base64url");
  const sessionId = randomUUID();
  const refreshToken = `${sessionId}.${secret}`;
  await app.db.insert(refreshSessions).values({
    id: sessionId,
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
  });
  return { accessToken, refreshToken, user: { id: user.id, email: user.email, fullName: user.fullName } };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
