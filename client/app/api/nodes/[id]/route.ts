import { NextRequest, NextResponse } from 'next/server';
import { getNode, updateNode, deleteNode } from '@/lib/db-json';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const node = getNode(parseInt(id));
    
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(node);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch node' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { id } = await params;
    const data = await request.json();
    const success = updateNode(parseInt(id), data);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update node' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { id } = await params;
    const success = deleteNode(parseInt(id));
    
    if (!success) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}