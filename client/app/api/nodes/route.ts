import { NextRequest, NextResponse } from 'next/server';
import { getNodes, createNode, updateNode, deleteNode, getNode } from '@/lib/db-json';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const nodes = getNodes();
    return NextResponse.json(nodes);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { name, url, apiKey, category } = await request.json();
    
    if (!name || !url || !apiKey) {
      return NextResponse.json(
        { error: 'Name, URL, and API key are required' },
        { status: 400 }
      );
    }
    
    const node = createNode(name, url, apiKey, category);
    return NextResponse.json(node);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Node ID is required' },
        { status: 400 }
      );
    }
    
    const data = await request.json();
    const success = updateNode(parseInt(id), data);
    
    if (success) {
      const updatedNode = getNode(parseInt(id));
      return NextResponse.json(updatedNode);
    } else {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.roleId !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Node ID is required' },
        { status: 400 }
      );
    }
    
    const success = deleteNode(parseInt(id));
    
    if (success) {
      return NextResponse.json({ message: 'Node deleted successfully' });
    } else {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}