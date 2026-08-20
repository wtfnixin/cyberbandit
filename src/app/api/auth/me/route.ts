export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/utils/db';

function parseToken(token: string) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = auth.replace('Bearer ', '');
    const decoded = parseToken(token);

    if (!decoded?.teamId || !decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = await db.connect();

    try {
      // 1. Fetch team and user read-only without locks or transactions
      const teamPromise = client.query('SELECT * FROM "Team" WHERE id = $1', [decoded.teamId]);
      const userPromise = client.query('SELECT * FROM "User" WHERE id = $1', [decoded.userId]);
      const [teamRes, userRes] = await Promise.all([teamPromise, userPromise]);

      let team = teamRes.rows[0];
      const user = userRes.rows[0];

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      let currentLevelId = team.currentLevelId || 1;

      // Keep advancing currentLevelId if all tasks of the current level are completed
      let advanced = false;
      const { rows: maxLevelRes } = await client.query('SELECT MAX(id) AS max_id FROM "Level"');
      const maxLevelId = parseInt(maxLevelRes[0]?.max_id || '1', 10);

      while (currentLevelId < maxLevelId) {
        const { rows: levelTasks } = await client.query('SELECT id FROM "Task" WHERE "levelId" = $1', [currentLevelId]);
        const taskIds = levelTasks.map((t: any) => t.id);
        
        if (taskIds.length === 0) {
          currentLevelId++;
          advanced = true;
          continue;
        }

        const { rows: solves } = await client.query(
          'SELECT DISTINCT "taskId" FROM "Submission" WHERE "teamId" = $1 AND "isCorrect" = true AND "taskId" = ANY($2)',
          [decoded.teamId, taskIds]
        );

        if (solves.length >= taskIds.length) {
          currentLevelId++;
          advanced = true;
        } else {
          break;
        }
      }

      // 2. Only run write transaction under lock if the team has advanced to a new level
      if (advanced) {
        try {
          await client.query('BEGIN');
          const lockRes = await client.query('SELECT "currentLevelId" FROM "Team" WHERE id = $1 FOR UPDATE', [decoded.teamId]);
          const lockedLevelId = lockRes.rows[0]?.currentLevelId || 1;
          if (lockedLevelId < currentLevelId) {
            await client.query('UPDATE "Team" SET "currentLevelId" = $1 WHERE id = $2', [currentLevelId, decoded.teamId]);
          }
          await client.query('COMMIT');
          const reloadedTeam = await client.query('SELECT * FROM "Team" WHERE id = $1', [decoded.teamId]);
          team = reloadedTeam.rows[0];
        } catch (trxErr) {
          await client.query('ROLLBACK');
          throw trxErr;
        }
      }

      const levelPromise = client.query('SELECT * FROM "Level" WHERE id = $1', [currentLevelId]);
      const tasksPromise = client.query('SELECT * FROM "Task" WHERE "levelId" = $1', [currentLevelId]);
      const subsPromise = client.query('SELECT "taskId" FROM "Submission" WHERE "teamId" = $1 AND "isCorrect" = true', [decoded.teamId]);
      const logsPromise = client.query(
        `SELECT s.id, s."createdAt", u.username, t.name as "taskName", t.points 
         FROM "Submission" s 
         JOIN "User" u ON s."userId" = u.id 
         JOIN "Task" t ON s."taskId" = t.id 
         WHERE s."teamId" = $1 AND s."isCorrect" = true 
         ORDER BY s."createdAt" DESC LIMIT 10`,
        [decoded.teamId]
      );

      const [levelRes, tasksRes, subsRes, logsRes] = await Promise.all([levelPromise, tasksPromise, subsPromise, logsPromise]);

      const level = levelRes.rows[0] || null;
      const tasks = tasksRes.rows || [];
      const solvedTaskIds = subsRes.rows ? subsRes.rows.map((s: any) => s.taskId) : [];
      const activityLogs = logsRes.rows || [];

      return NextResponse.json({
        user: { username: decoded.userId, teamId: decoded.teamId },
        team,
        level,
        tasks,
        solvedTaskIds,
        activityLogs
      }, {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate'
        }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
