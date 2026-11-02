/* Small dependency-free SVG charts with hover tooltips.
 * Colors come from CSS custom properties so light/dark themes work. */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var tooltip = function () { return document.getElementById("tooltip"); };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return [0, 1];
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var t = [], start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
    for (var v = start; v <= end + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function fmt(v) { if (v == null || !isFinite(v)) return "–"; return Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v).toLocaleString() : (+v.toFixed(2)).toString(); }

  function showTip(html, evt) {
    var t = tooltip(); t.innerHTML = html; t.hidden = false;
    var x = evt.clientX + 14, y = evt.clientY + 14, r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - 14;
    t.style.left = Math.max(8, x) + "px"; t.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tooltip().hidden = true; }

  function frame(container, opts) {
    container.innerHTML = "";
    var W = Math.max(320, container.clientWidth || 800), H = opts.height || Math.round(Math.min(460, Math.max(300, W * 0.5)));
    var m = { top: 16, right: opts.rightMargin || 110, bottom: 48, left: 62 };
    if (W < 520) m.right = Math.min(m.right, 16);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.ariaLabel || "chart" }, container);
    return { svg: svg, W: W, H: H, m: m, iw: W - m.left - m.right, ih: H - m.top - m.bottom };
  }

  function axes(f, xs, ys, xLabel, yLabel, xFmt) {
    var g = el("g", {}, f.svg);
    var x = function (v) { return f.m.left + (v - xs[0]) / (xs[xs.length - 1] - xs[0]) * f.iw; };
    var y = function (v) { return f.m.top + f.ih - (v - ys[0]) / (ys[ys.length - 1] - ys[0]) * f.ih; };
    ys.forEach(function (v) {
      el("line", { x1: f.m.left, x2: f.m.left + f.iw, y1: y(v), y2: y(v), class: "gridline" }, g);
      var t = el("text", { x: f.m.left - 8, y: y(v) + 4, "text-anchor": "end" }, g); t.textContent = fmt(v);
    });
    xs.forEach(function (v) {
      var t = el("text", { x: x(v), y: f.m.top + f.ih + 18, "text-anchor": "middle" }, g); t.textContent = xFmt ? xFmt(v) : fmt(v);
    });
    el("line", { x1: f.m.left, x2: f.m.left + f.iw, y1: f.m.top + f.ih, y2: f.m.top + f.ih, class: "baseline" }, g);
    var xt = el("text", { x: f.m.left + f.iw / 2, y: f.H - 8, "text-anchor": "middle", class: "axis-title" }, g); xt.textContent = xLabel;
    var yt = el("text", { x: 14, y: f.m.top + f.ih / 2, "text-anchor": "middle", class: "axis-title", transform: "rotate(-90 14 " + (f.m.top + f.ih / 2) + ")" }, g); yt.textContent = yLabel;
    return { x: x, y: y };
  }

  function empty(f, msg) {
    var t = el("text", { x: f.W / 2, y: f.H / 2, "text-anchor": "middle", class: "empty" }, f.svg); t.textContent = msg;
  }

  /* series: [{name, color, dash, points:[{x, y, lo, hi, tip}]}]
   * refs: [{name, y}] horizontal dashed reference lines */
  function lineChart(container, opts) {
    var f = frame(container, opts);
    var all = [];
    opts.series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) { empty(f, opts.emptyText || "No data to chart"); return; }
    var xmin = Math.min.apply(null, all.map(function (p) { return p.x; }));
    var xmax = Math.max.apply(null, all.map(function (p) { return p.x; }));
    var yv = [];
    all.forEach(function (p) { yv.push(p.y); if (opts.showRange && p.lo != null) { yv.push(p.lo, p.hi); } });
    (opts.refs || []).forEach(function (r) { yv.push(r.y); });
    var ymin = Math.min.apply(null, yv), ymax = Math.max.apply(null, yv);
    if (opts.yZero && ymin > 0) ymin = 0;
    var pad = (ymax - ymin) * 0.06 || 1;
    var xs = niceTicks(Math.min(0, xmin), xmax, Math.max(3, Math.floor(f.iw / 90)));
    var ys = niceTicks(opts.yZero ? ymin : ymin - pad, ymax + pad, 6);
    var s = axes(f, xs, ys, opts.xLabel, opts.yLabel);

    (opts.refs || []).forEach(function (r) {
      el("line", { x1: f.m.left, x2: f.m.left + f.iw, y1: s.y(r.y), y2: s.y(r.y), stroke: "var(--text-muted)", "stroke-width": 1.5, "stroke-dasharray": "2 4" }, f.svg);
      var t = el("text", { x: f.m.left + 6, y: s.y(r.y) - 6, class: "axis-title" }, f.svg); t.textContent = r.name + " " + fmt(r.y);
    });

    var labels = [];
    opts.series.forEach(function (ser) {
      var pts = ser.points.slice().sort(function (a, b) { return a.x - b.x; });
      if (!pts.length) return;
      if (opts.showRange) {
        pts.forEach(function (p) {
          if (p.lo == null) return;
          el("line", { x1: s.x(p.x), x2: s.x(p.x), y1: s.y(p.lo), y2: s.y(p.hi), stroke: ser.color, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.22 }, f.svg);
        });
      }
      el("path", { d: pts.map(function (p, i) { return (i ? "L" : "M") + s.x(p.x) + "," + s.y(p.y); }).join(""), fill: "none", stroke: ser.color, "stroke-width": 2, "stroke-dasharray": ser.dash || null, "stroke-linejoin": "round" }, f.svg);
      pts.forEach(function (p) {
        el("circle", { cx: s.x(p.x), cy: s.y(p.y), r: 4, fill: ser.color, stroke: "var(--surface-1)", "stroke-width": 2 }, f.svg);
      });
      var last = pts[pts.length - 1];
      labels.push({ y: s.y(last.y), x: s.x(last.x), text: ser.name, color: ser.color });
    });

    // Direct labels at line ends when room and few series
    if (f.m.right > 60 && labels.length <= 4) {
      labels.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
      labels.forEach(function (l) {
        var t = el("text", { x: f.m.left + f.iw + 8, y: l.y + 4, style: "fill: var(--text-primary)" }, f.svg);
        t.textContent = l.text.length > 16 ? l.text.slice(0, 15) + "…" : l.text;
      });
    }

    // Crosshair + tooltip on nearest x
    var xsAll = Array.from(new Set(all.map(function (p) { return p.x; }))).sort(function (a, b) { return a - b; });
    var cross = el("line", { y1: f.m.top, y2: f.m.top + f.ih, stroke: "var(--axis)", "stroke-width": 1, visibility: "hidden" }, f.svg);
    var hit = el("rect", { x: f.m.left, y: f.m.top, width: f.iw, height: f.ih, fill: "transparent" }, f.svg);
    hit.addEventListener("mousemove", function (evt) {
      var pt = f.svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      var loc = pt.matrixTransform(f.svg.getScreenCTM().inverse());
      var best = xsAll[0], bd = Infinity;
      xsAll.forEach(function (v) { var d = Math.abs(s.x(v) - loc.x); if (d < bd) { bd = d; best = v; } });
      cross.setAttribute("x1", s.x(best)); cross.setAttribute("x2", s.x(best)); cross.setAttribute("visibility", "visible");
      var rows = [];
      opts.series.forEach(function (ser) {
        ser.points.forEach(function (p) {
          if (p.x === best) rows.push('<div class="tt-row"><span class="swatch" style="background:' + ser.color + '"></span>' + esc(ser.name) + ": <b>" + fmt(p.y) + (opts.yUnit || "") + "</b>" + (p.tip ? ' <span class="muted">' + esc(p.tip) + "</span>" : "") + "</div>");
        });
      });
      showTip('<div class="tt-head">' + esc(opts.xLabel) + ": " + fmt(best) + "</div>" + rows.join(""), evt);
    });
    hit.addEventListener("mouseleave", function () { cross.setAttribute("visibility", "hidden"); hideTip(); });
  }

  /* points: [{x, y, color, hollow, label, tip, r}]; lines: [{points:[{x,y}], color, dash}] ; vlines:[{x,label}] */
  function scatterChart(container, opts) {
    var f = frame(container, Object.assign({ rightMargin: 24 }, opts));
    var pts = opts.points;
    if (!pts.length) { empty(f, opts.emptyText || "No data to chart"); return; }
    var xv = pts.map(function (p) { return p.x; }).concat(opts.xExtent || []).concat((opts.vlines || []).map(function (v) { return v.x; }));
    var yv = pts.map(function (p) { return p.y; }).concat(opts.yExtent || []);
    var xmin = Math.min.apply(null, xv), xmax = Math.max.apply(null, xv), ymin = Math.min.apply(null, yv), ymax = Math.max.apply(null, yv);
    var xp = (xmax - xmin) * 0.1 || 2, yp = (ymax - ymin) * 0.1 || 2;
    var xs = niceTicks(Math.max(0, xmin - xp), xmax + xp, Math.max(3, Math.floor(f.iw / 90)));
    var ys = niceTicks(opts.yZero ? Math.max(0, ymin - yp) : ymin - yp, ymax + yp, 6);
    var s = axes(f, xs, ys, opts.xLabel, opts.yLabel);

    (opts.vlines || []).forEach(function (v) {
      el("line", { x1: s.x(v.x), x2: s.x(v.x), y1: f.m.top, y2: f.m.top + f.ih, stroke: "var(--text-muted)", "stroke-width": 1.5, "stroke-dasharray": "2 4" }, f.svg);
      var t = el("text", { x: s.x(v.x) + 6, y: f.m.top + 12, class: "axis-title" }, f.svg); t.textContent = v.label;
    });
    (opts.lines || []).forEach(function (ln) {
      var p = ln.points.slice().sort(function (a, b) { return a.x - b.x; });
      el("path", { d: p.map(function (q, i) { return (i ? "L" : "M") + s.x(q.x) + "," + s.y(q.y); }).join(""), fill: "none", stroke: ln.color, "stroke-width": 2, "stroke-dasharray": ln.dash || null }, f.svg);
    });
    pts.forEach(function (p) {
      var r = p.r || 6;
      var c = el("circle", { cx: s.x(p.x), cy: s.y(p.y), r: r, fill: p.hollow ? "var(--surface-1)" : p.color, stroke: p.hollow ? p.color : "var(--surface-1)", "stroke-width": 2 }, f.svg);
      if (p.label) {
        var t = el("text", { x: s.x(p.x) + r + 4, y: s.y(p.y) + 4, style: "fill: var(--text-primary)" }, f.svg); t.textContent = p.label;
      }
      var hitc = el("circle", { cx: s.x(p.x), cy: s.y(p.y), r: r + 8, fill: "transparent" }, f.svg);
      hitc.addEventListener("mousemove", function (evt) { showTip(p.tip || esc(p.label), evt); c.setAttribute("r", r + 2); });
      hitc.addEventListener("mouseleave", function () { hideTip(); c.setAttribute("r", r); });
    });
  }

  window.Charts = { lineChart: lineChart, scatterChart: scatterChart, esc: esc, fmt: fmt };
})();
