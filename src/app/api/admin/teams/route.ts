export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

// Helper to check token blindly for demo purposes
function isAuthenticated(req: NextRequest) {
   const auth = req.headers.get('authorization');
   return auth && auth.startsWith('Bearer ');
}

function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')       // strip html tags
    .replace(/[<>"'`]/g, '')       // strip quotes/angles
    .trim()
    .slice(0, 128);                // max length 128
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data: teams, error } = await supabase.from('Team').select('*').order('score', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const { data: users, error: userError } = await supabase.from('User').select('*');
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  
  // Transform the response to mock allowedEmails using the registered users to satisfy the UI
  const populatedTeams = teams.map((team: any) => {
    const teamUsers = users.filter((u: any) => u.teamId === team.id);
    return {
      ...team,
      allowedEmails: teamUsers || [],
      users: teamUsers || []
    };
  });

  return NextResponse.json(populatedTeams);
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { name, members } = await req.json();
  const safeName = sanitizeInput(name);

  if (members && Array.isArray(members) && members.length > 2) {
    return NextResponse.json({ error: 'Maximum 2 members allowed per team.' }, { status: 400 });
  }

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const { data: team, error } = await supabase.from('Team').insert([{
     id: inviteCode,
     name: safeName,
     inviteCode
  }]).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (members && Array.isArray(members)) {
    const usersToInsert = members.map((m: any) => ({
      id: `USER-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      username: sanitizeInput(m.name) || sanitizeInput(m.email).split('@')[0],
      email: sanitizeInput(m.email),
      teamId: team.id
    }));
    if (usersToInsert.length > 0) {
      await supabase.from('User').insert(usersToInsert);
    }
  }

  return NextResponse.json(team);
}
