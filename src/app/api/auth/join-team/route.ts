import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/utils/db';

const joinLimits = new Map<string, { count: number; resetTime: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    const now = Date.now();
    const limitData = joinLimits.get(ip);

    if (limitData && now < limitData.resetTime) {
      if (limitData.count >= 10) {
        return NextResponse.json({ error: 'Too many auth attempts. Please slow down and try again in 1 minute.' }, { status: 429 });
      }
      limitData.count++;
    } else {
      joinLimits.set(ip, { count: 1, resetTime: now + 60000 });
    }

    const { email, inviteCode } = await req.json();

    if (!email || !inviteCode) {
      return NextResponse.json({ error: 'Email and team code required' }, { status: 400 });
    }

    // Try to find the team by invite code
    const { rows: teamRows } = await db.query('SELECT * FROM "Team" WHERE "inviteCode" = $1', [inviteCode.trim().toUpperCase()]);
    const team = teamRows[0];

    if (!team) {
      return NextResponse.json({ error: 'Invalid Team Code. Please ask your administrator to create this team.' }, { status: 400 });
    }

    // Verify the user by email
    const { rows: userRows } = await db.query('SELECT * FROM "User" WHERE email = $1', [email.trim().toLowerCase()]);
    const user = userRows[0];
    
    if (!user) {
       return NextResponse.json({ 
         error: 'Email not recognized. Only pre-registered emails designated by the administrator can join this team.' 
       }, { status: 403 });
    }

    if (user.teamId !== team.id) {
       return NextResponse.json({ 
         error: 'This email is registered, but does not belong to this specific team.' 
       }, { status: 403 });
    }

    // Fetch active Level and Tasks — default to Level 1 if team has no level set
    const levelId = team.currentLevelId || 1;
    
    const levelPromise = db.query('SELECT * FROM "Level" WHERE id = $1', [levelId]);
    const tasksPromise = db.query('SELECT * FROM "Task" WHERE "levelId" = $1', [levelId]);
    
    const [levelRes, tasksRes] = await Promise.all([levelPromise, tasksPromise]);

    const level = levelRes.rows[0] || null;
    const tasks = tasksRes.rows || [];

    const token = Buffer.from(JSON.stringify({ userId: user.username, teamId: team.id })).toString('base64');

    return NextResponse.json({
      token,
      user: { username: user.username, teamId: team.id },
      team,
      level,
      tasks
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
