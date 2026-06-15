import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from architectures order by date desc`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const body = await req.json();
  const [row] = await sql`
    insert into architectures (
      version, title, date, change_type, background, alternatives,
      tech_rationale, before_arch, after_arch, components, expected, actual, tags
    ) values (
      ${body.version || null},
      ${body.title || null},
      ${body.date || null},
      ${body.change_type || null},
      ${body.background || null},
      ${body.alternatives || null},
      ${body.tech_rationale || null},
      ${body.before || null},
      ${body.after || null},
      ${body.components || null},
      ${body.expected || null},
      ${body.actual || null},
      ${body.tags || []}
    ) returning *`;
  return NextResponse.json(row);
}