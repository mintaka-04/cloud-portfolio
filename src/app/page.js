'use client';
import { useState, useEffect } from "react";

// const C = {
//   bg:          "#222831", // 전체 배경, 가장 어두운 톤
//   surface:     "#31363F", // 카드/섹션 배경
//   surfaceDeep: "#1A1F24", // 추가: 더 깊은 다크톤, 헤더/푸터용
//   border:      "#4A525A", // 추가: 중간 톤 그레이, 구분선
//   muted:       "#76ABAE", // 보조 텍스트/아이콘, 청록 포인트
//   soft:        "#5F8F92", // 추가: 버튼 hover, 강조 배경
//   light:       "#EEEEEE", // 본문 텍스트, 대비용 밝은 색
// };

const C = {
  bg:          "#222831",
  surface:     "#393E46",
  surfaceDeep: "#181C20",
  border:      "#5A5F66",
  muted:       "#948979",
  soft:        "#B0A58F",
  light:       "#DFD0B8",
};

const VALIDATION = {
  success: { label: "PASS",    color: "#4CAF82" },
  partial: { label: "PARTIAL", color: "#E6A817" },
  fail:    { label: "FAIL",    color: "#E05C5C" },
};
const STATUS = {
  draft:     { label: "Draft",     color: "#5A5F66" },
  running:   { label: "Running",   color: "#E6A817" },
  completed: { label: "Completed", color: "#4CAF82" },
};
const vMeta = v => VALIDATION[v] || { label: "—", color: "#5A5F66" };
const sMeta = s => STATUS[s]     || STATUS["draft"];

const Badge = ({ label, color, small }) => (
  <span style={{
    background: color+"22", color, border: `1px solid ${color}66`,
    borderRadius: 4, padding: small ? "1px 6px" : "2px 10px",
    fontSize: small ? 10 : 12, fontWeight: 700, whiteSpace: "nowrap",
    textTransform: "uppercase", letterSpacing: 0.5,
  }}>{label}</span>
);

