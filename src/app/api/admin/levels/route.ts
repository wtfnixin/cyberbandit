export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth && auth.startsWith('Bearer ');
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data, error } = await supabase.from('Level').select('*, tasks:Task(*)').order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  const { data, error } = await supabase.from('Level').insert([{
     id: body.id || Math.floor(Math.random() * 1000) + 10,
     title: body.title,
     description: body.description || '',
     points: body.points || 100
  }]).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

