// ─── 기본 블록 ───────────────────────────────────────────────

export function text(content) {
  // content: 문자열 또는 문자열 배열
  const items = Array.isArray(content) ? content : [content];
  return items.map((t, i) =>
    `<p class="body-text"${i > 0 ? ' style="margin-top:12px;"' : ''}>${t}</p>`
  ).join('\n');
}

export function image(placeholder = '이미지 자리') {
  return `<div class="placeholder">${placeholder}</div>`;
}

export function imageUrl(src, alt = '') {
  return `<div class="placeholder"><img src="${src}" alt="${alt}" style="width:100%;display:block;border-radius:4px;"></div>`;
}

export function badge(label, content) {
  // content: 문자열 또는 블록 HTML
  return `
<div class="sub-section" style="margin-top:16px;">
  <div class="badge">${label}</div>
  <div class="badge-content">${content}</div>
</div>`;
}

export function subLabel(label, content) {
  return `
<div class="sub-section">
  <div class="sub-label">${label}</div>
  ${content}
</div>`;
}

export function note(content) {
  return `<div class="note">${content}</div>`;
}

// ─── 표 ────────────────────────────────────────────────────

export function table({ head, rows }) {
  const headHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const rowsHTML = rows.map(row => {
    const highlight = row.highlight ? ' class="highlight"' : '';
    const cells = row.cells.map((c, i) => {
      const cls = row.numVal && i > 0 ? ' class="num-val"' : '';
      return `<td${cls}>${c}</td>`;
    }).join('');
    return `<tr${highlight}>${cells}</tr>`;
  }).join('\n');
  return `<table><thead>${headHTML}</thead><tbody>${rowsHTML}</tbody></table>`;
}

// ─── 임계/한계 박스 ───────────────────────────────────────────

export function criteriaGrid({ left, right }) {
  const box = ({ title, items, warn }) => `
<div class="criteria-box${warn ? ' warn' : ''}">
  <div class="c-title">${title}</div>
  <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
</div>`;
  return `<div class="criteria-grid" style="margin-top:18px;">${box(left)}${box({ ...right, warn: true })}</div>`;
}

// ─── 섹션 ────────────────────────────────────────────────────

export function section(num, title, content) {
  const pad = String(num).padStart(2, '0');
  return `
<section>
  <div class="sec-head">
    <div class="num">${pad}</div>
    <div class="sec-title">${title}</div>
  </div>
  ${content}
</section>`;
}

// ─── 툴팁 ────────────────────────────────────────────────────

export function tooltip(content) {
  return `<span class="tooltip-wrap"><span class="tooltip-icon">?</span><span class="tooltip-box">${content}</span></span>`;
}
