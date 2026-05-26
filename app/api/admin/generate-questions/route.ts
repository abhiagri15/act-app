import { NextResponse } from 'next/server';
import { runGeneration } from '@/app/lib/ai/generate';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes — Ollama Cloud latency for a passage+questions
// round-trip can exceed 60s. Pro plan only; on Hobby this is capped at 60s
// and the call will time out for large batches, but the cron still ticks the
// pool forward incrementally.
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runGeneration();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
