import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from experiments order by started_at desc`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const body = await req.json();
  const [row] = await sql`
    insert into experiments (
      id, title, hypothesis, status, validation,
      result_metrics, primary_metric_name, primary_metric_value,
      conclusion, problem_found, improvement,
      github_doc_url, diagram_url, arch_version, tags,
      started_at, ended_at
    ) values (
      ${body.id},
      ${body.title},
      ${body.hypothesis},
      ${body.status || 'draft'},
      ${body.validation || null},
      ${body.result_metrics ? JSON.stringify(body.result_metrics) : null},
      ${body.primary_metric_name || null},
      ${body.primary_metric_value || null},
      ${body.conclusion || null},
      ${body.problem_found || null},
      ${body.improvement || null},
      ${body.github_doc_url},
      ${body.diagram_url || null},
      ${body.arch_version || null},
      ${body.tags || []},
      ${body.started_at},
      ${body.ended_at || null}
    ) returning *`;
  return NextResponse.json(row);
}