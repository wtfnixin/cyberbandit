import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/utils/db';

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const { rows } = await db.query(
      'SELECT id, name, "startDirectory", "initialVFS" FROM "Task" WHERE id = $1',
      [taskId]
    );
    const task = rows[0];

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        id: task.id,
        name: task.name,
        startDirectory: task.startDirectory,
        initialVFS: task.initialVFS
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
