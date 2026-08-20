import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth && auth.startsWith('Bearer ');
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const teamId = params.id;
  const { error } = await supabase.from('Team').delete().eq('id', teamId);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
