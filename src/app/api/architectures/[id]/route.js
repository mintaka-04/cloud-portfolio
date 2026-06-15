import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const [row] = await sql`
    update architectures set
      version = ${body.version || null},
      title = ${body.title || null},
      date = ${body.date || null},
      change_type = ${body.change_type || null},
      background = ${body.background || null},
      alternatives = ${body.alternatives || null},
      tech_rationale = ${body.tech_rationale || null},
      before_arch = ${body.before || null},
      after_arch = ${body.after || null},
      components = ${body.components || null},
      expected = ${body.expected || null},
      actual = ${body.actual || null},
      tags = ${body.tags || []}
    where id = ${id} returning *`;
  return NextResponse.json(row);
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await sql`delete from architectures where id = ${id}`;
  return NextResponse.json({ ok: true });
}