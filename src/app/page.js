'use client';

import { useState, useEffect } from 'react';

// ── Color System ──────────────────────────────────────
const C = {
  bg:          "#3A606E",
  surface:     "#607B7D",
  surfaceDeep: "#4E6870",
  border:      "#828E82",
  muted:       "#828E82",
  soft:        "#AAAE8E",
  light:       "#E0E0E0",
};

// ── Sample Data ────────────────────────────────────────
const initExperiments = [
  {
    id:"exp1", title:"EC2 → ECS Fargate 전환", status:"in_progress",
    started_at:"2026-05-25", ended_at:"",
    problem:"EC2 기반 단일 인스턴스 구조에서 scale-up 한계 확인. 분당 최대 2,900건 backlog 증가, 최대 14,000까지 누적.",
    hypothesis:"ECS Fargate 기반 scale-out 구조로 전환하면 auto scaling을 통해 트래픽 증가에 대응 가능할 것",
    test_purpose:"ECS Fargate auto scaling 환경에서 시스템 안정/임계/한계 구간 도출.",
    test_metrics:"[SQS] backlog 수, 메시지 처리 지연\n[ECS] Running/Desired Task Count, Scale-out/in 속도\n[App] 지연율(avg, p95), 에러율",
    test_initial_config:"scale-out threshold: 1440\nscale-in threshold: 500\n감지 주기: 60s / scale step: +3/-1\nmin/max worker: 1/20\ncooldown: scale-out 60s / scale-in 180s",
    test_config_rationale:"worker 1개당 초당 24건 처리 필요 추정. 허용 반응시간 60초 기준 threshold 산정. CloudWatch metric이 60s 단위 집계임을 테스트 중 확인하여 초기값 재조정.",
    test_scenarios:"1. 베이스라인: VU 1\n2. 점진적 부하: VUs 10→30→50→100, 각 2~3분\n3. 스파이크: VUs 10→100→10 (100구간 30초)\n4. 소크: VUs 30, 10분",
    test_target:"메모리 생성 → 상세 조회 사용자 트랜잭션",
    test_success_criteria:"임계: avg 1.88s 또는 p95 2.02s 초과\n한계: avg 3.76s 또는 p95 4.04s 초과, 에러율 5% 이상",
    baseline:"avg 0.94s / p95 1.01s / 에러율 0% (3~10회차 평균)",
    findings:"- request rate 약 80 req/s에서 포화\n- request waiting 시간이 전체 duration 대부분 차지\n- request blocked 주기적 스파이크 발생\n- PostgREST timeout 발생\n- SQS backlog 최대 14,000까지 누적\n- ECS scale-out 자체는 정상 동작",
    interpretation:"PostgREST worker가 DB 처리 대기로 점유 지속 → 내부 요청 누적 → timeout. PostgreSQL 자체 에러는 없음.",
    root_cause:"Supabase Realtime의 realtime.list_changes 쿼리가 전체 DB 실행 시간의 68.9% 점유.",
    conclusion:"PostgREST 자체 한계가 아닌 Supabase Realtime의 DB 부하가 원인. 이벤트 처리 구조를 DB에서 분리 필요.",
    next_action:"Supabase Realtime 이벤트 트리거를 SQS 기반으로 교체",
    architecture_ids:["arch1"], perf_ids:["perf1"], incident_ids:["inc1"],
  },
  {
    id:"exp2", title:"Supabase Realtime → SQS 이벤트 트리거 전환", status:"resolved",
    started_at:"2026-06-08", ended_at:"2026-06-08",
    problem:"Supabase Realtime 기반 이벤트 트리거가 부하 시 DB에 병목을 유발. realtime.list_changes 쿼리가 전체 DB 실행 시간의 68.9% 점유.",
    hypothesis:"이벤트 처리를 DB에서 분리하여 API → SQS → Worker 구조로 전환하면 DB 부하 감소 및 수평 확장 가능",
    test_purpose:"", test_metrics:"", test_initial_config:"", test_config_rationale:"",
    test_scenarios:"", test_target:"", test_success_criteria:"",
    baseline:"", findings:"", interpretation:"", root_cause:"",
    conclusion:"DB 중심 구조에서 이벤트 기반 구조로 전환 완료. Fallback worker 및 Idempotency 설계로 신뢰성 확보.",
    next_action:"전환 후 동일 조건 부하테스트로 검증 필요",
    architecture_ids:["arch2"], perf_ids:[], incident_ids:[],
  },
];

const initArchitectures = [
  {
    id:"arch1", version:"v2.0", title:"EC2 → ECS Fargate 전환",
    date:"2026-05-25", change_type:"major",
    background:"EC2 단일 인스턴스에서 지속적인 backlog 누적 확인. scale-up은 비용 대비 한계가 명확.",
    alternatives:"1) EC2 scale-up: 비용 증가, 한계 존재\n2) ECS EC2: 관리 오버헤드\n3) ECS Fargate: 서버리스, 관리 간소화 → 선택",
    tech_rationale:"Fargate는 인프라 관리 없이 컨테이너 단위 scale-out 가능. SQS backlog 기반 auto scaling과 조합이 자연스러움.",
    before:"Client → EC2 단일 인스턴스 → Supabase DB → Supabase Realtime → AI Worker",
    after:"Client → ECS Fargate (auto scaling) → Supabase DB → Supabase Realtime → AI Worker",
    components:"ECS Fargate 클러스터 추가, Auto Scaling 정책 설정, SQS backlog 기반 scaling 트리거",
    expected:"트래픽 증가 시 worker 자동 증가, backlog 누적 방지",
    actual:"ECS scale-out 자체는 정상 동작. 단, PostgREST timeout 발생 — Realtime 병목 미해결.",
    tags:["ecs","fargate","auto-scaling","aws"],
  },
  {
    id:"arch2", version:"v2.1", title:"Supabase Realtime → SQS 이벤트 트리거 전환",
    date:"2026-06-08", change_type:"major",
    background:"Realtime 내부 쿼리(realtime.list_changes)가 부하 시 DB 리소스를 과점유.",
    alternatives:"1) DB trigger → SQS: 구현/운영 복잡도 높음\n2) API 서버 → SQS: 애플리케이션 레벨 제어, 재시도/로깅 유연 → 선택",
    tech_rationale:"SQS는 at-least-once 보장, DLQ 지원, ECS auto scaling 트리거로 활용 가능.",
    before:"Client → Supabase DB (insert) → Supabase Realtime → AI Worker",
    after:"Client → API Server → Supabase DB (insert) + SQS (publish) → Rule Worker → AI Worker",
    components:"SQS Event Queue / AI Queue 추가, DLQ 설정(maxReceiveCount=2), status 컬럼 추가, Fallback worker 구성",
    expected:"DB 부하 감소, 비동기 처리로 수평 확장, SQS 장애 시 Fallback으로 데이터 유실 방지",
    actual:"구조 전환 완료. 부하테스트로 검증 예정.",
    tags:["sqs","event-driven","worker","supabase","dlq"],
  },
];

