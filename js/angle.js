/* Edge Stability Lab: Edge retention tab.
 * 1. Design from a toughness requirement: for each steel, the hardest it can be at a minimum toughness,
 *    its predicted CATRA edge retention, and the most acute angle your own test results say it supports.
 * 2. Edge angle calculator: predicted CATRA TCC vs edge angle for one steel.
 * Plain JS, no build step. Uses Charts from charts.js. */
(function () {
  "use strict";
  var esc = Charts.esc, fmt = Charts.fmt;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---------- reference data ----------
  // Larrin Thomas, "Testing the Edge Retention of 48 Knife Steels", Knife Steel Nerds (2020).
  // [steel, heat treat, HRc, TCC mm]. All sharpened to 30° inclusive with a 400 grit CBN stone.
  var CATRA = [
    ["1.2442", "1475°F / 300°F", 62.5, 330], ["1.2519", "1525°F / 400°F", 62.2, 320], ["1.2562", "1475°F / 400°F", 65.4, 348],
    ["1095", "1475°F / 400°F", 61.8, 316], ["8670", "1525°F / 400°F", 59.2, 271], ["52100", "1525°F / 350°F", 60.5, 328],
    ["10V", "1800°F / 500°F", 59.9, 718], ["10V", "1975°F / 400°F", 65.9, 797], ["14C28N", "2000°F / 375°F", 62, 414],
    ["15V", "1900°F / 500°F", 63, 879], ["204P", "2050°F / 400°F", 61.5, 620], ["26C3", "1475°F / 350°F", 63, 304],
    ["3V", "1950°F / 300°F", 60.1, 463], ["440C", "1850°F / 350°F", 56, 405], ["440C", "1850°F / 300°F", 57, 425],
    ["440C", "1950°F / 300°F", 62.8, 455], ["4V", "1900°F / 400°F", 63, 538], ["4V", "1950°F / 1000°F", 60.7, 526],
    ["A2", "1775°F / 400°F", 61.5, 339], ["A8 mod", "1900°F / 400°F", 60.6, 351], ["AEB-L", "1950°F / 400°F", 61.1, 360],
    ["AEB-L", "1975°F / 300°F", 64.6, 444], ["AEB-L", "1975°F / 350°F", 62.7, 387], ["BD1N", "1900°F / 400°F", 60.6, 404],
    ["Blue Super", "1475°F / 400°F", 65.1, 338], ["Caldie", "1850°F / 500°F", 60.6, 314], ["CD1", "1925°F / 400°F", 60.9, 353],
    ["CPM CruWear", "1975°F / 400°F", 62.1, 528], ["CPM-154", "1950°F / 400°F", 61, 492], ["CPM-M4", "2000°F / 1000°F", 61.1, 570],
    ["CruForgeV", "1500°F / 400°F", 61.1, 320], ["D2", "1850°F / 400°F, no cryo", 60.5, 486], ["D2", "1850°F / 500°F, 36 h cryo", 59.2, 499],
    ["Elmax", "1975°F / 300°F", 61.3, 559], ["K390", "1850°F / 500°F", 62.8, 719], ["LC200N", "1900°F / 300°F", 59.7, 380],
    ["M2", "2100°F / 1000°F", 63.8, 487], ["Niolox", "1975°F / 400°F", 60.4, 429], ["Nitro-V", "1900°F / 400°F", 60.4, 362],
    ["O1", "1475°F / 400°F", 60.9, 283], ["Rex 121", "2050°F / 300°F", 71.4, 1009], ["Rex 86/Z-Max", "2100°F / 300°F", 69.8, 909],
    ["S110V", "2050°F / 400°F", 61.9, 738], ["S125V", "2050°F / 400°F", 62.3, 828], ["S30V", "1950°F / 500°F", 59.8, 568],
    ["S30V", "2000°F / 400°F", 61.9, 596], ["S30V", "2050°F / 300°F", 65.1, 634], ["S35VN", "2000°F / 400°F", 61.2, 520],
    ["S45VN", "2000°F / 400°F", 61.5, 554], ["S60V", "2050°F / 400°F", 61.7, 658], ["S90V", "2050°F / 400°F", 61.6, 779],
    ["SG2", "2000°F / 400°F", 61.2, 522], ["Vanadis 8", "1850°F / 500°F", 60.7, 677], ["Vanax", "1975°F / 300°F", 61, 546],
    ["VG10", "1975°F / 400°F", 61.6, 479], ["V-Toku 2", "1475°F / 400°F", 63.6, 314], ["ZDP-189", "1850°F / 400°F", 65.1, 718]
  ];

  // Toughness (ft-lbs, Larrin's unnotched subsize Charpy test) vs hardness, [HRc, ft-lbs] points.
  // Read by eye from the stainless, high-alloy and low-alloy toughness charts in the same article
  // (about ±0.2 HRc and ±1 ft-lb). Only steels that also have CATRA results are listed.
  var TOUGHNESS = {
    "AEB-L": [[60.0, 37.5], [61.0, 32.7], [62.5, 19.3], [64.1, 11.8]],
    "Nitro-V": [[60.7, 21.6], [62.2, 17.8], [63.6, 8.8]],
    "14C28N": [[60.8, 30.3]],
    "CPM-154": [[60.0, 9.5], [61.6, 8.6], [64.1, 6.1]],
    "Elmax": [[57.6, 11.6], [59.1, 8.0]],
    "Vanax": [[59.6, 11.8], [60.4, 10.0]],
    "S35VN": [[61.2, 9.0]],
    "S30V": [[60.1, 5.7]],
    "SG2": [[60.9, 6.5]],
    "VG10": [[61.0, 5.9]],
    "S45VN": [[61.4, 6.1]],
    "204P": [[61.8, 4.5]],
    "S110V": [[62.6, 4.0]],
    "ZDP-189": [[64.9, 3.8]],
    "Niolox": [[59.8, 7.6]],
    "3V": [[58.9, 39.2], [60.5, 33.5]],
    "A8 mod": [[58.8, 37.7]],
    "Caldie": [[61.4, 35.6]],
    "CPM CruWear": [[61.9, 22.5], [64.1, 13.7]],
    "A2": [[60.3, 14.6], [62.4, 10.1], [64.5, 5.6]],
    "CPM-M4": [[61.2, 14.3]],
    "4V": [[63.0, 14.8]],
    "D2": [[60.2, 5.1]],
    "10V": [[60.8, 8.0]],
    "M2": [[64.0, 6.2]],
    "15V": [[65.3, 4.3]],
    "Rex 121": [[67.0, 2.6], [68.9, 2.3]],
    "Rex 86/Z-Max": [[69.8, 2.9]],
    "CD1": [[60.9, 46.3]],
    "1095": [[57.3, 10.6], [60.1, 8.1], [62.4, 6.5]],
    "O1": [[58.6, 9.8], [59.9, 8.2], [62.3, 5.4]],
    "52100": [[61.1, 28.4], [61.7, 22.8]],
    "8670": [[59.7, 51.0]],
    "26C3": [[61.5, 12.7], [63.7, 6.8], [65.4, 5.7], [66.5, 4.6]],
    "CruForgeV": [[61.5, 19.0], [62.7, 14.4], [64.0, 13.2], [66.5, 6.2]],
    "V-Toku 2": [[63.8, 11.3]],
    "1.2519": [[63.7, 8.2]],
    "1.2442": [[63.8, 7.5]],
    "Blue Super": [[65.3, 2.9]],
    "1.2562": [[65.5, 2.8]]
  };

  // 154CM / CPM-154 TCC at different inclusive angles, read from Larrin's edge-angle-vs-TCC chart.
  var ANGLE_DATA = [[20, 925], [20, 1006], [27, 555], [27, 482], [27, 580], [27, 610], [27, 640], [27, 670], [32, 370], [32, 447], [33, 353], [33, 353],
    [34, 330], [34, 360], [34, 400], [34, 430], [34, 460], [50, 200], [50, 110], [50, 130], [50, 150], [50, 180], [56, 99]];

  var REF = 30;
  // Least-squares fits to ANGLE_DATA. Each scales a steel's 30° value (t30) to angle th.
  var MODELS = {
    exp: { name: "Exponential fit (best, R² 0.95)", short: "Exponential", fn: function (t30, th) { return t30 * Math.exp(-0.0603 * (th - REF)); }, raw: function (th) { return 2980.5 * Math.exp(-0.0603 * th); } },
    pow: { name: "Power-law fit (R² 0.93)", short: "Power", fn: function (t30, th) { return t30 * Math.pow(th / REF, -2.158); }, raw: function (th) { return 708924 * Math.pow(th, -2.158); } },
    log: { name: "Logarithmic fit (R² 0.91)", short: "Log", fn: function (t30, th) { return Math.max(0, t30 * (3193.2 - 786.1 * Math.log(th)) / (3193.2 - 786.1 * Math.log(REF))); }, raw: function (th) { return 3193.2 - 786.1 * Math.log(th); } },
    lin: { name: "Larrin's linear term, −17.8 mm/° (R² 0.83)", short: "Linear", fn: function (t30, th) { return Math.max(0, t30 - 17.8 * (th - REF)); }, raw: function (th) { return 1161.5 - 20.88 * th; } }
  };
  var MODEL_COLORS = { exp: "var(--series-2)", pow: "var(--series-1)", log: "var(--series-7)", lin: "var(--series-3)" };

  // ---------- settings ----------
  var KEY = "edgeLab.angle.v1";
  var cfg = { model: "exp", hcoef: 15.8, steel: null, rc: 64.6, angA: 30, angB: 25, tmin: 5, angleSrc: "data", fixedAngle: 25,
    custom: { rc: 61, CrC: 6, CrVC: 0, MC: 0, M6C: 0, MN: 0, CrN: 0, M3C: 0 }, sortKey: "tA", sortDir: -1 };
  try { var raw = localStorage.getItem(KEY); if (raw) cfg = Object.assign(cfg, JSON.parse(raw)); } catch (e) { /* ignore */ }
  if (cfg.steel == null) cfg.steel = String(CATRA.findIndex(function (s) { return s[0] === "AEB-L" && s[2] === 64.6; }));
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
  function num(v) { if (v === "" || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }

  // ---------- model helpers ----------
  function model() { return MODELS[cfg.model] || MODELS.exp; }
  function hcoef() { return num(cfg.hcoef) != null ? num(cfg.hcoef) : 15.8; }
  function customT30() {
    var c = cfg.custom, g = function (k) { return num(c[k]) || 0; };
    return -157 + 15.8 * g("rc") - 17.8 * REF + 11.2 * g("CrC") + 14.6 * g("CrVC") + 26.2 * g("MC") + 9.5 * g("M6C") + 20.9 * g("MN") + 19.4 * g("CrN") + 5 * g("M3C");
  }
  // TCC at 30° for a named steel at hardness h: interpolate between its tested heat treats, else shift the nearest by the hardness coefficient.
  function tccAtHardness(name, h) {
    var rows = CATRA.filter(function (s) { return s[0] === name; }).sort(function (a, b) { return a[2] - b[2]; });
    if (!rows.length) return null;
    for (var i = 0; i < rows.length - 1; i++) {
      if (h >= rows[i][2] && h <= rows[i + 1][2]) { var f = (h - rows[i][2]) / (rows[i + 1][2] - rows[i][2]); return rows[i][3] + f * (rows[i + 1][3] - rows[i][3]); }
    }
    var near = rows.reduce(function (b, r) { return Math.abs(r[2] - h) < Math.abs(b[2] - h) ? r : b; });
    return near[3] + hcoef() * (h - near[2]);
  }
  // Hardest a steel can be while keeping toughness >= T, from its toughness-hardness points.
  function maxHardnessAt(name, T) {
    var pts = (TOUGHNESS[name] || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    if (!pts.length) return { status: "nodata" };
    var hi = pts[pts.length - 1], lo = pts[0];
    if (T <= hi[1]) return { status: "atleast", hrc: hi[0], note: "≥" };           // tougher than required even at the hardest tested point
    if (T > lo[1]) return { status: "fails", hrc: lo[0] };                            // below the requirement even at the softest tested point
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (T <= a[1] && T >= b[1]) { var f = (a[1] - T) / (a[1] - b[1]); return { status: "ok", hrc: a[0] + f * (b[0] - a[0]) }; }
    }
    return { status: "nodata" };
  }
  function solveAngle(m, t30, target) {
    var lo = 5, hi = 80, f = function (th) { return m.fn(t30, th) - target; };
    if (f(lo) < 0 || f(hi) > 0) return NaN;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  // ---------- supported angle from your own test results ----------
  // Rule: more toughness never makes an edge less stable. So at toughness T,
  //  - any group with toughness <= T that passed at angle a means T supports a (best known = smallest such a);
  //  - any group with toughness >= T that failed at angle a means T fails at a too (lower bound).
  function angleFromData(groups, T) {
    var safe = null, safeFrom = null, failAbove = null, failFrom = null, pts = [];
    groups.forEach(function (g) {
      if (g.charpy == null) return;
      if (g.minAngle != null) pts.push({ x: g.charpy, y: g.minAngle });
      if (g.minAngle != null && g.charpy <= T && (safe == null || g.minAngle < safe)) { safe = g.minAngle; safeFrom = g; }
      if (g.charpy >= T) g.failed.forEach(function (a) { if (failAbove == null || a > failAbove) { failAbove = a; failFrom = g; } });
    });
    return { safe: safe, safeFrom: safeFrom, failAbove: failAbove, failFrom: failFrom, pts: pts };
  }
  function linearFit(pts) {
    var xs = Array.from(new Set(pts.map(function (p) { return p.x; })));
    if (xs.length < 2) return null;
    var n = pts.length, mx = pts.reduce(function (s, p) { return s + p.x; }, 0) / n, my = pts.reduce(function (s, p) { return s + p.y; }, 0) / n;
    var sxy = 0, sxx = 0; pts.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); });
    var b = sxy / sxx; return { a: my - b * mx, b: b };
  }

  // ---------- rendering ----------
  var ctx = { groups: [], useCase: "" };
  function render(groups, useCase) {
    if (groups) { ctx.groups = groups; ctx.useCase = useCase || ""; }
    syncInputs();
    renderDesign();
    renderCalc();
    renderFit();
  }

  function syncInputs() {
    var sel = $("#ang-steel");
    if (!sel.options.length) {
      sel.innerHTML = CATRA.map(function (s, i) { return '<option value="' + i + '">' + esc(s[0] + " (" + s[1] + ", " + s[2] + " HRc, " + s[3] + " mm)") + "</option>"; }).join("") + '<option value="custom">Custom: enter carbide volumes</option>';
      $("#ang-model").innerHTML = Object.keys(MODELS).map(function (k) { return '<option value="' + k + '">' + esc(MODELS[k].name) + "</option>"; }).join("");
    }
    sel.value = cfg.steel;
    $("#ang-model").value = cfg.model; $("#ang-hcoef").value = cfg.hcoef;
    $("#ang-rc").value = cfg.rc; $("#ang-a").value = cfg.angA; $("#ang-b").value = cfg.angB;
    $("#ang-tmin").value = cfg.tmin; $("#ang-src").value = cfg.angleSrc; $("#ang-fixed").value = cfg.fixedAngle;
    Object.keys(cfg.custom).forEach(function (k) { var e = $("#ang-c-" + k); if (e) e.value = cfg.custom[k]; });
    $("#ang-custom").hidden = cfg.steel !== "custom";
  }

  // ---- design from a toughness requirement ----
  function renderDesign() {
    var T = num(cfg.tmin), m = model();
    if (T == null) { $("#ang-design-table").innerHTML = ""; $("#ang-design-summary").textContent = "Enter a minimum toughness."; return; }
    var d = angleFromData(ctx.groups, T), fit = linearFit(d.pts);
    var angle = null, angleNote = "", src = cfg.angleSrc, fixed = num(cfg.fixedAngle);
    var uc = ctx.useCase ? ' for the "' + esc(ctx.useCase) + '" use case' : "";
    var summary = "";
    if (src === "data") {
      if (d.safe != null) {
        angle = d.safe; angleNote = "≤";
        summary = "<b>Supported angle at " + fmt(T) + " ft-lbs: " + fmt(d.safe) + "° or more acute.</b> " + esc(d.safeFrom.label) + " (" + fmt(d.safeFrom.charpy) + " ft-lbs) held " + fmt(d.safe) + "°" + (d.safeFrom.provisional ? " (provisional, plateau not yet inspected)" : "") + ", and anything at least that tough should too. Nothing below it has been tested, so the true limit may be lower.";
      } else {
        angle = fixed; angleNote = "assumed";
        summary = "<b>No result yet at or below " + fmt(T) + " ft-lbs" + uc + ", so the supported angle is unknown.</b> The table uses your fallback angle of " + fmt(fixed) + "°.";
        var tougher = ctx.groups.filter(function (g) { return g.charpy != null && g.minAngle != null && g.charpy > T; });
        if (tougher.length) summary += " Tougher results: " + tougher.map(function (g) { return esc(g.label) + " (" + fmt(g.charpy) + " ft-lbs) held " + fmt(g.minAngle) + "°" + (g.provisional ? " (provisional)" : ""); }).join("; ") + ". Those only bound steels at least that tough.";
      }
      if (d.failAbove != null) summary += " A tougher steel failed at " + fmt(d.failAbove) + "° (" + esc(d.failFrom.label) + "), so " + fmt(T) + " ft-lbs needs more than " + fmt(d.failAbove) + "°.";
    } else if (src === "fit") {
      if (fit) {
        angle = fit.a + fit.b * T; angleNote = "fit";
        summary = "<b>Linear fit of your results: angle = " + fmt(fit.a) + " " + (fit.b < 0 ? "−" : "+") + " " + fmt(Math.abs(fit.b)) + " × toughness, giving " + fmt(angle) + "° at " + fmt(T) + " ft-lbs.</b> Check the fit before relying on it outside the toughness range you've tested.";
      } else {
        angle = fixed; angleNote = "assumed";
        summary = "<b>A fit needs results at two or more toughness levels; you have " + Array.from(new Set(d.pts.map(function (p) { return p.x; }))).length + ".</b> The table uses your fallback angle of " + fmt(fixed) + "°.";
      }
    } else {
      angle = fixed; angleNote = "assumed";
      summary = "<b>Using a fixed " + fmt(fixed) + "° for every steel.</b>";
    }
    $("#ang-design-summary").innerHTML = summary;

    var names = Object.keys(TOUGHNESS);
    var rows = names.map(function (n) {
      var mh = maxHardnessAt(n, T), r = { name: n, mh: mh };
      if (mh.status === "ok" || mh.status === "atleast") {
        r.hrc = mh.hrc; r.t30 = tccAtHardness(n, mh.hrc);
        r.tAng = angle != null ? m.fn(r.t30, angle) : null;
      }
      return r;
    });
    var ok = rows.filter(function (r) { return r.t30 != null; }).sort(function (a, b) { return (b.tAng != null ? b.tAng : b.t30) - (a.tAng != null ? a.tAng : a.t30); });
    var bad = rows.filter(function (r) { return r.t30 == null; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var best = ok.length ? (ok[0].tAng != null ? ok[0].tAng : ok[0].t30) : null;
    var angleCell = angle == null ? "–" : (angleNote === "≤" ? "≤ " : "") + fmt(+angle.toFixed(1)) + "°" + (angleNote === "assumed" ? ' <span class="muted">assumed</span>' : angleNote === "fit" ? ' <span class="muted">fit</span>' : "");
    var html = '<thead><tr><th>Steel</th><th class="num">Max HRc at ' + fmt(T) + ' ft-lbs</th><th class="num">TCC at 30° (mm)</th><th class="num">Supported angle</th><th class="num">TCC at that angle (mm)</th><th class="num">vs best</th></tr></thead><tbody>';
    html += ok.map(function (r) {
      var v = r.tAng != null ? r.tAng : r.t30;
      var hcell = (r.mh.status === "atleast" ? '<span title="Tougher than required even at the hardest tested point; could likely go harder">≥ </span>' : "") + fmt(+r.hrc.toFixed(1));
      return "<tr><td>" + esc(r.name) + '</td><td class="num">' + hcell + '</td><td class="num">' + fmt(r.t30) + '</td><td class="num">' + angleCell + '</td><td class="num"><b>' + (r.tAng != null ? (angleNote === "≤" ? "≥ " : "") + fmt(r.tAng) : "–") + '</b></td><td class="num">' + Math.round(v / best * 100) + "%</td></tr>";
    }).join("");
    if (bad.length) html += '<tr><td colspan="6" class="muted small">Can\'t reach ' + fmt(T) + " ft-lbs at any tested hardness: " + bad.filter(function (r) { return r.mh.status === "fails"; }).map(function (r) { return esc(r.name); }).join(", ") + ". Softer heat treats might, but they weren't tested.</td></tr>";
    $("#ang-design-table").innerHTML = html + "</tbody>";
    $("#ang-src-fixed-wrap").querySelector("span").textContent = src === "fixed" ? "Angle (°)" : "Fallback angle (°)";
  }

  // ---- single steel calculator ----
  function base() {
    if (cfg.steel === "custom") return { name: "Custom", rc0: num(cfg.custom.rc) || 61, t30: customT30() };
    var s = CATRA[+cfg.steel] || CATRA[0]; return { name: s[0], rc0: s[2], t30: s[3] };
  }
  function renderCalc() {
    var b = base(), m = model(), rc = num(cfg.rc) != null ? num(cfg.rc) : b.rc0;
    var A = num(cfg.angA) || 30, B = num(cfg.angB) || 25;
    var t30 = b.t30 + hcoef() * (rc - b.rc0), tA = m.fn(t30, A), tB = m.fn(t30, B);
    var pct = (tB / tA - 1) * 100, slope = m.fn(t30, A - 0.5) - m.fn(t30, A + 0.5);
    $("#ang-stats").innerHTML =
      stat("TCC at angle A", fmt(tA) + " mm", fmt(A) + "° inclusive") +
      stat("TCC at angle B", fmt(tB) + " mm", fmt(B) + "° inclusive") +
      stat("Change from A to B", '<span style="color:' + (pct >= 0 ? "var(--good)" : "var(--critical)") + '">' + (pct >= 0 ? "+" : "") + Math.round(pct) + "%</span>", (tB - tA >= 0 ? "+" : "") + fmt(tB - tA) + " mm") +
      stat("1° at angle A is worth", fmt(+slope.toFixed(1)) + " mm", "about " + fmt(+(slope / hcoef()).toFixed(1)) + " HRc, or " + fmt(+(slope / tA * 100).toFixed(1)) + "% of TCC");
    var warn = [];
    if (Math.min(A, B) < 20) warn.push("Angles below 20° are outside the fitted data, so the result is an extrapolation.");
    if (Math.max(A, B) > 56) warn.push("Angles above 56° are outside the fitted data.");
    if (Math.abs(rc - b.rc0) > 3) warn.push("Your hardness is " + fmt(+Math.abs(rc - b.rc0).toFixed(1)) + " HRc from the tested " + b.rc0 + ", so the hardness adjustment is a rough linear estimate.");
    $("#ang-warn").innerHTML = warn.join("<br>"); $("#ang-warn").hidden = !warn.length;

    // Chart: selected model solid, others dashed.
    var ymax = Math.min(Math.max(m.fn(t30, 18), t30 * 1.3), t30 * 3);
    var lines = [];
    Object.keys(MODELS).forEach(function (k) {
      var pts = []; for (var th = 18; th <= 60; th += 0.5) pts.push({ x: th, y: Math.min(MODELS[k].fn(t30, th), ymax) });
      lines.push({ points: pts, color: k === cfg.model ? MODEL_COLORS[k] : "var(--text-muted)", dash: k === cfg.model ? null : "5 4" });
    });
    lines.push(lines.splice(Object.keys(MODELS).indexOf(cfg.model), 1)[0]); // draw selected last
    Charts.scatterChart($("#ang-chart"), {
      points: [{ x: A, y: tA, color: MODEL_COLORS[cfg.model], label: "A", tip: "<b>A: " + fmt(A) + "°</b><br>" + fmt(tA) + " mm" }, { x: B, y: tB, color: MODEL_COLORS[cfg.model], label: "B", tip: "<b>B: " + fmt(B) + "°</b><br>" + fmt(tB) + " mm" }],
      lines: lines, xExtent: [18, 60], yExtent: [0, ymax], yZero: true, xLabel: "Inclusive edge angle (°)", yLabel: "Predicted TCC (mm)", height: 320, ariaLabel: "Predicted TCC against edge angle"
    });

    // All steels at angle A, with the angle each needs to match the selection.
    var rows = CATRA.map(function (s, i) { return { i: i, name: s[0], ht: s[1], rc: s[2], t30: s[3], tA: m.fn(s[3], A), eq: solveAngle(m, s[3], tA) }; });
    var k = cfg.sortKey, dir = cfg.sortDir;
    rows.sort(function (a, b) { var x = a[k], y = b[k]; return (typeof x === "string" ? x.localeCompare(y) : ((isFinite(x) ? x : -1e9) - (isFinite(y) ? y : -1e9))) * dir; });
    var h = [["name", "Steel", ""], ["ht", "Heat treat", ""], ["rc", "HRc", "num"], ["t30", "TCC at 30° (measured)", "num"], ["tA", "TCC at " + fmt(A) + "°", "num"], ["eq", "Angle to match selection", "num"]];
    $("#ang-table").innerHTML = "<thead><tr>" + h.map(function (c) { return '<th class="' + c[2] + ' sortable" data-k="' + c[0] + '">' + c[1] + (k === c[0] ? (dir < 0 ? " ▼" : " ▲") : "") + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { var sel = String(r.i) === cfg.steel; return "<tr" + (sel ? ' class="sel"' : "") + "><td>" + esc(r.name) + "</td><td>" + esc(r.ht) + '</td><td class="num">' + r.rc + '</td><td class="num">' + r.t30 + '</td><td class="num">' + fmt(r.tA) + '</td><td class="num">' + (isFinite(r.eq) ? fmt(+r.eq.toFixed(1)) + "°" : "out of range") + "</td></tr>"; }).join("") + "</tbody>";
    Array.prototype.forEach.call($("#ang-table").querySelectorAll("th"), function (th) {
      th.onclick = function () { var key = th.dataset.k; cfg.sortDir = cfg.sortKey === key ? -cfg.sortDir : (key === "name" || key === "ht" ? 1 : -1); cfg.sortKey = key; saveCfg(); renderCalc(); };
    });
  }
  function stat(k, v, s) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + s + "</div></div>"; }

  function renderFit() {
    var lines = Object.keys(MODELS).map(function (k) { var pts = []; for (var th = 18; th <= 60; th += 0.5) pts.push({ x: th, y: Math.max(0, Math.min(MODELS[k].raw(th), 1200)) }); return { points: pts, color: MODEL_COLORS[k] }; });
    Charts.scatterChart($("#ang-fit"), {
      points: ANGLE_DATA.map(function (p) { return { x: p[0], y: p[1], color: "var(--text-secondary)", r: 4, tip: fmt(p[0]) + "°: " + fmt(p[1]) + " mm" }; }),
      lines: lines, xExtent: [18, 60], yExtent: [0, 1100], yZero: true, xLabel: "Inclusive edge angle (°)", yLabel: "TCC (mm)", height: 300, ariaLabel: "154CM edge angle data with fitted curves"
    });
    $("#ang-fit-legend").innerHTML = Object.keys(MODELS).map(function (k) { return '<span><span class="swatch" style="background:' + MODEL_COLORS[k] + '"></span>' + esc(MODELS[k].name) + "</span>"; }).join("");
  }

  // ---------- events ----------
  function bind(id, key, isNum) {
    $(id).addEventListener("input", function () { cfg[key] = isNum ? this.value : this.value; saveCfg(); render(); });
  }
  function init() {
    syncInputs();
    $("#ang-steel").addEventListener("change", function () {
      cfg.steel = this.value; cfg.rc = this.value === "custom" ? cfg.custom.rc : CATRA[+this.value][2]; saveCfg(); render();
    });
    bind("#ang-model", "model"); bind("#ang-hcoef", "hcoef", true); bind("#ang-rc", "rc", true);
    bind("#ang-a", "angA", true); bind("#ang-b", "angB", true);
    bind("#ang-tmin", "tmin", true); bind("#ang-src", "angleSrc"); bind("#ang-fixed", "fixedAngle", true);
    Object.keys(cfg.custom).forEach(function (k) {
      var e = $("#ang-c-" + k); if (!e) return;
      e.addEventListener("input", function () { cfg.custom[k] = this.value; if (k === "rc") cfg.rc = this.value; saveCfg(); render(); });
    });
  }

  window.EdgeAngle = { init: init, render: render, TOUGHNESS: TOUGHNESS, CATRA: CATRA };
})();
