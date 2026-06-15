import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const [row] = await sql`
    update incidents set
      title = ${body.title || null},
      severity = ${body.severity || null},
      status = ${body.status || null},
      detected_at = ${body.detected_at || null},
      resolved_at = ${body.resolved_at || null},
      how_detected = ${body.how_detected || null},
      affected = ${body.affected || null},
      root_cause = ${body.root_cause || null},
      resolution = ${body.resolution || null}
    where id = ${id} returning *`;
  return NextResponse.json(row);
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await sql`delete from incidents where id = ${id}`;
  return NextResponse.json({ ok: true });
}