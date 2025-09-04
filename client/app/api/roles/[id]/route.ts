import { NextRequest, NextResponse } from 'next/server';
import { updateRole, deleteRole } from '@/lib/db-json';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/db-json';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const permissions = getUserPermissions(session.id);
  
  if (!permissions.includes('system.roles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const updates = await request.json();
    const success = updateRole(id, updates);
    
    if (!success) {
      return NextResponse.json(
        { message: 'Role not found or is a system role' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { message: 'Failed to update role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const permissions = getUserPermissions(session.id);
  
  if (!permissions.includes('system.roles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const success = deleteRole(id);
    
    if (!success) {
      return NextResponse.json(
        { message: 'Cannot delete system role or role in use' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { message: 'Failed to delete role' },
      { status: 500 }
    );
  }
}