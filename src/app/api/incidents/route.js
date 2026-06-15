import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from incidents order by detected_at desc`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const body = await req.json();
  const [row] = await sql`
    insert into incidents (
      title, severity, status, detected_at, resolved_at,
      how_detected, affected, root_cause, resolution
    ) values (
      ${body.title || null},
      ${body.severity || null},
      ${body.status || null},
      ${body.detected_at || null},
      ${body.resolved_at || null},
      ${body.how_detected || null},
      ${body.affected || null},
      ${body.root_cause || null},
      ${body.resolution || null}
    ) returning *`;
  return NextResponse.json(row);
}