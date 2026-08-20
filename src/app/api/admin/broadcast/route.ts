import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth && auth.startsWith('Bearer ');
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { message } = await req.json();
  
  if (!message) {
    return NextResponse.json({ error: 'Message missing' }, { status: 400 });
  }

  // Use the server Supabase client to dispatch the broadcast safely
  const channel = supabase.channel('public:leaderboard');
  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'admin:broadcast:alert',
          payload: { message }
        });
        await supabase.removeChannel(channel);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        resolve();
      }
    });
  });

  return NextResponse.json({ success: true });
}
