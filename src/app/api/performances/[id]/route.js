import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const [row] = await sql`
    update performances set
      title = ${body.title || null},
      date = ${body.date || null},
      tools = ${body.tools || null},
      environment = ${body.environment || null},
      summary = ${body.summary || null},
      metrics_snapshot = ${body.metrics_snapshot || null},
      notes = ${body.notes || null}
    where id = ${id} returning *`;
  return NextResponse.json(row);
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await sql`delete from performances where id = ${id}`;
  return NextResponse.json({ ok: true });
}