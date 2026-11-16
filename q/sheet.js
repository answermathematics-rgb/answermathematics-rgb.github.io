// 앤서수학 오답 정리지 조판 (관리자 화면 미리보기 + 학원 PC 프린트 화면 공용)
// 문제는 AI가 옮겨 적은 글자·수식(typed)으로 조판하고, 그림만 원본 사진에서 잘라 넣음.
// 인식이 안 됐거나 확신이 낮은 문제는 사진으로 대신 넣음.
(function () {
  const CSS = `
  .sheet-root, .sheet-root * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sheet-root { font-family: "Pretendard","Noto Sans KR","Malgun Gothic",sans-serif; color:#111; }
  .sheet-student { break-before: page; page-break-before: always; }
  .sheet-student:first-child { break-before: auto; page-break-before: auto; }
  .sh-head { display:flex; align-items:center; gap:3mm; border-bottom:1.5px solid #1E2A44; padding-bottom:3mm; margin-bottom:5mm; }
  .sh-head .lg { height:11mm; }
  .sh-head .bar { width:1.2mm; height:9mm; background:#B62A1D; }
  .sh-head .ttl { font-size:20pt; font-weight:900; color:#1E2A44; letter-spacing:-.3px; }
  .sh-head .info { margin-left:auto; font-size:11pt; color:#1E2A44; }
  .sh-head .info b { font-size:14pt; }
  .sh-q { break-inside: avoid; page-break-inside: avoid; min-height:118mm; padding-bottom:4mm; position:relative; }
  .sh-q + .sh-q { border-top:1px dashed #bbb; padding-top:5mm; }
  .sh-q .qn { font-weight:800; font-size:13pt; color:#000; margin-bottom:2.5mm; }
  .sh-q .qn small { font-weight:400; font-size:8.5pt; color:#999; margin-left:2mm; }
  .sh-q .body { font-size:11pt; line-height:1.85; word-break:keep-all; }
  .sh-q .body .katex { font-size:1.05em; }
  .sh-q .box { border:1px solid #333; border-radius:2mm; padding:2.5mm 3.5mm; margin:2mm 0; }
  .sh-q .fig { margin:3mm 0 1mm; text-align:center; }
  .sh-q .fig img { max-width:70%; max-height:60mm; object-fit:contain; }
  .sh-q .photo img { max-width:100%; max-height:95mm; object-fit:contain; }
  .sh-q .choices { display:grid; gap:1.5mm 4mm; margin-top:3mm; font-size:11pt; }
  .sh-q .choices.c5 { grid-template-columns:repeat(5,1fr); }
  .sh-q .choices.c3 { grid-template-columns:repeat(3,1fr); }
  .sh-q .choices.c2 { grid-template-columns:repeat(2,1fr); }
  .sh-q .choices.c1 { grid-template-columns:1fr; }
  .sh-foot { position:fixed; right:0; bottom:0; }
  .sh-foot img { height:7mm; }
  @media screen { .sheet-root .sh-foot { position:static; text-align:right; margin-top:4mm; } }
  `;
  const CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // AI가 줄바꿈을 글자 그대로 "\n"으로 준 경우도 줄바꿈으로 (단 \neq 같은 수식 명령은 그대로)
  const fixNl = (s) => String(s || "").replace(/\\n(?![a-zA-Z])/g, "\n");
  function bodyHtml(text) {
    let h = esc(fixNl(text));
    h = h.replace(/\[\[box\]\]\s*/g, '<div class="box">').replace(/\s*\[\[\/box\]?\]?/g, "</div>");
    h = h.replace(/\n*(\$\$[\s\S]*?\$\$)\n*/g, "$1");
    h = h.replace(/\n/g, "<br>");
    return h;
  }
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function cropFigure(url, bbox) {
    const im = await loadImg(url); if (!im) return null;
    const p = 0.02;
    const x0 = Math.max(0, bbox[0] - p), y0 = Math.max(0, bbox[1] - p), x1 = Math.min(1, bbox[2] + p), y1 = Math.min(1, bbox[3] + p);
    const sw = (x1 - x0) * im.width, sh = (y1 - y0) * im.height;
    if (sw < 20 || sh < 20) return null;
    const c = document.createElement("canvas"); c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext("2d").drawImage(im, x0 * im.width, y0 * im.height, sw, sh, 0, 0, c.width, c.height);
    try { return c.toDataURL("image/jpeg", 0.92); } catch (_) { return null; }
  }
  function usePhoto(q) {
    const t = q.typed;
    return !t || q.ocr_status !== "done" || t.use_photo || !String(t.body || "").trim() || (t.confidence === "low" && !t.edited);
  }
  function choicesHtml(ch) {
    if (!ch || !ch.length) return "";
    const plainLen = Math.max(...ch.map((c) => String(c).replace(/\$|\\[a-z]+|[{}]/g, "").length));
    const cls = plainLen <= 9 ? "c5" : plainLen <= 18 ? "c3" : plainLen <= 32 ? "c2" : "c1";
    return `<div class="choices ${cls}">${ch.map((c, i) => `<div>${CIRC[i] || i + 1} ${bodyHtml(c)}</div>`).join("")}</div>`;
  }
  function groupByStudent(items) {
    const m = new Map();
    items.forEach((q) => { if (!m.has(q.student_id)) m.set(q.student_id, { name: q.students?.name || "", qs: [] }); m.get(q.student_id).qs.push(q); });
    return [...m.values()];
  }
  // container 안에 오답 정리지를 그림. 그림·폰트·수식이 다 준비되면 resolve
  async function build(container, items, opts = {}) {
    if (!document.getElementById("sheet-css")) { const st = document.createElement("style"); st.id = "sheet-css"; st.textContent = CSS; document.head.appendChild(st); }
    const d = new Date();
    const ds = opts.label || `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const base = opts.base || "";
    // 그림 잘라두기
    const figs = {};
    await Promise.all(items.map(async (q) => {
      if (!usePhoto(q) && q.typed?.figure?.present && q.typed.figure.bbox) figs[q.id] = await cropFigure(q.orig_url || q.url, q.typed.figure.bbox);
    }));
    let h = '<div class="sheet-root">';
    groupByStudent(items).forEach((g) => {
      h += `<div class="sheet-student"><div class="sh-head"><img class="lg" src="${base}logo.png"><div class="bar"></div><div class="ttl">오답 정리</div>
        <div class="info"><b>${esc(g.name)}</b> · ${esc(ds)} · ${g.qs.length}문제</div></div>`;
      g.qs.forEach((q, i) => {
        const t = q.typed || {};
        const src = t.number ? `<small>원래 ${esc(t.number)}번</small>` : "";
        h += `<div class="sh-q"><div class="qn">${i + 1}${src}</div>`;
        if (usePhoto(q)) h += `<div class="photo"><img src="${esc(q.url)}" crossorigin="anonymous"></div>`;
        else {
          h += `<div class="body">${bodyHtml(t.body)}</div>`;
          if (figs[q.id]) h += `<div class="fig"><img src="${figs[q.id]}"></div>`;
          h += choicesHtml(t.choices);
        }
        h += "</div>";
      });
      h += "</div>";
    });
    h += `<div class="sh-foot"><img src="${base}logo-ko.png"></div></div>`;
    container.innerHTML = h;
    if (window.renderMathInElement) {
      window.renderMathInElement(container, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false, strict: "ignore" });
    }
    await Promise.all([...container.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
    return { students: groupByStudent(items).length, problems: items.length };
  }
  window.AnswerSheet = { build, usePhoto, groupByStudent };
})();
