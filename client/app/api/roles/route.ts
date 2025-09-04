import { NextRequest, NextResponse } from 'next/server';
import { getAllRoles, createRole } from '@/lib/db-json';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/db-json';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const roles = getAllRoles();
  return NextResponse.json(roles);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const permissions = getUserPermissions(session.id);
  
  // Check if user has permission to manage roles
  if (!permissions.includes('system.roles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const { name, description, permissions: rolePermissions } = await request.json();
    
    if (!name || !description || !Array.isArray(rolePermissions)) {
      return NextResponse.json(
        { message: 'Invalid role data' },
        { status: 400 }
      );
    }
    
    const role = createRole(name, description, rolePermissions);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { message: 'Failed to create role' },
      { status: 500 }
    );
  }
}