const initPerfs = [
  {
    id:"perf1", title:"ECS Fargate 도입 후 부하테스트 — 주요 지표",
    date:"2026-06-02", tools:"k6, CloudWatch", environment:"staging",
    summary:"request rate 약 80 req/s에서 포화. 이후 waiting 급증, PostgREST timeout 발생.",
    metrics_snapshot:"baseline avg: 0.94s / p95: 1.01s\n포화 구간 p95: ~3s 초과\nrequest rate 포화: 80 req/s\nSQS backlog 최대: 14,000",
    notes:"request waiting이 전체 duration 대부분 차지. blocked 주기적 스파이크 패턴 확인.",
  },
];

const initIncidents = [
  {
    id:"inc1", title:"PostgREST timeout (Thread killed by timeout manager)",
    severity:"high", status:"resolved",
    detected_at:"2026-06-02T13:52", resolved_at:"2026-06-08T00:00",
    how_detected:"k6 부하테스트 중 request waiting 급증 및 CloudWatch 로그에서 'Thread killed by timeout manager' 반복 확인",
    affected:"PostgREST, AI Worker 처리 파이프라인",
    root_cause:"Supabase Realtime 내부 쿼리(realtime.list_changes)가 부하 시 DB 리소스를 과점유 → PostgREST worker 대기 지속 → timeout",
    resolution:"Supabase Realtime 이벤트 트리거 제거, SQS 기반 비동기 처리 구조로 전환",
  },
];

// ── Helpers ────────────────────────────────────────────
const STATUS_META  = { in_progress:{label:"In Progress",color:"#A28F9D"}, resolved:{label:"Resolved",color:"#DFF8EB"}, failed:{label:"Failed",color:"#E07B7B"} };
const RESULT_META  = { pass:{label:"PASS",color:"#DFF8EB"}, fail:{label:"FAIL",color:"#E07B7B"}, partial:{label:"PARTIAL",color:"#A28F9D"} };
const SEV_COLOR    = { critical:"#E07B7B", high:"#C4956A", medium:"#A28F9D", low:"#74776B" };
const CHANGE_COLOR = { major:"#DFF8EB", minor:"#A28F9D", patch:"#74776B" };
const TYPE_COLOR   = { Experiment:"#DFF8EB", Architecture:"#A28F9D", Performance:"#74776B", Incident:"#E07B7B" };

