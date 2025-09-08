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
  
  // Check if this is likely the first user setup
  // We use a cookie to track if users exist after first check
  const setupComplete = request.cookies.get('setup_complete')?.value;
  
  // Simple redirect logic without API calls
  if (!hasSession && !isPublicPath) {
    // If no setup cookie and trying to access protected route, go to login
    // The login page will redirect to register if no users exist
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // If user has session and tries to access login/register, redirect to home
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