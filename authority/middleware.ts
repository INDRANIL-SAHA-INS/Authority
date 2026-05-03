import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { verifyMobileTokenEdge } from '@/lib/mobile-auth';

// Initialize NextAuth with the secret explicitly for Edge Runtime compatibility
const { auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
});

export default auth(async (req) => {
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // 1. Whitelist for public routes (API and Web)
  const isPublicApi = path.startsWith('/api/auth') || path.startsWith('/api/mobile/login') || path.startsWith('/api/send_student_data_for_email');
  const isPublicPage = path === '/';
  
  // Also allow static files and internal Next.js paths just in case the matcher misses them
  const isStaticFile = /\.(.*)$/.test(path); 
  
  if (isPublicApi || isPublicPage || isStaticFile) {
    // If user is already logged in and tries to access login page, redirect to home
    if (isPublicPage && isLoggedIn) {
      return Response.redirect(new URL('/home', req.nextUrl));
    }
    return; // Allow access
  }

  // 2. Global API protection (for all other /api routes)
  if (path.startsWith('/api')) {
    const authHeader = req.headers.get("Authorization");
    
    // Mobile Check (Bearer Token)
    if (authHeader?.startsWith("Bearer ")) {
      const mobilePayload = await verifyMobileTokenEdge(req);
      if (!mobilePayload) {
        return Response.json({ error: "Unauthorized: Invalid Mobile Token" }, { status: 401 });
      }
      return; // Authorized mobile request
    } 
    
    // Web Check (Session Cookie)
    if (!isLoggedIn) {
      return Response.json({ error: "Unauthorized: No Session found" }, { status: 401 });
    }
    
    return; // Authorized web request
  }

  // 3. Web UI Route Protection
  // If we got here, it's a private page and not an API/Static file
  if (!isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  // Broad matcher, but logic inside filters out statics
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
