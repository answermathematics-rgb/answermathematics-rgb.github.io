// 앤서수학 오답 정리지 조판 (관리자 화면 미리보기 + 학원 PC 프린트 화면 공용)
// 문제는 AI가 옮겨 적은 글자·수식(typed)으로 조판하고, 그림만 원본 사진에서 잘라 넣음.
// 인식이 안 됐거나 확신이 낮은 문제는 사진으로 대신 넣음.
(function () {
  const CSS = `
  .sheet-root, .sheet-root * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sheet-root { font-family: "Pretendard","Noto Sans KR","Malgun Gothic",sans-serif; color:#111; }
  /* 한 장 = 머리말 + 2×2 네 문제 + 꼬리말 (A4, 여백 10mm 기준 190×277mm) */
  .sh-page { height:268mm; display:flex; flex-direction:column; break-after:page; page-break-after:always; overflow:hidden; }
  .sh-page:last-child { break-after:auto; page-break-after:auto; }
  .sh-grid { flex:1; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; min-height:0; }
  .sh-grid .sh-q:nth-child(odd) { border-right:1px dashed #bbb; padding-right:4mm; }
  .sh-grid .sh-q:nth-child(even) { padding-left:4mm; }
  .sh-grid .sh-q:nth-child(n+3) { border-top:1px dashed #bbb; padding-top:4mm; }
  .sh-pfoot { display:flex; justify-content:flex-end; align-items:center; height:9mm; }
  .sh-pfoot img { height:6.5mm; }
  @media screen { .sh-page { border:1px solid #ddd; margin-bottom:6mm; padding:4mm; height:auto; min-height:268mm; } }
  .sh-head { display:flex; align-items:center; gap:3mm; border-bottom:1.5px solid #1E2A44; padding-bottom:3mm; margin-bottom:5mm; }
  .sh-head .lg { height:11mm; }
  .sh-head .bar { width:1.2mm; height:9mm; background:#B62A1D; }
  .sh-head .ttl { font-size:20pt; font-weight:900; color:#1E2A44; letter-spacing:-.3px; }
  .sh-head .info { margin-left:auto; font-size:11pt; color:#1E2A44; }
  .sh-head .info b { font-size:14pt; }
  .sh-q { position:relative; min-width:0; min-height:0; overflow:hidden; padding-bottom:2mm; }
  .sh-q .qn { font-weight:800; font-size:13pt; color:#000; margin-bottom:2.5mm; }
  .sh-q .qn small { font-weight:400; font-size:8.5pt; color:#999; margin-left:2mm; }
  .sh-q .body { font-size:10.5pt; line-height:1.75; word-break:keep-all; }
  .sh-q .body .katex { font-size:1.05em; }
  .sh-q .box { border:1px solid #333; border-radius:2mm; padding:2.5mm 3.5mm; margin:2mm 0; }
  .sh-q .fig { margin:3mm 0 1mm; text-align:center; }
  .sh-q .fig img { width:58mm; max-width:90%; max-height:46mm; object-fit:contain; }
  .sh-q .photo img { max-width:100%; max-height:80mm; object-fit:contain; }
  .sh-q .choices { display:grid; gap:1.2mm 3mm; margin-top:2.5mm; font-size:10.5pt; }
  .sh-q .choices.c5 { grid-template-columns:repeat(5,1fr); }
  .sh-q .choices.c3 { grid-template-columns:repeat(3,1fr); }
  .sh-q .choices.c2 { grid-template-columns:repeat(2,1fr); }
  .sh-q .choices.c1 { grid-template-columns:1fr; }
  /* 답지: 빠른 정답 표 + 문제별 해설 (2단) */
  .sh-quick { display:grid; grid-template-columns:repeat(5,1fr); border:1px solid #1E2A44; border-radius:1.5mm; overflow:hidden; margin-bottom:4mm; font-size:10pt; }
  .sh-quick > div { display:flex; border-right:1px solid #ccd; border-bottom:1px solid #ccd; min-height:8mm; }
  .sh-quick > div > b { width:7mm; background:#eef0f5; color:#1E2A44; display:flex; align-items:center; justify-content:center; font-weight:800; }
  .sh-quick > div > span { flex:1; display:block; align-self:center; text-align:center; padding:1mm 1.5mm; line-height:1.3; }
  .sh-acols { display:grid; grid-template-columns:1fr 1fr; gap:0 6mm; }
  .sh-acol { overflow:hidden; }
  .sh-acols .sh-acol:first-child { border-right:1px dashed #bbb; padding-right:3mm; }
  .sh-ans { margin-bottom:4mm; font-size:9.5pt; line-height:1.65; word-break:keep-all; break-inside:avoid; }
  .sh-ans .an { font-size:10.5pt; margin-bottom:1mm; }
  .sh-ans .an b { font-size:12pt; margin-right:2mm; }
  .sh-ans .an i { font-style:normal; color:#B62A1D; font-weight:800; }
  .sh-ans .st div { margin:0.6mm 0; }
  `;
  const CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // AI가 줄바꿈을 글자 그대로 "\n"으로 준 경우도 줄바꿈으로 (단 \neq 같은 수식 명령은 그대로)
  const fixNl = (s) => String(s || "").replace(/\\n(?![a-zA-Z])/g, "\n");
  function bodyHtml(text) {
    // 분수는 시험지처럼 크게 (\frac → \dfrac)
    let h = esc(fixNl(text).replace(/\\frac(?=[\s{])/g, "\\dfrac"));
    h = h.replace(/\[\[box\]\]\s*/g, '<div class="box">').replace(/\s*\[\[\/box\]?\]?/g, "</div>");
    h = h.replace(/\n*(\$\$[\s\S]*?\$\$)\n*/g, "$1");
    h = h.replace(/\n/g, "<br>");
    return h;
  }
  // 수식 글꼴(루트·≠·∅·큰 괄호용)을 다 받아둔 뒤에 인쇄/PDF — 안 받아진 채로 찍으면
  // 루트가 끝까지 안 씌워지거나 모양이 깨지고, ≠ 짝대기가 빠지고, ∅가 네모로 나옴
  const KATEX_FONTS = ["400 normal 20px KaTeX_Main", "400 italic 20px KaTeX_Main", "700 normal 20px KaTeX_Main", "400 italic 20px KaTeX_Math",
    "400 normal 20px KaTeX_AMS", "400 normal 20px KaTeX_Size1", "400 normal 20px KaTeX_Size2", "400 normal 20px KaTeX_Size3", "400 normal 20px KaTeX_Size4"];
  async function ensureMathFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try { await Promise.race([Promise.all(KATEX_FONTS.map((f) => document.fonts.load(f, "≠√∅(x)ab12"))), new Promise((r) => setTimeout(r, 8000))]); } catch (_) {}
    try { await document.fonts.ready; } catch (_) {}
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // AI가 그린 SVG 점검·정리: 깨진 SVG면 null(→ 사진 그림 사용), 글자·선이 너무 작으면 키움
  function fixSvg(svg) {
    try {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
      const vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      const vw = vb.length === 4 && vb[2] > 0 ? vb[2] : +root.getAttribute("width") || 400;
      const vh = vb.length === 4 && vb[3] > 0 ? vb[3] : +root.getAttribute("height") || 300;
      if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      root.removeAttribute("width"); root.removeAttribute("height");
      if (!root.getElementsByTagName("*").length) return null;
      // 실제로 그려진 부분에 맞게 테두리 여백 잘라내기 (그림이 작게 찍히지 않게)
      try {
        const host = document.createElement("div"); host.style.cssText = "position:absolute;left:-9999px;top:0;width:400px;height:400px;visibility:hidden";
        const live = document.importNode(root, true); host.appendChild(live); document.body.appendChild(host);
        const bb = live.getBBox(); host.remove();
        if (bb.width > 10 && bb.height > 10) {
          const p = Math.max(bb.width, bb.height) * 0.04;
          root.setAttribute("viewBox", `${(bb.x - p).toFixed(1)} ${(bb.y - p).toFixed(1)} ${(bb.width + 2 * p).toFixed(1)} ${(bb.height + 2 * p).toFixed(1)}`);
        }
      } catch (_) {}
      { const v2 = root.getAttribute("viewBox").split(/[\s,]+/).map(Number); var vwF = v2[2] || vw, vhF = v2[3] || vh; }
      // 인쇄 크기(가로 약 58mm)에서 글자가 2.4mm 이상 되게
      const minFont = Math.max(vwF, vhF * 1.3) * 0.042;
      const fsOf = (el) => { for (let e = el; e && e.getAttribute; e = e.parentNode) { const v = parseFloat(e.getAttribute("font-size") || (e.getAttribute("style") || "").replace(/.*font-size:\s*([\d.]+).*/s, "$1")); if (v > 0) return v; } return 16; };
      [...root.getElementsByTagName("text")].forEach((t) => { if (fsOf(t) < minFont) t.setAttribute("font-size", minFont.toFixed(1)); });
      const minStroke = vwF * 0.0028;
      root.querySelectorAll("[stroke-width]").forEach((e) => { if (parseFloat(e.getAttribute("stroke-width")) < minStroke) e.setAttribute("stroke-width", minStroke.toFixed(2)); });
      return new XMLSerializer().serializeToString(root);
    } catch (_) { return null; }
  }
  async function cropFigure(url, bbox, rot) {
    const im = await loadImg(url); if (!im) return null;
    const p = 0.02;
    const x0 = Math.max(0, bbox[0] - p), y0 = Math.max(0, bbox[1] - p), x1 = Math.min(1, bbox[2] + p), y1 = Math.min(1, bbox[3] + p);
    const sw = (x1 - x0) * im.width, sh = (y1 - y0) * im.height;
    if (sw < 20 || sh < 20) return null;
    const c = document.createElement("canvas"), g = c.getContext("2d");
    // 누워서 찍힌 그림은 바로 세워서 (rot: 시계방향 각도)
    const r = [90, 180, 270].includes(rot) ? rot : 0;
    c.width = Math.round(r % 180 ? sh : sw); c.height = Math.round(r % 180 ? sw : sh);
    g.translate(c.width / 2, c.height / 2); g.rotate(r * Math.PI / 180);
    g.drawImage(im, x0 * im.width, y0 * im.height, sw, sh, -sw / 2, -sh / 2, sw, sh);
    try { return c.toDataURL("image/jpeg", 0.92); } catch (_) { return null; }
  }
  function usePhoto(q) {
    const t = q.typed;
    return !t || q.ocr_status !== "done" || t.use_photo || !String(t.body || "").trim() || (t.confidence === "low" && !t.edited);
  }
  function choicesHtml(ch) {
    if (!ch || !ch.length) return "";
    const plainLen = Math.max(...ch.map((c) => String(c).replace(/\$|\\[a-z]+|[{}]/g, "").length));
    const cls = plainLen <= 5 ? "c5" : plainLen <= 10 ? "c3" : plainLen <= 18 ? "c2" : "c1"; // 반 폭 칸 기준
    return `<div class="choices ${cls}">${ch.map((c, i) => `<div>${CIRC[i] || i + 1} ${bodyHtml(c)}</div>`).join("")}</div>`;
  }
  function groupByStudent(items) {
    const m = new Map();
    items.forEach((q) => { if (!m.has(q.student_id)) m.set(q.student_id, { name: q.students?.name || "", qs: [] }); m.get(q.student_id).qs.push(q); });
    return [...m.values()];
  }
  const ansTxt = (q) => { const a = q.typed?.sol?.answer; return a ? String(a) : "—"; };
  const renderMath = (el) => { if (window.renderMathInElement) window.renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false, strict: "ignore" }); };
  const MM = (() => { let v = 0; return () => { if (!v) { const d = document.createElement("div"); d.style.cssText = "position:absolute;width:100mm;visibility:hidden"; document.body.appendChild(d); v = d.offsetWidth / 100; d.remove(); } return v; }; })();
  // 학생 한 명의 답지 장들을 만들어 container 끝에 붙임 (해설이 넘치면 다음 칸·다음 장으로)
  function answerPages(root, g, ds, base) {
    const head = (k) => `<div class="sh-head"><img class="lg" src="${base}logo.png"><div class="bar"></div><div class="ttl">정답·해설</div><div class="info"><b>${esc(g.name)}</b> · ${esc(ds)}${k ? ` (${k + 1})` : ""}</div></div>`;
    const foot = `<div class="sh-pfoot"><img src="${base}logo-ko.png"></div>`;
    const blocks = g.qs.map((q, i) => {
      const st = (q.typed?.sol?.steps || []).map((x) => `<div>${bodyHtml(x)}</div>`).join("");
      return `<div class="sh-ans"><div class="an"><b>${i + 1}</b>정답 <i>${bodyHtml(ansTxt(q))}</i></div>${st ? `<div class="st">${st}</div>` : ""}</div>`;
    });
    const PAGE_H = 268 * MM();
    let k = 0, page, cols, ci;
    const newPage = (withQuick) => {
      page = document.createElement("div"); page.className = "sh-page sh-apage";
      page.innerHTML = head(k++) + (withQuick ? `<div class="sh-quick">${g.qs.map((q, i) => `<div><b>${i + 1}</b><span>${bodyHtml(ansTxt(q)).replace(/\\dfrac/g, "\\frac")}</span></div>`).join("")}</div>` : "") + `<div class="sh-acols"><div class="sh-acol"></div><div class="sh-acol"></div></div>` + foot;
      root.appendChild(page); renderMath(page);
      cols = page.querySelectorAll(".sh-acol"); ci = 0;
      const used = [...page.children].filter((c) => !c.classList.contains("sh-acols")).reduce((a, c) => a + c.offsetHeight + parseFloat(getComputedStyle(c).marginBottom || 0) + parseFloat(getComputedStyle(c).marginTop || 0), 0);
      const h = Math.max(60 * MM(), PAGE_H - used - 4 * MM());
      cols.forEach((c) => (c.style.height = h + "px"));
    };
    newPage(true);
    for (const b of blocks) {
      const t = document.createElement("div"); t.innerHTML = b; const el = t.firstChild;
      for (let tries = 0; tries < 3; tries++) {
        cols[ci].appendChild(el); renderMath(el);
        if (cols[ci].scrollHeight <= cols[ci].clientHeight + 1 || cols[ci].children.length === 1) break;
        cols[ci].removeChild(el);
        if (ci === 0) ci = 1; else newPage(false);
      }
    }
  }
  // container 안에 오답 정리지를 그림. 그림·폰트·수식이 다 준비되면 resolve
  async function build(container, items, opts = {}) {
    await ensureMathFonts();
    if (!document.getElementById("sheet-css")) { const st = document.createElement("style"); st.id = "sheet-css"; st.textContent = CSS; document.head.appendChild(st); }
    const d = new Date();
    const ds = opts.label || `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const base = opts.base || "";
    // 그림 잘라두기
    const figs = {};
    await Promise.all(items.map(async (q) => {
      const f = q.typed?.figure;
      if (usePhoto(q) || !f?.present) return;
      // AI가 다시 그린 그림(SVG)이 있으면 그걸로, 없으면 원본 사진에서 잘라서
      const svg = f.svg && !f.use_crop ? fixSvg(f.svg) : null;
      if (svg) figs[q.id] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      else if (f.bbox) figs[q.id] = await cropFigure(q.typed.img === "full" && q.full_url ? q.full_url : (q.orig_url || q.url), f.bbox, f.rot);
    }));
    let h = '<div class="sheet-root">';
    const PER = 4; // 한 장에 4문제 (2×2)
    const groups = groupByStudent(items);
    groups.forEach((g) => {
      const pages = Math.ceil(g.qs.length / PER);
      for (let p = 0; p < pages; p++) {
        h += `<div class="sh-page"><div class="sh-head"><img class="lg" src="${base}logo.png"><div class="bar"></div><div class="ttl">오답 정리</div>
          <div class="info"><b>${esc(g.name)}</b> · ${esc(ds)} · ${g.qs.length}문제${pages > 1 ? ` (${p + 1}/${pages})` : ""}</div></div><div class="sh-grid">`;
        g.qs.slice(p * PER, p * PER + PER).forEach((q, j) => {
          const i = p * PER + j, t = q.typed || {};
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
        h += `</div><div class="sh-pfoot"><img src="${base}logo-ko.png"></div></div>`;
      }
      if (opts.answers) h += `<div class="sh-ansmark" data-g="${groups.indexOf(g)}"></div>`;
    });
    h += "</div>";
    container.innerHTML = h;
    if (window.renderMathInElement) {
      window.renderMathInElement(container, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false, strict: "ignore" });
    }
    // 답지: 학생마다 문제 장 바로 뒤에 (실제 높이를 재면서 장을 나눔)
    if (opts.answers) {
      // 숨겨진 칸(display:none)에서는 높이를 못 재니까 잠깐 화면 밖에 펼쳐서
      const prevStyle = container.getAttribute("style");
      if (!container.offsetWidth) container.style.cssText = (prevStyle || "") + ";display:block;position:fixed;left:-20000px;top:0;width:190mm;visibility:visible";
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      container.querySelectorAll(".sh-ansmark").forEach((m) => {
        const tmp = document.createElement("div"); tmp.className = "sh-tmp";
        m.parentNode.insertBefore(tmp, m);
        answerPages(tmp, groups[+m.dataset.g], ds, base);
        while (tmp.firstChild) m.parentNode.insertBefore(tmp.firstChild, tmp);
        tmp.remove(); m.remove();
      });
      if (prevStyle === null) container.removeAttribute("style"); else container.setAttribute("style", prevStyle);
    }
    await Promise.all([...container.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    await ensureMathFonts();
    return { students: groupByStudent(items).length, problems: items.length };
  }
  window.AnswerSheet = { build, usePhoto, groupByStudent, fixSvg, cropFigure, ensureMathFonts };
})();
