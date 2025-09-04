import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, createUser, getUserPermissions } from '@/lib/db-json';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const permissions = getUserPermissions(session.id);
  
  // Check if user has permission to view users
  if (!permissions.includes('users.view') && session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const users = getAllUsers();
  
  // Remove password hashes from response
  const sanitizedUsers = users.map(({ password, ...user }) => user);
  
  return NextResponse.json({
    users: sanitizedUsers,
    currentUser: session
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const permissions = getUserPermissions(session.id);
  
  // Check if user has permission to create users
  if (!permissions.includes('users.create') && session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const { username, firstName, password, role, email } = await request.json();
    
    if (!username || !firstName || !password || !role) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if username already exists
    const users = getAllUsers();
    if (users.some(u => u.username === username)) {
      return NextResponse.json(
        { message: 'Username already exists' },
        { status: 400 }
      );
    }
    
    const user = await createUser(username, firstName, password, role, email);
    const { password: _, ...sanitizedUser } = user;
    
    return NextResponse.json(sanitizedUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Failed to create user' },
      { status: 500 }
    );
  }
}