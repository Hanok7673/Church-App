import { churches, membershipJoinRequests, memberships, profiles } from "@church/database";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const churchIdParams = z.object({ churchId: z.coerce.number().int().positive() });
const requestParams = churchIdParams.extend({ requestId: z.coerce.number().int().positive() });
const createRequestBody = z.object({ churchId: z.number().int().positive() });
const reviewBody = z.object({ decision: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().max(1_000).nullable().optional() });
const memberQuery = z.object({ search: z.string().trim().max(100).default(""), limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) });

export const membershipRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/churches/joinable", async () => app.db.select({
    id: churches.id, name: churches.name, nameNe: churches.nameNe, address: churches.address,
  }).from(churches).where(eq(churches.status, "active")).orderBy(asc(churches.nameNe), asc(churches.name)));

  app.get("/me/membership-requests", { preHandler: app.authenticate }, async (request) => app.db.select({
    id: membershipJoinRequests.id,
    churchId: membershipJoinRequests.churchId,
    churchName: churches.name,
    churchNameNe: churches.nameNe,
    status: membershipJoinRequests.status,
    requestedRole: membershipJoinRequests.requestedRole,
    reviewNote: membershipJoinRequests.reviewNote,
    createdAt: membershipJoinRequests.createdAt,
    reviewedAt: membershipJoinRequests.reviewedAt,
  }).from(membershipJoinRequests)
    .innerJoin(churches, eq(churches.id, membershipJoinRequests.churchId))
    .where(eq(membershipJoinRequests.userId, request.user.sub))
    .orderBy(desc(membershipJoinRequests.createdAt)));

  app.post("/me/membership-requests", { preHandler: app.authenticate, schema: { body: createRequestBody } }, async (request, reply) => {
    const [church] = await app.db.select({ id: churches.id }).from(churches)
      .where(and(eq(churches.id, request.body.churchId), eq(churches.status, "active"))).limit(1);
    if (!church) return reply.code(404).send({ error: "CHURCH_NOT_FOUND", message: "Active church was not found." });
    const [activeMembership] = await app.db.select({ id: memberships.id }).from(memberships).where(and(
      eq(memberships.userId, request.user.sub), eq(memberships.churchId, request.body.churchId), eq(memberships.status, "active"),
    )).limit(1);
    if (activeMembership) return reply.code(409).send({ error: "ALREADY_MEMBER", message: "Membership is already active." });
    const [created] = await app.db.insert(membershipJoinRequests).values({
      userId: request.user.sub, churchId: request.body.churchId, requestedRole: "member",
    }).returning();
    return reply.code(201).send(created);
  });

  app.get("/churches/:churchId/membership-requests/pending", { preHandler: app.authenticate, schema: { params: churchIdParams } }, async (request) => {
    await app.requireChurchAdmin(request.user.sub, request.params.churchId);
    return app.db.select({
      id: membershipJoinRequests.id, userId: membershipJoinRequests.userId, fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl, requestedRole: membershipJoinRequests.requestedRole, createdAt: membershipJoinRequests.createdAt,
    }).from(membershipJoinRequests)
      .innerJoin(profiles, eq(profiles.id, membershipJoinRequests.userId))
      .where(and(eq(membershipJoinRequests.churchId, request.params.churchId), eq(membershipJoinRequests.status, "pending")))
      .orderBy(asc(membershipJoinRequests.createdAt));
  });

  app.patch("/churches/:churchId/membership-requests/:requestId", { preHandler: app.authenticate, schema: { params: requestParams, body: reviewBody } }, async (request, reply) => {
    await app.requireChurchAdmin(request.user.sub, request.params.churchId);
    const result = await app.db.transaction(async (tx) => {
      const [pending] = await tx.select().from(membershipJoinRequests).where(and(
        eq(membershipJoinRequests.id, request.params.requestId),
        eq(membershipJoinRequests.churchId, request.params.churchId),
        eq(membershipJoinRequests.status, "pending"),
      )).for("update").limit(1);
      if (!pending) return null;

      let membershipId: number | null = null;
      if (request.body.decision === "approved") {
        const [member] = await tx.insert(memberships).values({ churchId: request.params.churchId, userId: pending.userId, role: "member", status: "active" })
          .onConflictDoUpdate({ target: [memberships.churchId, memberships.userId], set: { status: "active", updatedAt: new Date() } })
          .returning({ id: memberships.id });
        membershipId = member?.id ?? null;
      }
      const [reviewed] = await tx.update(membershipJoinRequests).set({
        status: request.body.decision,
        membershipId,
        reviewedBy: request.user.sub,
        reviewedAt: new Date(),
        reviewNote: request.body.reviewNote || null,
        updatedAt: new Date(),
      }).where(eq(membershipJoinRequests.id, pending.id)).returning();
      return reviewed;
    });
    if (!result) return reply.code(404).send({ error: "PENDING_REQUEST_NOT_FOUND", message: "Pending request was not found." });
    return reply.send(result);
  });

  app.get("/churches/:churchId/members", { preHandler: app.authenticate, schema: { params: churchIdParams, querystring: memberQuery } }, async (request) => {
    await app.requireChurchMember(request.user.sub, request.params.churchId);
    const search = request.query.search;
    return app.db.select({
      membershipId: memberships.id, userId: memberships.userId, fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl, role: memberships.role, joinedAt: memberships.joinedAt,
    }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId)).where(and(
      eq(memberships.churchId, request.params.churchId), eq(memberships.status, "active"),
      search ? or(ilike(profiles.fullName, `%${search}%`), inArray(memberships.role, roleSearch(search))) : undefined,
    )).orderBy(asc(profiles.fullName)).limit(request.query.limit).offset(request.query.offset);
  });
};

function roleSearch(search: string): Array<"owner" | "admin" | "leader" | "member"> {
  const normalized = search.toLowerCase();
  return (["owner", "admin", "leader", "member"] as const).filter((role) => role.includes(normalized));
}
