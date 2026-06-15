import sql from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();

  const [row] = await sql`
    update experiments set
      title = ${body.title || null},
      status = ${body.status || null},
      started_at = ${body.started_at || null},
      ended_at = ${body.ended_at || null},
      problem = ${body.problem || null},
      hypothesis = ${body.hypothesis || null},
      test_purpose = ${body.test_purpose || null},
      test_metrics = ${body.test_metrics || null},
      test_initial_config = ${body.test_initial_config || null},
      test_config_rationale = ${body.test_config_rationale || null},
      test_scenarios = ${body.test_scenarios || null},
      test_target = ${body.test_target || null},
      test_success_criteria = ${body.test_success_criteria || null},
      baseline = ${body.baseline || null},
      findings = ${body.findings || null},
      interpretation = ${body.interpretation || null},
      root_cause = ${body.root_cause || null},
      conclusion = ${body.conclusion || null},
      next_action = ${body.next_action || null},
      architecture_ids = ${body.architecture_ids || []},
      perf_ids = ${body.perf_ids || []},
      incident_ids = ${body.incident_ids || []}
    where id = ${id} returning *`;
  return NextResponse.json(JSON.parse(JSON.stringify(row)));
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await sql`delete from experiments where id = ${id}`;
  return NextResponse.json({ ok: true });
}