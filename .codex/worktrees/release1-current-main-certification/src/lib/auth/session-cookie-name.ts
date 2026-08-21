/**
 * Isolated from session.ts on purpose: middleware.ts runs on the Edge
 * runtime and cannot bundle session.ts's Node-only imports (Prisma,
 * node:crypto). This constant is the only piece both sides need to share.
 */
export const SESSION_COOKIE_NAME = "quantara_session";
