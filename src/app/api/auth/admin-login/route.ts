import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'admin';

    // Validate strictly against ENV
    if (username === envUser && password === envPass) {
      return NextResponse.json({
        token: Buffer.from(JSON.stringify({ role: 'admin', timestamp: Date.now() })).toString('base64'),
        user: { username: 'admin' }
      });
    }

    return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
