import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from performances order by date desc`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const body = await req.json();
  const [row] = await sql`
    insert into performances (
      title, date, tools, environment, summary, metrics_snapshot, notes
    ) values (
      ${body.title || null},
      ${body.date || null},
      ${body.tools || null},
      ${body.environment || null},
      ${body.summary || null},
      ${body.metrics_snapshot || null},
      ${body.notes || null}
    ) returning *`;
  return NextResponse.json(row);
}