const badge = (label, color) => (
  <span style={{ background:color+"28", color, border:`1px solid ${color}55`, borderRadius:4, padding:"1px 8px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{label}</span>
);
const SLabel = ({ children }) => (
  <div style={{ color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6, fontWeight:600 }}>{children}</div>
);
const Block = ({ label, children }) => (
  <div style={{ marginBottom:18 }}>
    <SLabel>{label}</SLabel>
    <div style={{ color:C.soft, fontSize:14, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{children||"—"}</div>
  </div>
);
const Divider = ({ label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12, margin:"28px 0 20px" }}>
    <div style={{ flex:1, height:1, background:C.border+"66" }} />
    <span style={{ color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:2, fontWeight:600 }}>{label}</span>
    <div style={{ flex:1, height:1, background:C.border+"66" }} />
  </div>
);

const Card = ({ children, style, onClick }) => {
  const { background, borderColor, ...rest } = style||{};
  return (
    <div onClick={onClick}
      style={{ background:background||C.surface, border:`1px solid ${borderColor||C.border}`, borderRadius:8, padding:20, cursor:onClick?"pointer":"default", transition:"border-color 0.15s", ...rest }}
      onMouseEnter={onClick?e=>e.currentTarget.style.borderColor=C.light:undefined}
      onMouseLeave={onClick?e=>e.currentTarget.style.borderColor=borderColor||C.border:undefined}>
      {children}
    </div>
  );
};

const Inset = ({ children, style }) => (
  <div style={{ background:C.surfaceDeep, borderRadius:6, padding:14, ...style }}>{children}</div>
);

const Btn = ({ children, onClick, variant="primary", small }) => {
  const s = {
    primary: { background:C.border, color:C.light, border:"none" },
    ghost:   { background:"transparent", color:C.muted, border:`1px solid ${C.border}` },
    danger:  { background:"#E07B7B22", color:"#E07B7B", border:"1px solid #E07B7B55" },
  }[variant];
  return <button onClick={onClick} style={{ ...s, borderRadius:4, padding:small?"4px 10px":"7px 16px", fontSize:small?12:13, cursor:"pointer", fontWeight:500 }}>{children}</button>;
};

const Input = ({ label, value, onChange, type="text", options, hint }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ color:C.muted, fontSize:12, display:"block", marginBottom:4 }}>
      {label}{hint&&<span style={{ color:C.border, fontSize:11, marginLeft:6 }}>{hint}</span>}
    </label>
    {options ? (
      <select value={value ?? ''} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, padding:"6px 10px", color:C.soft, fontSize:13 }}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    ) : type==="textarea" ? (
      <textarea value={value ?? ''} onChange={e=>onChange(e.target.value)} rows={4}
        style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, padding:"6px 10px", color:C.soft, fontSize:13, resize:"vertical", boxSizing:"border-box", fontFamily:"inherit", lineHeight:1.6 }} />
    ) : (
      <input type={type} value={value ?? ''} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, padding:"6px 10px", color:C.soft, fontSize:13, boxSizing:"border-box" }} />
    )}
  </div>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}66` }}>
    {tabs.map(t=>(
      <button key={t.id} onClick={()=>onChange(t.id)}
        style={{ background:"none", border:"none", color:active===t.id?C.light:C.muted, padding:"8px 16px", cursor:"pointer", fontSize:13, fontWeight:active===t.id?600:400, borderBottom:active===t.id?`2px solid ${C.light}`:"2px solid transparent", marginBottom:-1 }}>
        {t.label}
      </button>
    ))}
  </div>
);

function RelatedBar({ items, nav }) {
  if (!items||items.length===0) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", padding:"8px 12px", background:C.surfaceDeep, border:`1px solid ${C.border}`, borderRadius:6, marginBottom:16 }}>
      <span style={{ color:C.muted, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginRight:4 }}>Related</span>
      {items.map((item,i)=>(
        <button key={i} onClick={()=>nav(item.page,item.id)}
          style={{ background:TYPE_COLOR[item.type]+"18", border:`1px solid ${TYPE_COLOR[item.type]}44`, borderRadius:4, padding:"3px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ color:TYPE_COLOR[item.type], fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{item.type}</span>
          <span style={{ color:C.soft, fontSize:12 }}>{item.title}</span>
        </button>
      ))}
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────
const NAV = [
  { id:"dashboard",    label:"Dashboard" },
  { id:"experiments",  label:"Experiments" },
  { id:"architecture", label:"Architecture" },
  { id:"performance",  label:"Performance" },
  { id:"incidents",    label:"Incidents" },
];

// ── Dashboard ──────────────────────────────────────────
function Dashboard({ experiments, architectures, perfs, incidents, nav }) {
  const latestArch = [...architectures].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const latestExp  = [...experiments].sort((a,b)=>b.started_at.localeCompare(a.started_at))[0];
  const openInc    = incidents.filter(i=>i.status!=="resolved");
  const expArch    = latestExp ? architectures.filter(a=>latestExp.architecture_ids.includes(a.id)) : [];
  const expPerf    = latestExp ? perfs.filter(p=>latestExp.perf_ids.includes(p.id)) : [];
  const expInc     = latestExp ? incidents.filter(i=>latestExp.incident_ids.includes(i.id)) : [];
  const cr = !latestExp ? null
    : latestExp.status==="resolved"           ? {label:"RESOLVED",    color:"#DFF8EB"}
    : expInc.some(i=>i.status!=="resolved")   ? {label:"INCIDENT OPEN",color:"#E07B7B"}
    : expPerf.some(p=>p.result==="fail")      ? {label:"DEGRADED",    color:"#E07B7B"}
    : expPerf.some(p=>p.result==="partial")   ? {label:"IMPROVING",   color:"#A28F9D"}
    : expPerf.some(p=>p.result==="pass")      ? {label:"PASS",        color:"#DFF8EB"}
    :                                           {label:"IN PROGRESS",  color:"#A28F9D"};

  return (
    <div>
      <Divider label="Current State" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
        <Card onClick={()=>nav("architecture")}>
          <SLabel>Current Architecture</SLabel>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
            <span style={{ color:C.light, fontSize:22, fontWeight:700 }}>{latestArch?.version||"—"}</span>
            {latestArch && badge(latestArch.change_type, CHANGE_COLOR[latestArch.change_type])}
          </div>
          <div style={{ color:C.soft, fontSize:13, marginBottom:6 }}>{latestArch?.title}</div>
          <div style={{ color:C.muted, fontSize:11, marginBottom:12 }}>{latestArch?.date}</div>
          <SLabel>After</SLabel>
          <div style={{ color:C.muted, fontSize:12, fontFamily:"monospace", lineHeight:1.6 }}>{latestArch?.after||"—"}</div>
        </Card>
        <Card>
          <SLabel>Open Incidents</SLabel>
          {openInc.length===0
            ? <div style={{ color:"#DFF8EB", fontSize:13, marginTop:4 }}>✓ 열린 이슈 없음</div>
            : openInc.map(i=>(
              <div key={i.id} onClick={()=>nav("inc-detail",i.id)} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}44`, cursor:"pointer" }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                  {badge(i.severity, SEV_COLOR[i.severity])}
                  <span style={{ color:C.soft, fontSize:13 }}>{i.title}</span>
                </div>
                <div style={{ color:C.muted, fontSize:11 }}>{i.detected_at}</div>
              </div>
            ))
          }
        </Card>
      </div>

      <Divider label="Latest Change Cycle" />
      {latestExp ? (
        <Card style={{ borderColor:cr?cr.color+"66":C.border, marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                {badge(STATUS_META[latestExp.status].label, STATUS_META[latestExp.status].color)}
                {cr && badge(cr.label, cr.color)}
              </div>
              <div style={{ color:C.light, fontSize:16, fontWeight:600 }}>{latestExp.title}</div>
              <div style={{ color:C.muted, fontSize:12, marginTop:4 }}>{latestExp.started_at}{latestExp.ended_at?` → ${latestExp.ended_at}`:" → 진행 중"}</div>
            </div>
            <Btn small variant="ghost" onClick={()=>nav("exp-detail",latestExp.id)}>상세 →</Btn>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <Inset>
              <SLabel>🚨 Problem</SLabel>
              <div style={{ color:C.soft, fontSize:13, lineHeight:1.6 }}>{latestExp.problem}</div>
            </Inset>
            <Inset>
              <SLabel>✅ Conclusion</SLabel>
              <div style={{ color:C.soft, fontSize:13, lineHeight:1.6 }}>{latestExp.conclusion||"분석 중..."}</div>
            </Inset>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[
              { label:"Architecture", items:expArch, render:a=><><div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}><span style={{ color:C.light, fontSize:13, fontWeight:600 }}>{a.version}</span>{badge(a.change_type,CHANGE_COLOR[a.change_type])}</div><div style={{ color:C.muted, fontSize:12 }}>{a.title}</div></>, onClick:a=>nav("arch-detail",a.id) },
              { label:"Performance",  items:expPerf, render:p=><><div style={{ color:C.soft, fontSize:13, marginBottom:2 }}>{p.title}</div><div style={{ color:C.muted, fontSize:12 }}>{p.metrics_snapshot?.split("\n")[0]}</div></>, onClick:p=>nav("perf-detail",p.id) },
              { label:"Incident",     items:expInc,  render:i=><><div style={{ display:"flex", gap:6, marginBottom:2 }}>{badge(i.severity,SEV_COLOR[i.severity])}{badge(i.status,i.status==="resolved"?"#DFF8EB":"#E07B7B")}</div><div style={{ color:C.muted, fontSize:12 }}>{i.title}</div></>, onClick:i=>nav("inc-detail",i.id) },
            ].map(({label,items,render,onClick})=>(
              <Inset key={label}>
                <SLabel>{label}</SLabel>
                {items.length===0 ? <div style={{ color:C.muted, fontSize:12 }}>없음</div>
                  : items.map(item=><div key={item.id} onClick={()=>onClick(item)} style={{ cursor:"pointer", marginBottom:8 }}>{render(item)}</div>)}
              </Inset>
            ))}
          </div>
          {latestExp.next_action && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}44` }}>
              <SLabel>➡️ Next Action</SLabel>
              <div style={{ color:C.soft, fontSize:13 }}>{latestExp.next_action}</div>
            </div>
          )}
        </Card>
      ) : <Card><div style={{ color:C.muted, fontSize:13 }}>첫 번째 실험을 기록해보세요.</div></Card>}

      <Divider label="History" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <SLabel>Architecture</SLabel>
            <Btn small variant="ghost" onClick={()=>nav("architecture")}>전체 →</Btn>
          </div>
          {[...architectures].sort((a,b)=>b.date.localeCompare(a.date)).map((a,i)=>(
            <div key={a.id} onClick={()=>nav("arch-detail",a.id)}
              style={{ display:"flex", gap:12, paddingBottom:12, borderLeft:`2px solid ${i===0?C.light:C.border}`, marginLeft:6, paddingLeft:14, position:"relative", cursor:"pointer" }}>
              <div style={{ position:"absolute", left:-5, top:4, width:8, height:8, borderRadius:"50%", background:i===0?C.light:C.surface, border:`2px solid ${i===0?C.light:C.border}` }} />
              <div>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}>
                  <span style={{ color:C.light, fontSize:13, fontWeight:600 }}>{a.version}</span>
                  {badge(a.change_type, CHANGE_COLOR[a.change_type])}
                </div>
                <div style={{ color:C.soft, fontSize:12 }}>{a.title}</div>
                <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>{a.date}</div>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <SLabel>Experiments</SLabel>
            <Btn small variant="ghost" onClick={()=>nav("experiments")}>전체 →</Btn>
          </div>
          {[...experiments].sort((a,b)=>b.started_at.localeCompare(a.started_at)).map(e=>(
            <div key={e.id} onClick={()=>nav("exp-detail",e.id)} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}44`, cursor:"pointer" }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                {badge(STATUS_META[e.status].label, STATUS_META[e.status].color)}
                <span style={{ color:C.soft, fontSize:13 }}>{e.title}</span>
              </div>
              <div style={{ color:C.muted, fontSize:11 }}>{e.started_at}{e.ended_at?` → ${e.ended_at}`:" → 진행 중"}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Experiments ────────────────────────────────────────
function ExperimentList({ experiments, nav, setEditItem }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:C.light, fontSize:18, margin:0 }}>Experiments</h2>
        <Btn onClick={()=>{ setEditItem(null); nav("exp-form"); }}>+ New Experiment</Btn>
      </div>
      {experiments.map(e=>(
        <Card key={e.id} style={{ marginBottom:12 }} onClick={()=>nav("exp-detail",e.id)}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
            {badge(STATUS_META[e.status].label, STATUS_META[e.status].color)}
            <span style={{ color:C.light, fontSize:15, fontWeight:600 }}>{e.title}</span>
          </div>
          <div style={{ color:C.soft, fontSize:13, marginBottom:8, lineHeight:1.5 }}>{e.problem}</div>
          <div style={{ color:C.muted, fontSize:12 }}>{e.started_at}{e.ended_at?` → ${e.ended_at}`:" → 진행 중"} · arch {e.architecture_ids.length} · perf {e.perf_ids.length} · incident {e.incident_ids.length}</div>
        </Card>
      ))}
    </div>
  );
}

