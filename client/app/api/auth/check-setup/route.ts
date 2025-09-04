import { NextResponse } from 'next/server';
import { userExists } from '@/lib/db-json';

export async function GET() {
  try {
    const exists = userExists();
    return NextResponse.json({ userExists: exists });
  } catch (error) {
    // If database isn't initialized yet, no user exists
    return NextResponse.json({ userExists: false });
  }
}