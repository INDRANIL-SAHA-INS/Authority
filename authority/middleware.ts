import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { verifyMobileTokenEdge } from '@/lib/mobile-auth';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const path = req.nextUrl.pathname;

  // Allow public auth routes
  if (path.startsWith('/api/auth') || path === '/api/mobile/login') {
    return;
  }

  // Global API protection
  if (path.startsWith('/api')) {
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const isValidMobile = await verifyMobileTokenEdge(req);
      if (!isValidMobile) return Response.json({ error: "Unauthorized" }, { status: 401 });
      return;
    } 
    
    if (!req.auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }

  // Web UI routing
  const isLoggedIn = !!req.auth;
  const isAuthPage = path === '/';

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/home', req.nextUrl));
  }

  if (!isAuthPage && !path.startsWith('/api') && !isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