function ExperimentDetail({ exp, architectures, perfs, incidents, nav, setEditItem, onDelete }) {
  if (!exp) return null;
  const [tab, setTab] = useState("overview");
  const relArch = architectures.filter(a=>exp.architecture_ids.includes(a.id));
  const relPerf = perfs.filter(p=>exp.perf_ids.includes(p.id));
  const relInc  = incidents.filter(i=>exp.incident_ids.includes(i.id));
  const related = [
    ...relArch.map(a=>({ type:"Architecture", title:`${a.version} ${a.title}`, page:"arch-detail", id:a.id })),
    ...relPerf.map(p=>({ type:"Performance",  title:p.title, page:"perf-detail", id:p.id })),
    ...relInc.map(i=>({ type:"Incident",      title:i.title, page:"inc-detail",  id:i.id })),
  ];
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        <Btn variant="ghost" small onClick={()=>nav("experiments")}>← 목록</Btn>
        <Btn variant="ghost" small onClick={()=>{ setEditItem(exp); nav("exp-form"); }}>편집</Btn>
        <Btn variant="danger" small onClick={()=>{ onDelete(exp.id); nav("experiments"); }}>삭제</Btn>
      </div>
      <RelatedBar items={related} nav={nav} />
      <Card>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          {badge(STATUS_META[exp.status].label, STATUS_META[exp.status].color)}
          <h2 style={{ color:C.light, fontSize:18, margin:0 }}>{exp.title}</h2>
        </div>
        <div style={{ color:C.muted, fontSize:12, marginBottom:20 }}>{exp.started_at}{exp.ended_at?` → ${exp.ended_at}`:" → 진행 중"}</div>
        <Tabs tabs={[{id:"overview",label:"Overview"},{id:"test-design",label:"Test Design"},{id:"results",label:"Results"}]} active={tab} onChange={setTab} />
        {tab==="overview" && <><Block label="🚨 Problem">{exp.problem}</Block><Block label="💡 Hypothesis">{exp.hypothesis}</Block><Block label="✅ Conclusion">{exp.conclusion}</Block><Block label="➡️ Next Action">{exp.next_action}</Block></>}
        {tab==="test-design" && <><Block label="테스트 목적">{exp.test_purpose}</Block><Block label="관찰 지표">{exp.test_metrics}</Block><Block label="초기 설정값">{exp.test_initial_config}</Block><Block label="초기값 설정 근거">{exp.test_config_rationale}</Block><Block label="테스트 시나리오">{exp.test_scenarios}</Block><Block label="테스트 대상">{exp.test_target}</Block><Block label="성공 / 실패 기준">{exp.test_success_criteria}</Block></>}
        {tab==="results" && <><Block label="Baseline">{exp.baseline}</Block><Block label="주요 발견사항">{exp.findings}</Block><Block label="해석">{exp.interpretation}</Block><Block label="Root Cause">{exp.root_cause}</Block><Block label="결론 및 개선사항">{exp.conclusion}</Block></>}
      </Card>
    </div>
  );
}