const Tag = ({ label }) => (
  <span style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}88`, borderRadius: 3, padding: "2px 7px", fontSize: 11 }}>#{label}</span>
);

const Divider = () => <div style={{ height: 1, background: C.border+"44", margin: "16px 0" }} />;

const SLabel = ({ children }) => (
  <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontWeight: 600 }}>{children}</div>
);

const Section = ({ label, children }) => (
  <div>
    <Divider />
    <SLabel>{label}</SLabel>
    <div style={{ color: C.light, fontSize: 14, lineHeight: 1.7 }}>{children}</div>
  </div>
);

// ── Nav ───────────────────────────────────────────────
const NAV = [
  { id: "dashboard",   label: "Dashboard" },
  { id: "experiments", label: "Experiments" },
];

// ── Experiment List Card ───────────────────────────────
function ExpCard({ exp, onClick }) {
  const vm = vMeta(exp.validation);
  return (
    <div onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "20px 24px", cursor: "pointer",
      marginBottom: 12, transition: "border-color 0.15s, transform 0.1s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.soft; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}>

      {/* Status Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {exp.arch_version && (
          <span style={{ background: C.soft+"22", color: C.soft, border: `1px solid ${C.soft}55`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
            {exp.arch_version}
          </span>
        )}
        <Badge label={vm.label} color={vm.color} small />
      </div>

      {/* Title */}
      <div style={{ color: C.light, fontSize: 15, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{exp.title}</div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(exp.tags || []).map(t => <Tag key={t} label={t} />)}
      </div>
    </div>
  );
}

// ── Experiment Detail ──────────────────────────────────
function ExpDetail({ exp, onBack }) {
  const [expanded, setExpanded] = useState(false);
  const [imgZoom, setImgZoom] = useState(false);
  const vm = vMeta(exp.validation);
  const raw = exp.result_metrics;
  const metrics = raw
    ? Object.entries(typeof raw === "string" ? JSON.parse(raw) : raw)
    : [];

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
        ← 목록
      </button>

      {/* ── Single Card (L0 + L1 인라인 확장) ── */}
      <div onClick={() => setExpanded(p => !p)}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 12, cursor: "pointer", transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.soft}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

        {/* Version */}
        <div style={{ marginBottom: 10 }}>
          {exp.arch_version && (
            <span style={{ background: C.soft+"22", color: C.soft, border: `1px solid ${C.soft}55`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
              {exp.arch_version}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 style={{ color: C.light, fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>{exp.title}</h2>

        {/* ── 확장: 다이어그램 + 가설 (제목 아래) ── */}
        {expanded && <>
          <Divider />
          <div style={{ marginBottom: 16 }}>
            <SLabel>다이어그램</SLabel>
            {exp.diagram_url
              ? <>
                {imgZoom && (
                  <div onClick={() => setImgZoom(false)}
                    style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
                    <img src={exp.diagram_url} alt="diagram" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} />
                  </div>
                )}
                <img src={exp.diagram_url} alt="diagram" onClick={e => { e.stopPropagation(); setImgZoom(true); }}
                  style={{ width: "100%", borderRadius: 6, border: `1px solid ${C.border}`, cursor: "zoom-in" }} />
              </>
              : <div style={{ width: "100%", height: 180, borderRadius: 6, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>다이어그램 준비 중</span>
                </div>
            }
          </div>
          <Section label="가설">{exp.hypothesis}</Section>
          <Divider />
        </>}

        {/* Metrics */}
        {metrics.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {metrics.map(([k, v]) => (
              <div key={k} style={{ background: C.surfaceDeep, borderRadius: 6, padding: "8px 16px" }}>
                <div style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>{k}</div>
                <div style={{ color: k === exp.primary_metric_name ? vm.color : C.light, fontSize: 16, fontWeight: 700 }}>
                  {typeof v === "boolean" ? (v ? "✓" : "✗") : v.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conclusion */}
        <Section label="결론">
          {exp.conclusion} <Badge label={vm.label} color={vm.color} small />
        </Section>

        {/* ── 확장: 발견 문제 + 개선 방향 (결론 아래) ── */}
        {expanded && <>
          <Section label="발견 문제">{exp.problem_found}</Section>
          <Section label="개선 방향">{exp.improvement}</Section>
        </>}

        {!expanded && (
          <div style={{ marginTop: 16, color: C.muted, fontSize: 20, textAlign: "center" }}>▼</div>
        )}
        {expanded && (
          <div style={{ marginTop: 8, color: C.muted, fontSize: 20, textAlign: "center" }}>▲</div>
        )}
      </div>

      {/* ── Level 2 (GitHub) ── */}
      <a href={exp.github_doc_url} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 24px", textDecoration: "none", transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.soft}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
        <div>
          <div style={{ color: C.soft, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>상세 분석 보기</div>
          <div style={{ color: C.muted, fontSize: 12 }}>테스트 디자인 · 결과 분석 · 원인 분석 · 의사결정</div>
        </div>
        <span style={{ color: C.muted, fontSize: 18 }}>→</span>
      </a>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────
function Dashboard({ experiments, onExpClick }) {
  const latest = experiments[0];
  const vm = latest ? vMeta(latest.validation) : null;

  return (
    <div>
      {latest && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>Latest Experiment</div>
          <div style={{ background: C.surface, border: `1px solid ${vm.color}66`, borderRadius: 10, padding: 24, cursor: "pointer" }}
            onClick={() => onExpClick(latest)}
            onMouseEnter={e => e.currentTarget.style.borderColor = vm.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = vm.color+"66"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", marginBottom: 6 }}>{latest.id} · {latest.arch_version}</div>
                <div style={{ color: C.light, fontSize: 17, fontWeight: 700 }}>{latest.title}</div>
              </div>
              <Badge label={vm.label} color={vm.color} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "가설",      value: latest.hypothesis },
                { label: "발견 문제", value: latest.problem_found },
                { label: "개선 방향", value: latest.improvement },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.surfaceDeep, borderRadius: 6, padding: 12 }}>
                  <SLabel>{label}</SLabel>
                  <div style={{ color: C.soft, fontSize: 12, lineHeight: 1.5 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(latest.tags || []).map(t => <Tag key={t} label={t} />)}
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>All Experiments</div>
        {experiments.map(e => (
          <ExpCard key={e.id} exp={e} onClick={() => onExpClick(e)} />
        ))}
      </div>
    </div>
  );
}

// ── Experiments List ──────────────────────────────────
function ExperimentsList({ experiments, onExpClick }) {
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16, fontWeight: 600 }}>
        {experiments.length} Experiments
      </div>
      {experiments.map(e => (
        <ExpCard key={e.id} exp={e} onClick={() => onExpClick(e)} />
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────
export default function App() {
  const [page, setPage]       = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/experiments')
      .then(r => r.json())
      .then(data => { setExperiments(data); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.light, padding: 40 }}>Loading...</div>;

  const goExp = (exp) => { setSelected(exp); setPage("exp-detail"); };
  const main  = page.split("-")[0];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.light, fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ background: C.surfaceDeep, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", gap: 4, height: 52 }}>
        <span style={{ color: C.light, fontWeight: 700, fontSize: 13, marginRight: 20, letterSpacing: 1.5 }}>SOD</span>
        {NAV.map(n => {
          const active = main === n.id || (n.id === "experiments" && page === "exp-detail");
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ background: "none", border: "none", color: active ? C.light : C.muted, padding: "0 14px", height: 52, cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, borderBottom: active ? `2px solid ${C.soft}` : "2px solid transparent" }}>
              {n.label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        {page === "dashboard"   && <Dashboard experiments={experiments} onExpClick={goExp} />}
        {page === "experiments" && <ExperimentsList experiments={experiments} onExpClick={goExp} />}
        {page === "exp-detail"  && selected && <ExpDetail exp={selected} onBack={() => setPage("experiments")} />}
      </main>
    </div>
  );
}