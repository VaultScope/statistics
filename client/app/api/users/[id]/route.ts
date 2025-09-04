import { NextRequest, NextResponse } from 'next/server';
import { updateUser, deleteUser, updateUserPassword } from '@/lib/db-json';
import { getSession } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Only admins can update users
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const updates = await request.json();
    const userId = parseInt(id);
    
    // Handle password update separately if provided
    if (updates.password) {
      await updateUserPassword(userId, updates.password);
      delete updates.password;
    }
    
    // Update other fields
    if (Object.keys(updates).length > 0) {
      const success = updateUser(userId, updates);
      if (!success) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Failed to update user' },
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
  
  // Only admins can delete users
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const userId = parseInt(id);
    
    // Prevent deleting yourself
    if (userId === session.id) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 }
      );
    }
    
    const success = deleteUser(userId);
    
    if (!success) {
      return NextResponse.json(
        { message: 'Failed to delete user. User may be the last admin.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'Failed to delete user' },
      { status: 500 }
    );
  }
}