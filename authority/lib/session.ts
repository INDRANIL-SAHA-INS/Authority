import { verifyMobileTokenEdge } from "@/lib/mobile-auth";
import { auth } from "@/auth";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Retrieves the currently authenticated user from either 
 * a Mobile Bearer token or a Web cookie.
 */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const authHeader = request.headers.get("Authorization");
  
  // Handle mobile requests
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const payload = await verifyMobileTokenEdge(request);
    if (payload) {
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role,
      };
    }
    return null;
  }

  // Handle web requests
  const session = await auth();
  if (session?.user) {
    return {
      id: session.user.id as string,
      email: session.user.email as string,
      role: (session.user as { role: string }).role,
    };
  }

  return null;
}
