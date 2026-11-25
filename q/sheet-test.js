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
  .sh-q .fig.big img { width:100%; max-width:100%; max-height:92mm; }   /* 보기까지 그림인 문제 */
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
    // 숨겨진 창에선 requestAnimationFrame이 안 돌아서 멈출 수 있으니 짧은 대기와 경주
    await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 150))]);
  }
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // ───── 기울어진 그림 바로 세우기 ─────
  // AI는 사진에 찍힌 위치 그대로 옮겨 그리기 때문에, 책을 비스듬히 찍으면 좌표축·점선·테두리까지 같이 기울어짐.
  // 가로·세로에 가까운 긴 직선들이 얼마나 기울었는지 재서, 그만큼 모든 좌표를 되돌려 놓음 (글자는 눕히지 않고 위치만 옮김).
  // path의 d → 절대좌표 명령 목록. 못 읽으면 null
  function pathCmds(d) {
    const tk = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g); if (!tk) return null;
    const out = []; let i = 0, c = "", x = 0, y = 0, sx = 0, sy = 0;
    const num = () => { if (i >= tk.length || /[a-zA-Z]/.test(tk[i])) throw 0; const v = parseFloat(tk[i++]); if (!isFinite(v)) throw 0; return v; };
    const flag = () => { const t = tk[i]; if (t === "0" || t === "1") { i++; return +t; } if (/^[01]\d/.test(t || "")) { tk[i] = t.slice(1); return +t[0]; } throw 0; };
    try {
      while (i < tk.length) {
        if (/[a-zA-Z]/.test(tk[i])) c = tk[i++]; else if (!c || c === "Z" || c === "z") return null; else if (c === "M") c = "L"; else if (c === "m") c = "l";
        const C = c.toUpperCase(), rel = c !== C, ox = rel ? x : 0, oy = rel ? y : 0;
        if (C === "Z") { out.push(["Z"]); x = sx; y = sy; continue; }
        if (C === "H") { x = ox + num(); out.push(["L", x, y]); continue; }
        if (C === "V") { y = oy + num(); out.push(["L", x, y]); continue; }
        if (C === "A") { const rx = num(), ry = num(), rot = num(), f1 = flag(), f2 = flag(); x = ox + num(); y = oy + num(); out.push(["A", rx, ry, rot, f1, f2, x, y]); continue; }
        const n = { M: 1, L: 1, T: 1, Q: 2, S: 2, C: 3 }[C]; if (!n) return null;
        const k = [C]; for (let j = 0; j < n; j++) { const px = ox + num(), py = oy + num(); k.push(px, py); if (j === n - 1) { x = px; y = py; } }
        out.push(k); if (C === "M") { sx = x; sy = y; }
      }
    } catch (_) { return null; }
    return out;
  }
  function straighten(live) {
    const vb = (live.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return false;
    const VW = vb[2], VH = vb[3], xc = vb[0] + VW / 2, yc = vb[1] + VH / 2;
    if (live.querySelector("clipPath,mask,use,symbol,pattern,textPath")) return false;   // 복잡한 그림은 건드리지 않음
    const rootInv = live.getScreenCTM().inverse();
    const mats = new Map();
    const M = (el) => { let m = mats.get(el); if (!m) { m = rootInv.multiply(el.getScreenCTM()); mats.set(el, m); } return m; };
    const toRoot = (el, x, y) => { const p = new DOMPoint(x, y).matrixTransform(M(el)); return [p.x, p.y]; };
    const A = (el, k) => { const v = parseFloat(el.getAttribute(k)); return isFinite(v) ? v : 0; };
    const els = [...live.querySelectorAll("line,polyline,polygon,path,rect,circle,ellipse,text,tspan")].filter((e) => !e.closest("defs,marker"));
    const stroked = (el) => { const st = getComputedStyle(el).stroke; return !!st && st !== "none"; };
    // 1) 직선 조각 모으기 (선이 그어진 것만: 색칠 영역의 가장자리는 기준으로 안 씀)
    const segs = [], paths = new Map(), polys = new Map(), rects = [];
    for (const el of els) {
      const t = el.tagName.toLowerCase(), use = t !== "text" && t !== "tspan" && stroked(el);
      if (t === "line") { if (use) segs.push([...toRoot(el, A(el, "x1"), A(el, "y1")), ...toRoot(el, A(el, "x2"), A(el, "y2"))]); }
      else if (t === "polyline" || t === "polygon") {
        const a = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
        if (a.length < 2 || a.length % 2 || a.some((v) => !isFinite(v))) return false;
        polys.set(el, a);
        if (use) { const q = []; for (let i = 0; i < a.length; i += 2) q.push(toRoot(el, a[i], a[i + 1]));
          for (let i = 1; i < q.length; i++) segs.push([...q[i - 1], ...q[i]]);
          if (t === "polygon" && q.length > 2) segs.push([...q[q.length - 1], ...q[0]]); }
      } else if (t === "path") {
        const c = pathCmds(el.getAttribute("d") || ""); if (!c) return false;
        paths.set(el, c);
        if (use) { let cur = null, st = null; for (const k of c) {
          if (k[0] === "Z") { if (cur && st) segs.push([...toRoot(el, cur[0], cur[1]), ...toRoot(el, st[0], st[1])]); cur = st; continue; }
          const e = [k[k.length - 2], k[k.length - 1]];
          if (k[0] === "M") st = e; else if (k[0] === "L" && cur) segs.push([...toRoot(el, cur[0], cur[1]), ...toRoot(el, e[0], e[1])]);
          cur = e; } }
      } else if (t === "rect") {
        const w = A(el, "width"), h = A(el, "height"), c = toRoot(el, A(el, "x") + w / 2, A(el, "y") + h / 2);
        const rot = /^\s*rotate\(\s*(-?[\d.]+)/.exec(el.getAttribute("transform") || ""), deg = rot ? parseFloat(rot[1]) : 0;
        rects.push({ el, w, h, c, deg, tilt: !!rot && Math.abs(deg) <= 10 && !/\)\s*\S/.test(el.getAttribute("transform")) });
      }
    }
    const H = [], V = [], TOL = 0.14;   // 8°까지를 '원래 가로·세로였을 선'으로 봄
    for (const [x1, y1, x2, y2] of segs) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (Math.abs(dy) <= TOL * Math.abs(dx)) { if (len >= 0.12 * VW) H.push({ s: dy / dx, len, pos: (y1 + y2) / 2, long: len >= 0.4 * VW }); }
      else if (Math.abs(dx) <= TOL * Math.abs(dy)) { if (len >= 0.12 * VH) V.push({ s: dx / dy, len, pos: (x1 + x2) / 2, long: len >= 0.4 * VH }); }
    }
    // 같은 크기 네모(카드·칸)가 한 줄로 늘어서 있으면 그 줄도 기준선으로
    const tilted = rects.filter((r) => r.tilt && r.deg);
    for (const r of tilted) { const tn = Math.tan(r.deg * Math.PI / 180); H.push({ s: tn, len: r.w, pos: r.c[1], long: false }); V.push({ s: -tn, len: r.h, pos: r.c[0], long: false }); }
    if (rects.length >= 3) {
      const w0 = rects[0].w, h0 = rects[0].h, same = rects.filter((r) => Math.abs(r.w - w0) <= 0.12 * w0 && Math.abs(r.h - h0) <= 0.12 * h0);
      if (same.length >= 3 && same.length === rects.length) {
        const n = same.length, mx = same.reduce((t, r) => t + r.c[0], 0) / n, my = same.reduce((t, r) => t + r.c[1], 0) / n;
        const sxx = same.reduce((t, r) => t + (r.c[0] - mx) ** 2, 0), syy = same.reduce((t, r) => t + (r.c[1] - my) ** 2, 0), sxy = same.reduce((t, r) => t + (r.c[0] - mx) * (r.c[1] - my), 0);
        const xs = same.map((r) => r.c[0]), ys = same.map((r) => r.c[1]);
        if (sxx > syy * 30 && sxx > 0) { const len = Math.max(...xs) - Math.min(...xs) + w0; H.push({ s: sxy / sxx, len, pos: my, long: len >= 0.4 * VW }); }
        else if (syy > sxx * 30 && syy > 0) { const len = Math.max(...ys) - Math.min(...ys) + h0; V.push({ s: sxy / syy, len, pos: mx, long: len >= 0.4 * VH }); }
      }
    }
    if (!H.length && !V.length) return false;
    // 2) 전체가 한쪽으로 얼마나 돌아갔는지(가운데값) 먼저 잡고, 거기서 크게 벗어난 선(원래 비스듬한 선)은 뺌
    const all = [...H.map((a) => ({ v: a.s, len: a.len })), ...V.map((a) => ({ v: -a.s, len: a.len }))].sort((p, q) => p.v - q.v);
    const tot = all.reduce((t, a) => t + a.len, 0); let acc = 0, th = 0;
    for (const a of all) { acc += a.len; if (acc >= tot / 2) { th = a.v; break; } }
    const hi = H.filter((a) => Math.abs(a.s - th) <= 0.045), vi = V.filter((a) => Math.abs(-a.s - th) <= 0.045);
    if (!hi.some((a) => a.long) && !vi.some((a) => a.long)) return false;   // 믿을 만한 긴 기준선이 없으면 그대로 둠
    // 3) 방향별 기울기: 평균 + (기준선이 넓게 퍼져 있으면) 위치에 따라 달라지는 정도까지 — 비스듬히 찍힌 사진은 선마다 기울기가 조금씩 다름
    const fit = (arr, span, dim) => {
      if (!arr.length) return null;
      const W = arr.reduce((t, a) => t + a.len, 0), a0 = arr.reduce((t, a) => t + a.s * a.len, 0) / W, pm = arr.reduce((t, a) => t + a.pos * a.len, 0) / W;
      let b = 0; const big = arr.filter((a) => a.len >= 0.25 * dim), ps = big.map((a) => a.pos);
      if (big.length >= 2 && Math.max(...ps) - Math.min(...ps) >= 0.4 * span) {
        const sxx = arr.reduce((t, a) => t + a.len * (a.pos - pm) ** 2, 0), sxy = arr.reduce((t, a) => t + a.len * (a.pos - pm) * (a.s - a0), 0);
        if (sxx > 0) { const lim = 0.14 / span; b = Math.max(-lim, Math.min(lim, sxy / sxx)); }
      }
      return { a: a0, b, pm };
    };
    const fh = fit(hi, VH, VW), fv = fit(vi, VW, VH);
    const sh = (y) => fh ? fh.a + fh.b * (y - fh.pm) : -(fv.a);      // 가로선 기울기 (없으면 세로선과 같은 각도로 돌아갔다고 봄)
    const sv = (x) => fv ? fv.a + fv.b * (x - fv.pm) : -(fh.a);
    const worst = Math.max(Math.abs(sh(vb[1])), Math.abs(sh(vb[1] + VH)), Math.abs(sv(vb[0])), Math.abs(sv(vb[0] + VW)));
    if (worst < 0.006 || worst > 0.2) return false;                  // 이미 반듯함(0.35° 미만) / 말이 안 되게 큼
    const warp = (x, y) => [x - sv(x) * (y - yc), y - sh(y) * (x - xc)];
    const map = (el, x, y, m) => { m = m || M(el); const p = new DOMPoint(x, y).matrixTransform(m), w = warp(p.x, p.y), q = new DOMPoint(w[0], w[1]).matrixTransform(m.inverse()); return [q.x, q.y]; };
    const f1 = (v) => String(+v.toFixed(1));
    // 4) 옮길 값을 전부 계산해 둔 뒤 한꺼번에 적용 (중간에 실패하면 아무것도 안 바꿈)
    const ops = [];
    for (const el of els) {
      const t = el.tagName.toLowerCase();
      if (t === "line") { const a = map(el, A(el, "x1"), A(el, "y1")), b = map(el, A(el, "x2"), A(el, "y2")); ops.push([el, "x1", f1(a[0])], [el, "y1", f1(a[1])], [el, "x2", f1(b[0])], [el, "y2", f1(b[1])]); }
      else if (polys.has(el)) { const a = polys.get(el), o = []; for (let i = 0; i < a.length; i += 2) { const p = map(el, a[i], a[i + 1]); o.push(f1(p[0]) + "," + f1(p[1])); } ops.push([el, "points", o.join(" ")]); }
      else if (paths.has(el)) {
        const d = paths.get(el).map((k) => {
          if (k[0] === "Z") return "Z";
          if (k[0] === "A") { const p = map(el, k[6], k[7]); return `A${k[1]} ${k[2]} ${k[3]} ${k[4]} ${k[5]} ${f1(p[0])} ${f1(p[1])}`; }
          const o = []; for (let i = 1; i < k.length; i += 2) { const p = map(el, k[i], k[i + 1]); o.push(f1(p[0]), f1(p[1])); }
          return k[0] + o.join(" ");
        }).join(" ");
        ops.push([el, "d", d]);
      } else if (t === "circle" || t === "ellipse") { const p = map(el, A(el, "cx"), A(el, "cy")); ops.push([el, "cx", f1(p[0])], [el, "cy", f1(p[1])]); }
      else if (t === "rect") {
        const r = rects.find((q) => q.el === el), w = warp(r.c[0], r.c[1]);
        // 살짝 돌려 그린 네모는 똑바로 세움 (돌림 표시 삭제 → 부모 기준 좌표로 다시 계산)
        const m = r.tilt ? rootInv.multiply(el.parentNode.getScreenCTM()) : M(el), q = new DOMPoint(w[0], w[1]).matrixTransform(m.inverse());
        ops.push([el, "x", f1(q.x - r.w / 2)], [el, "y", f1(q.y - r.h / 2)]); if (r.tilt) ops.push([el, "transform", null]);
      } else if (t === "text") {
        const xs = (el.getAttribute("x") || "").trim().split(/[\s,]+/).filter(Boolean), ys = (el.getAttribute("y") || "").trim().split(/[\s,]+/).filter(Boolean);
        if (xs.length > 1 || ys.length > 1) continue;                // 글자마다 좌표를 준 경우는 그대로 둠
        const p = map(el, A(el, "x"), A(el, "y")); ops.push([el, "x", f1(p[0])], [el, "y", f1(p[1])]);
      } else if (t === "tspan") {
        const hx = el.hasAttribute("x"), hy = el.hasAttribute("y"); if (!hx && !hy) continue;
        const par = el.closest("text"); if (!par) continue;
        const p = map(el, hx ? A(el, "x") : A(par, "x"), hy ? A(el, "y") : A(par, "y"));
        if (hx) ops.push([el, "x", f1(p[0])]); if (hy) ops.push([el, "y", f1(p[1])]);
      }
    }
    for (const [el, k, v] of ops) { if (v === null) el.removeAttribute(k); else el.setAttribute(k, v); }
    return true;
  }
  // AI가 그린 SVG 점검·정리: 깨진 SVG면 null(→ 사진 그림 사용), 기울어진 건 바로 세우고, 글자·선이 너무 작으면 키움
  function fixSvg(svg, opt) {
    let host = null;
    try {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      let root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
      const vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      const vw = vb.length === 4 && vb[2] > 0 ? vb[2] : +root.getAttribute("width") || 400;
      const vh = vb.length === 4 && vb[3] > 0 ? vb[3] : +root.getAttribute("height") || 300;
      if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      root.removeAttribute("width"); root.removeAttribute("height");
      if (!root.getElementsByTagName("*").length) return null;
      // 화면 밖에 잠깐 붙여 놓고(크기·위치를 재려면 붙어 있어야 함) 기울기 바로잡기 + 테두리 여백 잘라내기 (그림이 작게 찍히지 않게)
      try {
        host = document.createElement("div"); host.style.cssText = "position:absolute;left:-9999px;top:0;width:400px;height:400px;visibility:hidden";
        const live = document.importNode(root, true); host.appendChild(live); document.body.appendChild(host);
        if (!(opt && opt.keepTilt)) { try { straighten(live); } catch (_) {} }
        const bb = live.getBBox();
        if (bb.width > 10 && bb.height > 10) {
          const p = Math.max(bb.width, bb.height) * 0.04;
          live.setAttribute("viewBox", `${(bb.x - p).toFixed(1)} ${(bb.y - p).toFixed(1)} ${(bb.width + 2 * p).toFixed(1)} ${(bb.height + 2 * p).toFixed(1)}`);
        }
        root = live;
      } catch (_) {}
      { const v2 = root.getAttribute("viewBox").split(/[\s,]+/).map(Number); var vwF = v2[2] || vw, vhF = v2[3] || vh; }
      // 인쇄 크기(가로 약 58mm)에서 글자가 2.4mm 이상 되게
      const minFont = Math.max(vwF, vhF * 1.3) * 0.042;
      const fsOf = (el) => { for (let e = el; e && e.getAttribute && e !== root.parentNode; e = e.parentNode) { const v = parseFloat(e.getAttribute("font-size") || (e.getAttribute("style") || "").replace(/.*font-size:\s*([\d.]+).*/s, "$1")); if (v > 0) return v; } return 16; };
      [...root.getElementsByTagName("text")].forEach((t) => { if (fsOf(t) < minFont) t.setAttribute("font-size", minFont.toFixed(1)); });
      const minStroke = vwF * 0.0028;
      root.querySelectorAll("[stroke-width]").forEach((e) => { if (parseFloat(e.getAttribute("stroke-width")) < minStroke) e.setAttribute("stroke-width", minStroke.toFixed(2)); });
      return new XMLSerializer().serializeToString(root);
    } catch (_) { return null; } finally { if (host) host.remove(); }
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
      // 손으로 다듬은 그림(manual)은 글자 크기 보정 없이 그대로
      const svg = f.svg && !f.use_crop ? (f.manual ? f.svg : fixSvg(f.svg)) : null;
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
            if (figs[q.id]) h += `<div class="fig${q.typed?.figure?.big ? " big" : ""}"><img src="${figs[q.id]}"></div>`;
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
  window.AnswerSheet = { build, usePhoto, groupByStudent, fixSvg, cropFigure, ensureMathFonts, bodyHtml, choicesHtml };
})();
