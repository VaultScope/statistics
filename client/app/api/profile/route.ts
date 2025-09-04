import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, updateUser, verifyPassword, hashPassword, getAllUsers } from '@/lib/db-json';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const user = getUserById(session.id);
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  // Remove password hash from response
  const { password, ...profile } = user;
  
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { username, firstName, email, currentPassword, newPassword } = await request.json();
    
    if (!username || !firstName) {
      return NextResponse.json(
        { error: 'Username and first name are required' },
        { status: 400 }
      );
    }
    
    const user = getUserById(session.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if username is taken by another user
    if (username !== user.username) {
      const users = getAllUsers();
      const usernameTaken = users.some(u => u.username === username && u.id !== session.id);
      
      if (usernameTaken) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        );
      }
    }
    
    // Prepare update data
    const updateData: any = {
      username,
      firstName,
      email: email || ''
    };
    
    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set new password' },
          { status: 400 }
        );
      }
      
      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
      
      // Hash new password
      updateData.password = await hashPassword(newPassword);
    }
    
    // Update user
    const success = updateUser(session.id, updateData);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }
    
    // Get updated user and return without password
    const updatedUser = getUserById(session.id);
    if (updatedUser) {
      const { password, ...profile } = updatedUser;
      return NextResponse.json(profile);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}