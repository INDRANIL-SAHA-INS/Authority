import { jwtVerify } from "jose";

export interface MobileTokenPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Utility function to verify Bearer tokens for mobile API routes.
 * Uses 'jose' so it is 100% compatible with the Next.js Edge Runtime.
 */
export async function verifyMobileTokenEdge(request: Request): Promise<MobileTokenPayload | null> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    return payload as unknown as MobileTokenPayload;
  } catch {
    return null; // Invalid or expired token
  }
}
