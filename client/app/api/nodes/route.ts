import { NextRequest, NextResponse } from 'next/server';
import { getNodes, createNode } from '@/lib/db-json';
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
  if (!session || !session.isAdmin) {
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