function ExperimentForm({ initial, onSave, nav, architectures, perfs, incidents }) {
  const empty = { title:"", status:"in_progress", started_at:new Date().toISOString().slice(0,10), ended_at:"", problem:"", hypothesis:"", test_purpose:"", test_metrics:"", test_initial_config:"", test_config_rationale:"", test_scenarios:"", test_target:"", test_success_criteria:"", baseline:"", findings:"", interpretation:"", root_cause:"", conclusion:"", next_action:"", architecture_ids:[], perf_ids:[], incident_ids:[] };
  const [form, setForm] = useState(initial||empty);
  const [tab, setTab] = useState("overview");
  const f = k=>v=>setForm(p=>({...p,[k]:v}));
  const toggleId = (key,id) => setForm(p=>({...p,[key]:p[key].includes(id)?p[key].filter(x=>x!==id):[...p[key],id]}));
  const save = () => { if(!form.title) return alert("title은 필수입니다."); onSave({...form,_savedId: form.id}); nav("experiments"); };
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}><Btn variant="ghost" small onClick={()=>nav("experiments")}>← 취소</Btn><h2 style={{ color:C.light, fontSize:18, margin:0 }}>{form.id?"편집":"New Experiment"}</h2></div>
      <Card>
        <Input label="Title" value={form.title} onChange={f("title")} />
        <Input label="Status" value={form.status} onChange={f("status")} options={["in_progress","resolved","failed"]} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Started At" value={form.started_at} onChange={f("started_at")} type="date" />
          <Input label="Ended At"   value={form.ended_at}   onChange={f("ended_at")}   type="date" />
        </div>
        <Tabs tabs={[{id:"overview",label:"Overview"},{id:"test-design",label:"Test Design"},{id:"results",label:"Results"},{id:"links",label:"연결"}]} active={tab} onChange={setTab} />
        {tab==="overview" && <><Input label="🚨 Problem" value={form.problem} onChange={f("problem")} type="textarea" /><Input label="💡 Hypothesis" value={form.hypothesis} onChange={f("hypothesis")} type="textarea" /><Input label="✅ Conclusion" value={form.conclusion} onChange={f("conclusion")} type="textarea" /><Input label="➡️ Next Action" value={form.next_action} onChange={f("next_action")} type="textarea" /></>}
        {tab==="test-design" && <><Input label="테스트 목적" value={form.test_purpose} onChange={f("test_purpose")} type="textarea" /><Input label="관찰 지표" value={form.test_metrics} onChange={f("test_metrics")} type="textarea" /><Input label="초기 설정값" value={form.test_initial_config} onChange={f("test_initial_config")} type="textarea" /><Input label="초기값 설정 근거" value={form.test_config_rationale} onChange={f("test_config_rationale")} type="textarea" /><Input label="테스트 시나리오" value={form.test_scenarios} onChange={f("test_scenarios")} type="textarea" /><Input label="테스트 대상" value={form.test_target} onChange={f("test_target")} type="textarea" /><Input label="성공 / 실패 기준" value={form.test_success_criteria} onChange={f("test_success_criteria")} type="textarea" /></>}
        {tab==="results" && <><Input label="Baseline" value={form.baseline} onChange={f("baseline")} type="textarea" /><Input label="주요 발견사항" value={form.findings} onChange={f("findings")} type="textarea" /><Input label="해석" value={form.interpretation} onChange={f("interpretation")} type="textarea" /><Input label="Root Cause" value={form.root_cause} onChange={f("root_cause")} type="textarea" /></>}
        {tab==="links" && <>
          {[
            { key:"architecture_ids", label:"Architecture", items:architectures, display:a=>`${a.version} — ${a.title}` },
            { key:"perf_ids",         label:"Performance",  items:perfs,         display:p=>p.title },
            { key:"incident_ids",     label:"Incident",     items:incidents,     display:i=>i.title },
          ].map(({key,label,items,display})=>(
            <div key={key} style={{ marginBottom:16 }}>
              <div style={{ color:C.muted, fontSize:12, marginBottom:8 }}>{label}</div>
              {items.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>등록된 항목 없음</div>
                : items.map(item=><label key={item.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, cursor:"pointer" }}><input type="checkbox" checked={form[key].includes(item.id)} onChange={()=>toggleId(key,item.id)} /><span style={{ color:C.soft, fontSize:13 }}>{display(item)}</span></label>)}
            </div>
          ))}
        </>}
        <div style={{ marginTop:8 }}><Btn onClick={save}>저장</Btn></div>
      </Card>
    </div>
  );
}

