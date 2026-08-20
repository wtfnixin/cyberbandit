import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/utils/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { rows: teams } = await db.query(
      'SELECT id, name, score, "currentLevelId" FROM "Team" ORDER BY score DESC LIMIT 50'
    );
    return NextResponse.json(teams);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
