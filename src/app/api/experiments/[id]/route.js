import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const [row] = await sql`
    update experiments set
      title = ${body.title},
      hypothesis = ${body.hypothesis},
      status = ${body.status || 'draft'},
      validation = ${body.validation || null},
      result_metrics = ${body.result_metrics ? JSON.stringify(body.result_metrics) : null},
      primary_metric_name = ${body.primary_metric_name || null},
      primary_metric_value = ${body.primary_metric_value || null},
      conclusion = ${body.conclusion || null},
      problem_found = ${body.problem_found || null},
      improvement = ${body.improvement || null},
      github_doc_url = ${body.github_doc_url},
      diagram_url = ${body.diagram_url || null},
      arch_version = ${body.arch_version || null},
      tags = ${body.tags || []},
      started_at = ${body.started_at},
      ended_at = ${body.ended_at || null}
    where id = ${id} returning *`;
  return NextResponse.json(row);
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await sql`delete from experiments where id = ${id}`;
  return NextResponse.json({ ok: true });
}