// ── Architecture ───────────────────────────────────────
function ArchList({ architectures, nav, setEditItem }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:C.light, fontSize:18, margin:0 }}>Architecture History</h2>
        <Btn onClick={()=>{ setEditItem(null); nav("arch-form"); }}>+ New Version</Btn>
      </div>
      {[...architectures].sort((a,b)=>b.date.localeCompare(a.date)).map((a,i)=>(
        <div key={a.id} style={{ paddingLeft:16, position:"relative", marginBottom:4 }}>
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:2, background:C.border }} />
          <div style={{ position:"absolute", left:-4, top:20, width:10, height:10, borderRadius:"50%", background:i===0?C.light:C.surface, border:`2px solid ${i===0?C.light:C.border}` }} />
          <Card style={{ marginBottom:12 }} onClick={()=>nav("arch-detail",a.id)}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
              <span style={{ color:C.light, fontWeight:700 }}>{a.version}</span>
              {badge(a.change_type, CHANGE_COLOR[a.change_type])}
              <span style={{ color:C.muted, fontSize:12 }}>{a.date}</span>
            </div>
            <div style={{ color:C.soft, fontSize:14 }}>{a.title}</div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function ArchDetail({ item, experiments, perfs, incidents, nav, setEditItem, onDelete }) {
  if (!item) return null;
  const [tab, setTab] = useState("why");
  const relExp   = experiments.filter(e=>e.architecture_ids.includes(item.id));
  const uniqPerf = perfs.filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i&&relExp.some(e=>e.perf_ids.includes(p.id)));
  const uniqInc  = incidents.filter((i,j,a)=>a.findIndex(x=>x.id===i.id)===j&&relExp.some(e=>e.incident_ids.includes(i.id)));
  const related  = [
    ...relExp.map(e=>({ type:"Experiment",   title:e.title, page:"exp-detail",  id:e.id })),
    ...uniqPerf.map(p=>({ type:"Performance", title:p.title, page:"perf-detail", id:p.id })),
    ...uniqInc.map(i=>({ type:"Incident",     title:i.title, page:"inc-detail",  id:i.id })),
  ];
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <Btn variant="ghost" small onClick={()=>nav("architecture")}>← 목록</Btn>
        <Btn variant="ghost" small onClick={()=>{ setEditItem(item); nav("arch-form"); }}>편집</Btn>
        <Btn variant="danger" small onClick={()=>{ onDelete(item.id); nav("architecture"); }}>삭제</Btn>
      </div>
      <RelatedBar items={related} nav={nav} />
      <Card>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
          <span style={{ color:C.light, fontSize:20, fontWeight:700 }}>{item.version}</span>
          {badge(item.change_type, CHANGE_COLOR[item.change_type])}
          <span style={{ color:C.muted, fontSize:13 }}>{item.date}</span>
        </div>
        <h3 style={{ color:C.light, marginBottom:20 }}>{item.title}</h3>
        <Tabs tabs={[{id:"why",label:"WHY — 배경 & 결정"},{id:"what",label:"WHAT — 구조 변경"},{id:"result",label:"RESULT"}]} active={tab} onChange={setTab} />
        {tab==="why"    && <><Block label="배경 / 문제 상황">{item.background}</Block><Block label="검토한 대안">{item.alternatives}</Block><Block label="기술 선택 근거">{item.tech_rationale}</Block></>}
        {tab==="what"   && <><Block label="Before">{item.before}</Block><Block label="After">{item.after}</Block><Block label="변경된 컴포넌트 / 설정">{item.components}</Block><div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{(item.tags||[]).map(t=><span key={t} style={{ color:C.muted, fontSize:12, background:C.bg, padding:"2px 8px", borderRadius:3 }}>#{t}</span>)}</div></>}
        {tab==="result" && <><Block label="기대 효과">{item.expected}</Block><Block label="실제 결과">{item.actual}</Block></>}
      </Card>
    </div>
  );
}

function ArchForm({ initial, onSave, nav }) {
  const [form, setForm] = useState(initial||{ version:"", title:"", date:new Date().toISOString().slice(0,10), change_type:"major", background:"", alternatives:"", tech_rationale:"", before:"", after:"", components:"", expected:"", actual:"", tags:"" });
  const [tab, setTab] = useState("why");
  const f = k=>v=>setForm(p=>({...p,[k]:v}));
  const save = () => { if(!form.version||!form.title) return alert("version, title은 필수입니다."); onSave({...form,_savedId: form.id,tags:typeof form.tags==="string"?form.tags.split(",").map(t=>t.trim()).filter(Boolean):form.tags}); nav("architecture"); };
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}><Btn variant="ghost" small onClick={()=>nav("architecture")}>← 취소</Btn><h2 style={{ color:C.light, fontSize:18, margin:0 }}>{form.id?"편집":"New Architecture Version"}</h2></div>
      <Card>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Version" value={form.version} onChange={f("version")} />
          <Input label="Date" value={form.date} onChange={f("date")} type="date" />
        </div>
        <Input label="Title" value={form.title} onChange={f("title")} />
        <Input label="Change Type" value={form.change_type} onChange={f("change_type")} options={["major","minor","patch"]} />
        <Tabs tabs={[{id:"why",label:"WHY"},{id:"what",label:"WHAT"},{id:"result",label:"RESULT"}]} active={tab} onChange={setTab} />
        {tab==="why"    && <><Input label="배경 / 문제 상황" value={form.background} onChange={f("background")} type="textarea" /><Input label="검토한 대안" value={form.alternatives} onChange={f("alternatives")} type="textarea" hint="(선택/미선택 이유)" /><Input label="기술 선택 근거" value={form.tech_rationale} onChange={f("tech_rationale")} type="textarea" /></>}
        {tab==="what"   && <><Input label="Before" value={form.before} onChange={f("before")} type="textarea" /><Input label="After" value={form.after} onChange={f("after")} type="textarea" /><Input label="변경된 컴포넌트 / 설정" value={form.components} onChange={f("components")} type="textarea" /><Input label="Tags (쉼표 구분)" value={typeof form.tags==="string"?form.tags:(form.tags||[]).join(", ")} onChange={f("tags")} /></>}
        {tab==="result" && <><Input label="기대 효과" value={form.expected} onChange={f("expected")} type="textarea" /><Input label="실제 결과" value={form.actual} onChange={f("actual")} type="textarea" hint="(테스트 후 채워도 됩니다)" /></>}
        <div style={{ marginTop:8 }}><Btn onClick={save}>저장</Btn></div>
      </Card>
    </div>
  );
}

// ── Performance ────────────────────────────────────────
function PerfList({ perfs, nav, setEditItem }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:C.light, fontSize:18, margin:0 }}>Performance</h2>
        <Btn onClick={()=>{ setEditItem(null); nav("perf-form"); }}>+ New</Btn>
      </div>
      {perfs.map(p=>(
        <Card key={p.id} style={{ marginBottom:12 }} onClick={()=>nav("perf-detail",p.id)}>
          <div style={{ color:C.light, fontSize:14, fontWeight:500, marginBottom:6 }}>{p.title}</div>
          <div style={{ color:C.muted, fontSize:12, marginBottom:8 }}>{p.date} · {p.tools} · {p.environment}</div>
          <div style={{ color:C.soft, fontSize:13 }}>{p.summary}</div>
        </Card>
      ))}
    </div>
  );
}

