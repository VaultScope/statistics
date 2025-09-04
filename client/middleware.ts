import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }
  
  const publicPaths = ['/register', '/login'];
  const isPublicPath = publicPaths.includes(pathname);
  
  const sessionCookie = request.cookies.get('session')?.value;
  const hasSession = sessionCookie ? await verifySession(sessionCookie) : null;
  
  // Check if user exists - handle this more gracefully
  let userExists = false;
  try {
    const response = await fetch(new URL('/api/auth/check-setup', request.url));
    if (response.ok) {
      const data = await response.json();
      userExists = data.userExists;
    }
  } catch (error) {
    // If check fails, assume no user exists
    userExists = false;
  }
  
  if (!userExists && pathname !== '/register') {
    return NextResponse.redirect(new URL('/register', request.url));
  }
  
  if (userExists && pathname === '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (!hasSession && !isPublicPath && userExists) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.svg$).*)',
  ],
};