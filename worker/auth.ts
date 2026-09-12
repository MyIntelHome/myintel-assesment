/** Resolvers run on the server and must verify a session before returning a principal. */
export interface VerifiedPrincipal {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export type IdentityResolver = (request: Request) => Promise<VerifiedPrincipal | null>;

/** The shared API has no implicit header, cookie, or development identity. */
export const anonymousIdentity: IdentityResolver = async () => null;

export function accountIdentity(principal: VerifiedPrincipal | null, adminEmail?: string) {
  if (!principal || !principal.emailVerified || !principal.id?.trim() || !principal.email?.trim()) return null;
  const email = principal.email.trim();
  return {
    id: principal.id,
    email,
    name: principal.name?.trim() || email,
    isAdmin: !!adminEmail?.trim() && email.toLowerCase() === adminEmail.trim().toLowerCase(),
  };
}