function PerfDetail({ item, experiments, architectures, incidents, nav, setEditItem, onDelete }) {
  if (!item) return null;
  const relExp   = experiments.filter(e=>e.perf_ids.includes(item.id));
  const uniqArch = architectures.filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i&&relExp.some(e=>e.architecture_ids.includes(a.id)));
  const uniqInc  = incidents.filter((i,j,arr)=>arr.findIndex(x=>x.id===i.id)===j&&relExp.some(e=>e.incident_ids.includes(i.id)));
  const related  = [
    ...relExp.map(e=>({ type:"Experiment",    title:e.title, page:"exp-detail",  id:e.id })),
    ...uniqArch.map(a=>({ type:"Architecture", title:`${a.version} ${a.title}`, page:"arch-detail", id:a.id })),
    ...uniqInc.map(i=>({ type:"Incident",      title:i.title, page:"inc-detail",  id:i.id })),
  ];
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <Btn variant="ghost" small onClick={()=>nav("performance")}>← 목록</Btn>
        <Btn variant="ghost" small onClick={()=>{ setEditItem(item); nav("perf-form"); }}>편집</Btn>
        <Btn variant="danger" small onClick={()=>{ onDelete(item.id); nav("performance"); }}>삭제</Btn>
      </div>
      <RelatedBar items={related} nav={nav} />
      <Card>
        <h3 style={{ color:C.light, margin:"0 0 6px" }}>{item.title}</h3>
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          {[["Date",item.date],["Tools",item.tools],["Env",item.environment]].map(([k,v])=>(
            <Inset key={k} style={{ padding:"8px 14px" }}>
              <div style={{ color:C.muted, fontSize:11, marginBottom:2 }}>{k}</div>
              <div style={{ color:C.light, fontSize:13 }}>{v}</div>
            </Inset>
          ))}
        </div>
        <Block label="요약">{item.summary}</Block>
        <Block label="지표 스냅샷">{item.metrics_snapshot}</Block>
        <Block label="분석 메모">{item.notes}</Block>
      </Card>
    </div>
  );
}

function PerfForm({ initial, onSave, nav }) {
  const [form, setForm] = useState(initial||{ title:"", date:new Date().toISOString().slice(0,10), tools:"", environment:"staging", summary:"", metrics_snapshot:"", notes:"" });
  const f = k=>v=>setForm(p=>({...p,[k]:v}));
  const save = () => { if(!form.title) return alert("title은 필수입니다."); onSave({...form,_savedId: form.id}); nav("performance"); };
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}><Btn variant="ghost" small onClick={()=>nav("performance")}>← 취소</Btn><h2 style={{ color:C.light, fontSize:18, margin:0 }}>{form.id?"편집":"New Performance Record"}</h2></div>
      <Card>
        <Input label="Title" value={form.title} onChange={f("title")} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          <Input label="Date"  value={form.date}        onChange={f("date")}        type="date" />
          <Input label="Tools" value={form.tools}       onChange={f("tools")} />
          <Input label="Env"   value={form.environment} onChange={f("environment")} options={["dev","staging","prod"]} />
        </div>
        <Input label="요약"        value={form.summary}          onChange={f("summary")}          type="textarea" hint="(한두 줄 핵심 요약)" />
        <Input label="지표 스냅샷" value={form.metrics_snapshot} onChange={f("metrics_snapshot")} type="textarea" hint="(수치, before/after 비교 등)" />
        <Input label="분석 메모"   value={form.notes}            onChange={f("notes")}            type="textarea" hint="(그래프 패턴, 이상 징후 등)" />
        <Btn onClick={save}>저장</Btn>
      </Card>
    </div>
  );
}

// ── Incidents ──────────────────────────────────────────
function IncidentList({ incidents, nav, setEditItem }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:C.light, fontSize:18, margin:0 }}>Incidents</h2>
        <Btn onClick={()=>{ setEditItem(null); nav("inc-form"); }}>+ New Incident</Btn>
      </div>
      {incidents.map(i=>(
        <Card key={i.id} style={{ marginBottom:12 }} onClick={()=>nav("inc-detail",i.id)}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
            {badge(i.severity, SEV_COLOR[i.severity])}
            {badge(i.status, i.status==="resolved"?"#DFF8EB":"#E07B7B")}
            <span style={{ color:C.light, fontSize:14 }}>{i.title}</span>
          </div>
          <div style={{ color:C.muted, fontSize:12 }}>{i.detected_at} · {i.affected}</div>
        </Card>
      ))}
    </div>
  );
}

function IncidentDetail({ item, experiments, architectures, perfs, nav, setEditItem, onDelete }) {
  if (!item) return null;
  const relExp   = experiments.filter(e=>e.incident_ids.includes(item.id));
  const uniqArch = architectures.filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i&&relExp.some(e=>e.architecture_ids.includes(a.id)));
  const uniqPerf = perfs.filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i&&relExp.some(e=>e.perf_ids.includes(p.id)));
  const related  = [
    ...relExp.map(e=>({ type:"Experiment",    title:e.title, page:"exp-detail",  id:e.id })),
    ...uniqArch.map(a=>({ type:"Architecture", title:`${a.version} ${a.title}`, page:"arch-detail", id:a.id })),
    ...uniqPerf.map(p=>({ type:"Performance",  title:p.title, page:"perf-detail", id:p.id })),
  ];
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <Btn variant="ghost" small onClick={()=>nav("incidents")}>← 목록</Btn>
        <Btn variant="ghost" small onClick={()=>{ setEditItem(item); nav("inc-form"); }}>편집</Btn>
        <Btn variant="danger" small onClick={()=>{ onDelete(item.id); nav("incidents"); }}>삭제</Btn>
      </div>
      <RelatedBar items={related} nav={nav} />
      <Card>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16 }}>
          {badge(item.severity, SEV_COLOR[item.severity])}
          {badge(item.status, item.status==="resolved"?"#DFF8EB":"#E07B7B")}
          <h3 style={{ color:C.light, margin:0 }}>{item.title}</h3>
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          {[["감지",item.detected_at],["해결",item.resolved_at||"진행 중"],["영향",item.affected]].map(([k,v])=>(
            <Inset key={k} style={{ padding:"8px 14px" }}>
              <div style={{ color:C.muted, fontSize:11, marginBottom:2 }}>{k}</div>
              <div style={{ color:C.light, fontSize:13 }}>{v}</div>
            </Inset>
          ))}
        </div>
        <Block label="어떻게 발견했는가">{item.how_detected}</Block>
        <Block label="Root Cause">{item.root_cause}</Block>
        <Block label="해결 방법">{item.resolution}</Block>
      </Card>
    </div>
  );
}

