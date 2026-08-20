import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/utils/db';

let cachedLevels: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes cache

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth) return NextResponse.json([], { status: 401 });
    
    const now = Date.now();
    if (cachedLevels && (now - lastCacheTime < CACHE_TTL)) {
      return NextResponse.json(cachedLevels);
    }
    
    // Parallel select levels and tasks for highest performance
    const levelsPromise = db.query('SELECT * FROM "Level" ORDER BY id ASC');
    const tasksPromise = db.query('SELECT * FROM "Task" ORDER BY "levelId" ASC, id ASC');
    
    const [levelsRes, tasksRes] = await Promise.all([levelsPromise, tasksPromise]);
    
    const tasks = tasksRes.rows;
    const levels = levelsRes.rows.map((level: any) => {
      return {
        ...level,
        tasks: tasks.filter((t: any) => t.levelId === level.id)
      };
    });

    cachedLevels = levels;
    lastCacheTime = now;
    
    return NextResponse.json(levels);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
