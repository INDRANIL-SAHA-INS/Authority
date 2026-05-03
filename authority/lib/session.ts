import { verifyMobileTokenEdge } from "@/lib/mobile-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;      // This is the user_id from the 'users' table
  profileId: string; // This is the specialized teacher_id or student_id
  email: string;
  role: string;
}

/**
 * Retrieves the currently authenticated user and their specialized profile ID
 * (teacher_id or student_id) from either a Mobile token or a Web cookie.
 */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  let userId: string | null = null;
  let email: string | null = null;
  let role: string | null = null;

  const authHeader = request.headers.get("Authorization");
  
  // 1. Try to get identity from Mobile Bearer Token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const payload = await verifyMobileTokenEdge(request);
    if (payload) {
      userId = payload.id;
      email = payload.email;
      role = payload.role;
    }
  } 
  // 2. If no mobile token, try to get identity from Web Session (Cookie)
  else {
    const session = await auth();
    if (session?.user) {
      userId = session.user.id as string;
      email = session.user.email as string;
      role = (session.user as { role: string }).role;
    }
  }

  if (!userId || !role) return null;

  // 3. Perform the "Bridge Lookup" to get specialized IDs
  try {
    if (role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({
        where: { user_id: BigInt(userId) },
        select: { teacher_id: true }
      });
      if (teacher) {
        return { id: userId, profileId: teacher.teacher_id.toString(), email: email!, role };
      }
    } else if (role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { user_id: BigInt(userId) },
        select: { student_id: true }
      });
      if (student) {
        return { id: userId, profileId: student.student_id.toString(), email: email!, role };
      }
    }
    // Admin or other roles might not have specialized profiles
    return { id: userId, profileId: userId, email: email!, role };
  } catch (error) {
    console.error("Session Bridge Lookup Error:", error);
    return null;
  }
}
