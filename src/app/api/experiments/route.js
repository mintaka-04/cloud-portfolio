import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from experiments order by created_at desc`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const body = await req.json();
  const [row] = await sql`
    insert into experiments (
      title, status, started_at, ended_at, problem, hypothesis,
      test_purpose, test_metrics, test_initial_config, test_config_rationale,
      test_scenarios, test_target, test_success_criteria, baseline, findings,
      interpretation, root_cause, conclusion, next_action,
      architecture_ids, perf_ids, incident_ids
    ) values (
      ${body.title || null},
      ${body.status || null},
      ${body.started_at || null},
      ${body.ended_at || null},
      ${body.problem || null},
      ${body.hypothesis || null},
      ${body.test_purpose || null},
      ${body.test_metrics || null},
      ${body.test_initial_config || null},
      ${body.test_config_rationale || null},
      ${body.test_scenarios || null},
      ${body.test_target || null},
      ${body.test_success_criteria || null},
      ${body.baseline || null},
      ${body.findings || null},
      ${body.interpretation || null},
      ${body.root_cause || null},
      ${body.conclusion || null},
      ${body.next_action || null},
      ${body.architecture_ids || []},
      ${body.perf_ids || []},
      ${body.incident_ids || []}
    ) returning *`;
  return NextResponse.json(row);
}