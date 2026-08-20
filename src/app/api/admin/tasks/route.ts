import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth && auth.startsWith('Bearer ');
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  const { data, error } = await supabase.from('Task').insert([{
    id: body.id || `TASK_${Date.now()}`,
    levelId: body.levelId,
    name: body.name,
    taskRole: body.taskRole,
    points: body.points,
    startDirectory: body.startDirectory,
    validationType: body.validationType,
    validationTarget: body.validationTarget,
    hintText: body.hintText,
    initialVFS: body.initialVFS || {}
  }]).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
