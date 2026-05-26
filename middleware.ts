import { type NextRequest, NextResponse } from 'next/server';

// Auth gating lands in sub-project #2. For Foundation, this middleware is a no-op
// pass-through so the matcher is wired up and ready.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
