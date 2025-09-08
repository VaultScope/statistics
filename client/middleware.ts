import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') || 
    pathname.startsWith('/_next/') ||
    pathname.includes('.')  // Skip files with extensions
  ) {
    return NextResponse.next();
  }
  
  const publicPaths = ['/register', '/login'];
  const isPublicPath = publicPaths.includes(pathname);
  
  const sessionCookie = request.cookies.get('session')?.value;
  const hasSession = sessionCookie ? await verifySession(sessionCookie) : null;
  
  // Check if user exists via API endpoint
  let hasUsers = false;
  try {
    const checkUrl = new URL('/api/auth/check-setup', request.url);
    const response = await fetch(checkUrl.toString(), {
      headers: {
        // Pass along the cookie to avoid auth issues
        cookie: request.headers.get('cookie') || '',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      hasUsers = data.userExists;
      console.log('[Middleware] User check result:', { hasUsers, pathname });
    }
  } catch (error) {
    // If check fails, allow access to register page
    console.error('Failed to check user setup:', error);
    // Don't assume users exist - allow registration
    hasUsers = false;
  }
  
  // Redirect logic
  if (!hasUsers && pathname !== '/register') {
    return NextResponse.redirect(new URL('/register', request.url));
  }
  
  if (hasUsers && pathname === '/register' && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (!hasSession && !isPublicPath && hasUsers) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (hasSession && (pathname === '/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.svg$).*)',
  ],
};