function IncidentForm({ initial, onSave, nav }) {
  const [form, setForm] = useState(initial||{ title:"", severity:"high", status:"open", detected_at:new Date().toISOString().slice(0,16), resolved_at:"", affected:"", how_detected:"", root_cause:"", resolution:"" });
  const f = k=>v=>setForm(p=>({...p,[k]:v}));
  const save = () => { if(!form.title) return alert("title은 필수입니다."); onSave({...form,_savedId: form.id}); nav("incidents"); };
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}><Btn variant="ghost" small onClick={()=>nav("incidents")}>← 취소</Btn><h2 style={{ color:C.light, fontSize:18, margin:0 }}>{form.id?"편집":"New Incident"}</h2></div>
      <Card>
        <Input label="Title" value={form.title} onChange={f("title")} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Severity" value={form.severity} onChange={f("severity")} options={["critical","high","medium","low"]} />
          <Input label="Status"   value={form.status}   onChange={f("status")}   options={["open","investigating","resolved"]} />
          <Input label="감지 시각" value={form.detected_at} onChange={f("detected_at")} type="datetime-local" />
          <Input label="해결 시각" value={form.resolved_at} onChange={f("resolved_at")} type="datetime-local" />
        </div>
        <Input label="영향 범위"         value={form.affected}     onChange={f("affected")} />
        <Input label="어떻게 발견했는가" value={form.how_detected} onChange={f("how_detected")} type="textarea" />
        <Input label="Root Cause"        value={form.root_cause}   onChange={f("root_cause")}   type="textarea" />
        <Input label="해결 방법"         value={form.resolution}   onChange={f("resolution")}   type="textarea" />
        <Btn onClick={save}>저장</Btn>
      </Card>
    </div>
  );
}

// ── App ────────────────────────────────────────────────
export default function App() {
  const [page, setPage]         = useState("dashboard");
  const [detailId, setDetailId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [experiments,   setExperiments]   = useState([]);
  const [architectures, setArchitectures] = useState([]);
  const [perfs,         setPerfs]         = useState([]);
  const [incidents,     setIncidents]     = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/experiments').then(r=>r.json()),
      fetch('/api/architectures').then(r=>r.json()),
      fetch('/api/performances').then(r=>r.json()),
      fetch('/api/incidents').then(r=>r.json()),
    ]).then(([exps, archs, perfs, incs]) => {
      setExperiments(exps);
      setArchitectures(archs);
      setPerfs(perfs);
      setIncidents(incs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ color:C.light, padding:40 }}>Loading...</div>;

  const nav    = (p,id=null) => { setPage(p); setDetailId(id); };
  const apiUpsert = (endpoint, setter) => async (item) => {
    const isNew = !item._savedId;
    const url = isNew ? `/api/${endpoint}` : `/api/${endpoint}/${item._savedId}`;
    const method = isNew ? 'POST' : 'PUT';
    const { _savedId, ...body } = item;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const saved = await res.json();
    setter(prev => prev.some(x=>x.id===saved.id) ? prev.map(x=>x.id===saved.id?saved:x) : [...prev, saved]);
  };

  const apiDel = (endpoint, setter) => async (id) => {
    await fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' });
    setter(prev => prev.filter(x=>x.id!==id));
  };
  const find   = (list,id) => list.find(x=>x.id===id);
  const main   = page.split("-")[0];
  const isExp  = ["exp","experiments"].includes(main);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.soft, fontFamily:"system-ui, sans-serif" }}>
      <nav style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"center", gap:4, height:48 }}>
        <span style={{ color:C.light, fontWeight:700, fontSize:14, marginRight:16, letterSpacing:1 }}>SOD</span>
        {NAV.map(n=>{ const a=main===n.id||(n.id==="experiments"&&isExp); return (
          <button key={n.id} onClick={()=>nav(n.id)} style={{ background:"none", border:"none", color:a?C.light:C.muted, padding:"0 12px", height:48, cursor:"pointer", fontSize:13, fontWeight:a?600:400, borderBottom:a?`2px solid ${C.light}`:"2px solid transparent" }}>{n.label}</button>
        );})}
      </nav>
      <main style={{ maxWidth:900, margin:"0 auto", padding:24 }}>
        {page==="dashboard"    && <Dashboard experiments={experiments} architectures={architectures} perfs={perfs} incidents={incidents} nav={nav} />}
        {page==="experiments"  && <ExperimentList experiments={experiments} nav={nav} setEditItem={setEditItem} />}
        {page==="exp-detail"   && <ExperimentDetail exp={find(experiments,detailId)} architectures={architectures} perfs={perfs} incidents={incidents} nav={nav} setEditItem={setEditItem} onDelete={apiDel('experiments', setExperiments)} />}
        {page==="exp-form"     && <ExperimentForm initial={editItem} onSave={apiUpsert('experiments', setExperiments)} nav={nav} architectures={architectures} perfs={perfs} incidents={incidents} />}
        {page==="architecture" && <ArchList architectures={architectures} nav={nav} setEditItem={setEditItem} />}
        {page==="arch-detail"  && <ArchDetail item={find(architectures,detailId)} experiments={experiments} perfs={perfs} incidents={incidents} nav={nav} setEditItem={setEditItem} onDelete={apiDel('architectures', setArchitectures)} />}
        {page==="arch-form"    && <ArchForm initial={editItem} onSave={apiUpsert('architectures', setArchitectures)} nav={nav} />}
        {page==="performance"  && <PerfList perfs={perfs} nav={nav} setEditItem={setEditItem} />}
        {page==="perf-detail"  && <PerfDetail item={find(perfs,detailId)} experiments={experiments} architectures={architectures} incidents={incidents} nav={nav} setEditItem={setEditItem} onDelete={apiDel('performances', setPerfs)} />}
        {page==="perf-form"    && <PerfForm initial={editItem} onSave={apiUpsert('performances', setPerfs)} nav={nav} />}
        {page==="incidents"    && <IncidentList incidents={incidents} nav={nav} setEditItem={setEditItem} />}
        {page==="inc-detail"   && <IncidentDetail item={find(incidents,detailId)} experiments={experiments} architectures={architectures} perfs={perfs} nav={nav} setEditItem={setEditItem} onDelete={apiDel('incidents', setIncidents)} />}
        {page==="inc-form"     && <IncidentForm initial={editItem} onSave={apiUpsert('incidents', setIncidents)} nav={nav} />}
      </main>
    </div>
  );
}