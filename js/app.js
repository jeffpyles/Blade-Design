/* Edge Stability Lab: state, storage and UI. Plain JS, no build step. */
(function () {
  "use strict";
  var KEY = "edgeLab.v1", UIKEY = "edgeLab.ui.v1";
  var STD_ANGLES = [15, 17.5, 20, 22.5, 25, 27.5, 30];
  var DASHES = [null, "7 4", "2 3", "10 3 2 3", "4 4"];
  var OUTCOMES = {
    "in-progress": { label: "In progress", color: "var(--untested)", ink: "var(--text-primary)", pass: false, fail: false, rank: 0 },
    "plateau-uninspected": { label: "Plateau, not inspected", color: "var(--warning)", ink: "#0b0b0b", pass: true, provisional: true, rank: 1 },
    "stable": { label: "Stable, no chips", color: "var(--good)", ink: "#ffffff", pass: true, rank: 2 },
    "rolled": { label: "Rolled", color: "var(--serious)", ink: "#0b0b0b", fail: true, rank: 3 },
    "chipped": { label: "Chipped", color: "var(--critical)", ink: "#ffffff", fail: true, rank: 4 }
  };
  var FAILURE_MODES = ["", "none visible", "rolling", "chipping", "wear", "mixed"];
  var esc = Charts.esc, fmt = Charts.fmt;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- state ----------
  var state = load();
  var ui = loadUI();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* fall through */ }
    return normalize(clone(window.BLADE_SEED));
  }
  function normalize(s) {
    s.irons = s.irons || []; s.runs = s.runs || []; s.steels = s.steels || []; s.references = s.references || [];
    s.notes = s.notes || "";
    return s;
  }
  function loadUI() {
    var d = { tab: "charts", selected: null, editing: null, x: "strokes", y: "grams", range: true, ref: true, usecase: "", tmin: "" };
    try { var raw = localStorage.getItem(UIKEY); if (raw) return Object.assign(d, JSON.parse(raw)); } catch (e) { /* ignore */ }
    return d;
  }
  function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) { /* ignore */ } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { alert("Could not save: browser storage is full or blocked. Export your data as JSON, and consider removing some photos."); return false; }
  }
  function uid(p) { return p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v) { if (v === "" || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }

  // ---------- derived ----------
  function ironOf(run) { return state.irons.find(function (i) { return i.id === run.ironId; }) || { name: "Unknown iron", steel: "?", hrc: null, charpy: null }; }
  function edgeAngle(run) { return run.microbevelAngle != null ? run.microbevelAngle : run.bevelAngle; }
  function runLabel(run) { return run.label || (ironOf(run).name + " @ " + fmt(edgeAngle(run)) + "°"); }
  function readings(cp) { return (cp.readings || []).filter(function (v) { return v != null && v !== ""; }).map(Number); }
  function mean(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function cpMean(cp) { return mean(readings(cp)); }
  function cpFeet(run, cp) { if (cp.feet != null) return cp.feet; if (run.strokeLengthIn) return cp.strokes * run.strokeLengthIn / 12; return null; }
  function sortedCps(run) { return run.checkpoints.slice().sort(function (a, b) { return a.strokes - b.strokes; }); }
  function stats(run) {
    var cps = sortedCps(run).filter(function (c) { return cpMean(c) != null; });
    if (!cps.length) return null;
    var start = cpMean(cps[0]);
    var plateauCps = cps.length >= 4 ? cps.slice(2) : cps.slice(1);
    var plateau = plateauCps.length ? median(plateauCps.map(cpMean)) : null;
    var cvs = cps.map(function (c) { var r = readings(c), m = mean(r); if (r.length < 2) return null; var sd = Math.sqrt(r.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (r.length - 1)); return sd / m; }).filter(function (v) { return v != null; });
    var last = cps[cps.length - 1];
    return { start: start, plateau: plateau, change: plateau != null ? (plateau / start - 1) : null, noise: mean(cvs), strokes: last.strokes, feet: cpFeet(run, last), n: cps.length };
  }
  function pctStr(c) { return c == null ? "–" : (c >= 0 ? "+" : "") + Math.round(c * 100) + "%"; }
  function ironColor(ironId) { var i = state.irons.findIndex(function (x) { return x.id === ironId; }); return "var(--series-" + ((Math.max(0, i) % 8) + 1) + ")"; }
  function refMean(ref) { return mean((ref.readings || []).map(Number).filter(isFinite)); }
  function outcomeBadge(key) {
    var o = OUTCOMES[key] || OUTCOMES["in-progress"];
    return '<span class="status"><span class="sdot" style="background:' + o.color + '"></span>' + o.label + "</span>";
  }

  // ---------- tabs ----------
  function setTab(t) {
    ui.tab = t; saveUI(); document.getElementById("tooltip").hidden = true;
    $$(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"); });
    $$(".tab-panel").forEach(function (p) { p.hidden = p.id !== "tab-" + t; });
    render();
  }
  $$(".tabs button").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });

  function render() {
    if (ui.tab === "charts") renderCharts();
    else if (ui.tab === "runs") renderRuns();
    else if (ui.tab === "irons") renderIrons();
    else if (ui.tab === "findings") renderFindings();
    else if (ui.tab === "data") renderData();
    else if (ui.tab === "angle") EdgeAngle.render(groups(ui.usecase), ui.usecase);
  }
  EdgeAngle.init();
  window.addEventListener("resize", debounce(function () { if (ui.tab === "charts" || ui.tab === "findings" || ui.tab === "angle") render(); }, 150));
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // ---------- charts tab ----------
  ["x", "y"].forEach(function (k) { var s = $("#ctl-" + k); s.addEventListener("change", function () { ui[k] = s.value; saveUI(); renderCharts(); }); });
  ["range", "ref"].forEach(function (k) { var c = $("#ctl-" + k); c.addEventListener("change", function () { ui[k] = c.checked; saveUI(); renderCharts(); }); });

  function selectedRuns() {
    if (!ui.selected) ui.selected = state.runs.map(function (r) { return r.id; });
    return state.runs.filter(function (r) { return ui.selected.indexOf(r.id) >= 0; });
  }

  function renderCharts() {
    $("#ctl-x").value = ui.x; $("#ctl-y").value = ui.y; $("#ctl-range").checked = ui.range; $("#ctl-ref").checked = ui.ref;
    var sel = selectedRuns();
    var angles = Array.from(new Set(state.runs.map(edgeAngle))).sort(function (a, b) { return a - b; });
    var dashOf = function (run) { return DASHES[angles.indexOf(edgeAngle(run)) % DASHES.length]; };

    var picker = $("#run-picker");
    picker.innerHTML = state.runs.map(function (r) {
      return '<label class="chip"><input type="checkbox" value="' + r.id + '"' + (ui.selected.indexOf(r.id) >= 0 ? " checked" : "") + '><span class="swatch" style="background:' + ironColor(r.ironId) + '"></span>' + esc(runLabel(r)) + "</label>";
    }).join("") || '<span class="muted">No runs yet. Add one on the Runs tab.</span>';
    $$("input", picker).forEach(function (c) {
      c.addEventListener("change", function () {
        ui.selected = $$("input:checked", picker).map(function (x) { return x.value; }); saveUI(); renderCharts();
      });
    });

    var pct = ui.y === "pct", skipped = [];
    var series = [];
    sel.forEach(function (run) {
      var cps = sortedCps(run).filter(function (c) { return cpMean(c) != null; });
      if (!cps.length) return;
      var base = cpMean(cps[0]);
      var pts = [];
      cps.forEach(function (c) {
        var x = ui.x === "feet" ? cpFeet(run, c) : c.strokes;
        if (x == null) return;
        var r = readings(c), m = mean(r);
        var tf = function (v) { return pct ? (v / base - 1) * 100 : v; };
        pts.push({ x: x, y: tf(m), lo: r.length > 1 ? tf(Math.min.apply(null, r)) : null, hi: r.length > 1 ? tf(Math.max.apply(null, r)) : null, tip: "(" + r.join(", ") + " g" + (c.failureMode ? "; " + c.failureMode : "") + ")" });
      });
      if (!pts.length) { skipped.push(runLabel(run)); return; }
      series.push({ name: runLabel(run), color: ironColor(run.ironId), dash: dashOf(run), points: pts });
    });
    var refs = ui.ref && !pct ? state.references.map(function (r) { return { name: r.name, y: refMean(r) }; }).filter(function (r) { return r.y != null; }) : [];
    Charts.lineChart($("#chart-sharpness"), {
      series: series, refs: refs, showRange: ui.range,
      xLabel: ui.x === "feet" ? "Linear feet planed" : "Cumulative strokes",
      yLabel: pct ? "Change from start (%)" : "Force to cut monofilament (g)", yUnit: pct ? "%" : " g",
      emptyText: ui.x === "feet" ? "No selected run has distance data. Set stroke length or feet on the run." : "Select runs with readings",
      ariaLabel: "Sharpness versus load for selected runs"
    });
    var note = [];
    if (skipped.length) note.push("Not shown (no distance data): " + skipped.join(", ") + ".");
    if (angles.length > 1) note.push("Line color is the iron; dash pattern is the edge angle (" + angles.map(function (a, i) { return fmt(a) + "° " + ["solid", "dashed", "dotted", "dash-dot", "short dash"][i % 5]; }).join(", ") + ").");
    $("#chart-note").textContent = note.join(" ");

    var rows = state.runs.map(function (r) {
      var s = stats(r), iron = ironOf(r);
      return "<tr><td><span class=\"swatch\" style=\"background:" + ironColor(r.ironId) + '"></span> ' + esc(runLabel(r)) + "</td><td>" + esc(iron.steel) + '</td><td class="num">' + (iron.hrc != null ? fmt(iron.hrc) : "–") + '</td><td class="num">' + (iron.charpy != null ? fmt(iron.charpy) : "–") +
        '</td><td class="num">' + fmt(edgeAngle(r)) + "°</td>" +
        (s ? '<td class="num">' + fmt(s.start) + '</td><td class="num">' + fmt(s.plateau) + '</td><td class="num">' + pctStr(s.change) + '</td><td class="num">' + (s.noise != null ? "±" + Math.round(s.noise * 100) + "%" : "–") + '</td><td class="num">' + s.strokes + (s.feet != null ? " / " + fmt(s.feet) + " ft" : "") + "</td>" : '<td colspan="5" class="muted">No readings</td>') +
        "<td>" + outcomeBadge(r.outcome) + "</td></tr>";
    }).join("");
    $("#summary-table").innerHTML = '<thead><tr><th>Run</th><th>Steel</th><th class="num">HRc</th><th class="num">Charpy</th><th class="num">Edge</th><th class="num">Start g</th><th class="num">Plateau g</th><th class="num">Change</th><th class="num">Noise</th><th class="num">Load</th><th>Outcome</th></tr></thead><tbody>' + rows + "</tbody>";
  }

  // ---------- runs tab ----------
  $("#btn-new-run").addEventListener("click", function () {
    var prev = state.runs.find(function (r) { return r.id === ui.editing; });
    var run = {
      id: uid("run"), ironId: prev ? prev.ironId : (state.irons[0] ? state.irons[0].id : ""), label: "", date: new Date().toISOString().slice(0, 10),
      bedAngle: prev ? prev.bedAngle : 45, bevelAngle: prev ? prev.bevelAngle : 25, microbevelAngle: null,
      wood: prev ? prev.wood : "", useCase: prev ? prev.useCase : "", shavingIn: prev ? prev.shavingIn : 0.006, strokeLengthIn: prev ? prev.strokeLengthIn : null,
      media: prev ? prev.media : "Monofilament", outcome: "in-progress", notes: "",
      checkpoints: [blankCp(0)]
    };
    state.runs.push(run); if (ui.selected) ui.selected.push(run.id);
    ui.editing = run.id; save(); saveUI(); renderRuns();
  });
  function blankCp(strokes) { return { strokes: strokes, feet: null, readings: [null, null, null], media: "", failureMode: "", chipCount: null, chipMaxUm: null, microscopeNotes: "", photos: [] }; }

  function renderRuns() {
    if (!state.runs.find(function (r) { return r.id === ui.editing; })) ui.editing = state.runs[0] ? state.runs[0].id : null;
    renderRunList();
    renderEditor();
  }
  function renderRunList() {
    $("#run-list").innerHTML = state.runs.map(function (r) {
      var s = stats(r);
      return '<li><button data-id="' + r.id + '" class="' + (r.id === ui.editing ? "active" : "") + '"><span class="swatch dot" style="background:' + ironColor(r.ironId) + '"></span><span>' + esc(runLabel(r)) +
        '<span class="meta">' + (r.date ? esc(r.date) + " · " : "") + (s ? s.n + " checkpoints · " + s.strokes + " strokes" : "no readings") + "</span></span></button></li>";
    }).join("") || '<li class="muted">No runs yet.</li>';
    $$("#run-list button").forEach(function (b) { b.addEventListener("click", function () { ui.editing = b.dataset.id; saveUI(); renderRuns(); }); });
  }

  function field(label, key, val, type, extra) {
    extra = extra || "";
    if (type === "select") return "<label" + extra + ">" + label + '<select data-f="' + key + '">' + val + "</select></label>";
    if (type === "textarea") return '<label class="wide">' + label + '<textarea data-f="' + key + '" rows="3">' + esc(val) + "</textarea></label>";
    return "<label" + extra + ">" + label + '<input data-f="' + key + '" type="' + (type || "text") + '"' + (type === "number" ? ' step="any"' : "") + ' value="' + esc(val == null ? "" : val) + '"></label>';
  }

  function renderEditor() {
    var box = $("#run-editor");
    var run = state.runs.find(function (r) { return r.id === ui.editing; });
    if (!run) { box.innerHTML = '<p class="muted">Create a run to start logging.</p>'; return; }
    var ironOpts = state.irons.map(function (i) { return '<option value="' + i.id + '"' + (i.id === run.ironId ? " selected" : "") + ">" + esc(i.name) + "</option>"; }).join("");
    var outOpts = Object.keys(OUTCOMES).map(function (k) { return '<option value="' + k + '"' + (k === run.outcome ? " selected" : "") + ">" + OUTCOMES[k].label + "</option>"; }).join("");
    box.innerHTML =
      '<div class="row-between"><h2>' + esc(runLabel(run)) + '</h2><div class="btn-row"><button id="btn-dup">Duplicate settings</button><button id="btn-del-run" class="danger">Delete run</button></div></div>' +
      '<div class="form-grid">' +
      field("Iron", "ironId", ironOpts, "select") +
      field("Label (optional)", "label", run.label) +
      field("Date", "date", run.date, "date") +
      field("Bed angle (°)", "bedAngle", run.bedAngle, "number") +
      field("Bevel angle (°)", "bevelAngle", run.bevelAngle, "number") +
      field("Microbevel angle (°)", "microbevelAngle", run.microbevelAngle, "number") +
      field("Wood", "wood", run.wood) +
      field("Use case", "useCase", run.useCase) +
      field("Shaving thickness (in)", "shavingIn", run.shavingIn, "number") +
      field("Stroke length (in)", "strokeLengthIn", run.strokeLengthIn, "number") +
      field("Sharpness media", "media", run.media) +
      field("Outcome", "outcome", outOpts, "select") +
      field("Run notes", "notes", run.notes, "textarea") +
      "</div>" +
      '<p class="muted small">Edge angle used for the threshold map is the microbevel if set, else the bevel. Feet planed is computed from stroke length unless you enter it per checkpoint.</p>' +
      '<h3>Checkpoints</h3><div class="table-wrap"><table class="data cp-table"><thead><tr><th>Strokes</th><th>Feet</th><th>Spot 1 g</th><th>Spot 2 g</th><th>Spot 3 g</th><th class="num">Mean</th><th>Edge</th><th></th></tr></thead><tbody id="cp-body"></tbody></table></div>' +
      '<div class="btn-row"><button id="btn-add-cp" class="primary">Add checkpoint</button></div>';

    $$("[data-f]", box).forEach(function (inp) {
      inp.addEventListener("change", function () {
        var k = inp.dataset.f, numeric = ["bedAngle", "bevelAngle", "microbevelAngle", "shavingIn", "strokeLengthIn"].indexOf(k) >= 0;
        run[k] = numeric ? num(inp.value) : inp.value;
        save(); renderRunList(); $("h2", box).textContent = runLabel(run);
        if (k === "strokeLengthIn") renderCps(run);
      });
    });
    $("#btn-del-run").addEventListener("click", function () {
      if (!confirm("Delete \"" + runLabel(run) + "\" and all its readings?")) return;
      state.runs = state.runs.filter(function (r) { return r !== run; }); ui.editing = null; save(); saveUI(); renderRuns();
    });
    $("#btn-dup").addEventListener("click", function () {
      var c = clone(run); c.id = uid("run"); c.label = ""; c.outcome = "in-progress"; c.notes = ""; c.date = new Date().toISOString().slice(0, 10); c.checkpoints = [blankCp(0)];
      state.runs.push(c); if (ui.selected) ui.selected.push(c.id); ui.editing = c.id; save(); saveUI(); renderRuns();
    });
    $("#btn-add-cp").addEventListener("click", function () {
      var cps = sortedCps(run), last = cps[cps.length - 1], prev = cps[cps.length - 2];
      var step = last && prev ? last.strokes - prev.strokes : 20;
      run.checkpoints.push(blankCp(last ? last.strokes + step : 0)); save(); renderCps(run); renderRunList();
    });
    renderCps(run);
  }

  function renderCps(run) {
    var body = $("#cp-body"), open = renderCps.open || (renderCps.open = {});
    run.checkpoints.sort(function (a, b) { return a.strokes - b.strokes; });
    body.innerHTML = run.checkpoints.map(function (c, i) {
      var key = run.id + ":" + i, m = cpMean(c), feetAuto = c.feet == null && run.strokeLengthIn ? cpFeet(run, c) : null;
      var modeOpts = FAILURE_MODES.map(function (fm) { return '<option value="' + fm + '"' + (fm === c.failureMode ? " selected" : "") + ">" + (fm || "–") + "</option>"; }).join("");
      return '<tr data-i="' + i + '">' +
        '<td><input type="number" step="any" data-c="strokes" value="' + c.strokes + '"></td>' +
        '<td><input type="number" step="any" data-c="feet" value="' + (c.feet != null ? c.feet : "") + '" placeholder="' + (feetAuto != null ? fmt(feetAuto) : "") + '"></td>' +
        [0, 1, 2].map(function (j) { return '<td><input type="number" step="any" data-r="' + j + '" value="' + (c.readings[j] != null ? c.readings[j] : "") + '"></td>'; }).join("") +
        '<td class="num">' + (m != null ? fmt(m) : "–") + "</td>" +
        "<td>" + esc(c.failureMode || "") + (c.photos.length ? " 📷" + c.photos.length : "") + "</td>" +
        '<td><button class="link" data-toggle>' + (open[key] ? "Hide" : "Details") + '</button><button class="link" data-del title="Delete checkpoint">✕</button></td></tr>' +
        '<tr class="cp-extra" data-i="' + i + '"' + (open[key] ? "" : " hidden") + '><td colspan="8"><div class="cp-extra-grid">' +
        '<label>Media (if not run default)<input data-c="media" value="' + esc(c.media) + '" placeholder="' + esc(run.media) + '"></label>' +
        '<label>Failure mode<select data-c="failureMode">' + modeOpts + "</select></label>" +
        '<label>Chip count<input type="number" step="1" data-c="chipCount" value="' + (c.chipCount != null ? c.chipCount : "") + '"></label>' +
        '<label>Largest chip (µm)<input type="number" step="any" data-c="chipMaxUm" value="' + (c.chipMaxUm != null ? c.chipMaxUm : "") + '"></label>' +
        '<label class="wide">Microscope notes<textarea data-c="microscopeNotes" rows="2">' + esc(c.microscopeNotes) + "</textarea></label>" +
        '<div class="wide"><div class="photos">' + c.photos.map(function (p, k) { return '<figure><img src="' + p + '" data-k="' + k + '" alt="Edge photo ' + (k + 1) + '"><button data-delphoto="' + k + '">✕</button></figure>'; }).join("") +
        '</div><label class="btn" style="margin-top:6px">Add photos<input type="file" accept="image/*" multiple data-photo hidden></label></div>' +
        "</div></td></tr>";
    }).join("");

    $$("tr[data-i]", body).forEach(function (tr) {
      var i = +tr.dataset.i, c = run.checkpoints[i], key = run.id + ":" + i;
      $$("[data-c]", tr).forEach(function (inp) {
        inp.addEventListener("change", function () {
          var k = inp.dataset.c;
          c[k] = ["strokes", "feet", "chipCount", "chipMaxUm"].indexOf(k) >= 0 ? num(inp.value) : inp.value;
          if (k === "strokes" && c.strokes == null) c.strokes = 0;
          save(); if (k === "strokes" || k === "failureMode") { renderCps(run); renderRunList(); }
        });
      });
      $$("[data-r]", tr).forEach(function (inp) {
        inp.addEventListener("change", function () { c.readings[+inp.dataset.r] = num(inp.value); save(); var m = cpMean(c); tr.children[5].textContent = m != null ? fmt(m) : "–"; renderRunList(); });
      });
      var tg = $("[data-toggle]", tr); if (tg) tg.addEventListener("click", function () { open[key] = !open[key]; renderCps(run); });
      var dl = $("[data-del]", tr); if (dl) dl.addEventListener("click", function () { if (!confirm("Delete checkpoint at " + c.strokes + " strokes?")) return; run.checkpoints.splice(i, 1); save(); renderCps(run); renderRunList(); });
      var ph = $("[data-photo]", tr); if (ph) ph.addEventListener("change", function () {
        Promise.all(Array.prototype.map.call(ph.files, downscale)).then(function (urls) { c.photos = c.photos.concat(urls); if (!save()) c.photos.splice(c.photos.length - urls.length); renderCps(run); });
      });
      $$("[data-delphoto]", tr).forEach(function (b) { b.addEventListener("click", function () { c.photos.splice(+b.dataset.delphoto, 1); save(); renderCps(run); }); });
      $$("img", tr).forEach(function (img) { img.addEventListener("click", function () { showImage(img.src); }); });
    });
  }

  function downscale(file) {
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1200, s = Math.min(1, max / Math.max(img.width, img.height));
          var cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/jpeg", 0.82));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function showImage(src) {
    var d = document.createElement("dialog"); d.innerHTML = '<img src="' + src + '" alt="Edge photo">';
    d.addEventListener("click", function () { d.close(); d.remove(); }); document.body.appendChild(d); d.showModal();
  }

  // ---------- irons tab ----------
  function editableTable(tableSel, rows, cols, onDelete) {
    var t = $(tableSel);
    t.innerHTML = "<thead><tr>" + cols.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "<th></th></tr></thead><tbody>" +
      rows.map(function (r, i) {
        return '<tr data-i="' + i + '">' + cols.map(function (c) {
          var v = c.get ? c.get(r) : r[c.key];
          if (c.type === "checkbox") return '<td><input type="checkbox" data-k="' + c.key + '"' + (v ? " checked" : "") + "></td>";
          return '<td><input data-k="' + c.key + '" type="' + (c.type || "text") + '"' + (c.type === "number" ? ' step="any"' : "") + ' value="' + esc(v == null ? "" : v) + '"></td>';
        }).join("") + '<td><button class="link" data-del>✕</button></td></tr>';
      }).join("") + "</tbody>";
    $$("tbody tr", t).forEach(function (tr) {
      var r = rows[+tr.dataset.i];
      $$("input", tr).forEach(function (inp) {
        var c = cols.find(function (x) { return x.key === inp.dataset.k; });
        inp.addEventListener("change", function () {
          if (c.set) c.set(r, inp.value); else if (c.type === "checkbox") r[c.key] = inp.checked; else if (c.type === "number") r[c.key] = num(inp.value); else r[c.key] = inp.value;
          save();
        });
      });
      $("[data-del]", tr).addEventListener("click", function () { onDelete(r); });
    });
  }
  function renderIrons() {
    editableTable("#iron-table", state.irons, [
      { key: "name", label: "Name" }, { key: "steel", label: "Steel" }, { key: "hrc", label: "HRc", type: "number" },
      { key: "hrcVerified", label: "HRc verified", type: "checkbox" }, { key: "charpy", label: "Charpy (ft-lbs)", type: "number" },
      { key: "charpySource", label: "Charpy source" }, { key: "notes", label: "Notes" }
    ], function (iron) {
      var used = state.runs.filter(function (r) { return r.ironId === iron.id; }).length;
      if (used) { alert("This iron is used by " + used + " run(s). Reassign or delete those runs first."); return; }
      state.irons = state.irons.filter(function (x) { return x !== iron; }); save(); renderIrons();
    });
    editableTable("#steel-table", state.steels, [
      { key: "name", label: "Steel" }, { key: "hrc", label: "HRc", type: "number" }, { key: "charpy", label: "Charpy (ft-lbs)", type: "number" }, { key: "source", label: "Source" }
    ], function (s) { state.steels = state.steels.filter(function (x) { return x !== s; }); save(); renderIrons(); });
    editableTable("#ref-table", state.references, [
      { key: "name", label: "Name" },
      { key: "readings", label: "Readings (g, comma separated)", get: function (r) { return (r.readings || []).join(", "); }, set: function (r, v) { r.readings = v.split(/[,\s]+/).map(Number).filter(function (n) { return isFinite(n) && n > 0; }); } },
      { key: "notes", label: "Notes" }
    ], function (r) { state.references = state.references.filter(function (x) { return x !== r; }); save(); renderIrons(); });
  }
  $("#btn-new-iron").addEventListener("click", function () { state.irons.push({ id: uid("iron"), name: "New iron", steel: "", hrc: null, hrcVerified: false, charpy: null, charpySource: "", notes: "" }); save(); renderIrons(); });
  $("#btn-new-steel").addEventListener("click", function () { state.steels.push({ id: uid("steel"), name: "", hrc: null, charpy: null, source: "" }); save(); renderIrons(); });
  $("#btn-new-ref").addEventListener("click", function () { state.references.push({ id: uid("ref"), name: "New reference", readings: [], notes: "" }); save(); renderIrons(); });

  // ---------- findings tab ----------
  function groups(useCase) {
    var map = {};
    state.runs.forEach(function (r) {
      if (useCase && (r.useCase || "") !== useCase) return;
      var iron = ironOf(r), key = iron.steel + "|" + (iron.hrc != null ? iron.hrc : "?");
      var g = map[key] || (map[key] = { key: key, steel: iron.steel, hrc: iron.hrc, charpy: iron.charpy, ironId: iron.id, cells: {} });
      if (g.charpy == null && iron.charpy != null) g.charpy = iron.charpy;
      var a = edgeAngle(r);
      (g.cells[a] = g.cells[a] || []).push(r);
    });
    return Object.keys(map).map(function (k) {
      var g = map[k];
      g.outcome = {};
      Object.keys(g.cells).forEach(function (a) {
        // Conservative: the worst outcome at an angle wins (any chip is a failure)
        var outs = g.cells[a].map(function (r) { return r.outcome || "in-progress"; });
        var fails = outs.filter(function (o) { return OUTCOMES[o].fail; });
        g.outcome[a] = fails.length ? fails.sort(function (x, y) { return OUTCOMES[y].rank - OUTCOMES[x].rank; })[0]
          : outs.indexOf("stable") >= 0 ? "stable" : outs.indexOf("plateau-uninspected") >= 0 ? "plateau-uninspected" : "in-progress";
      });
      var passes = Object.keys(g.outcome).map(Number).filter(function (a) { return OUTCOMES[g.outcome[a]].pass; }).sort(function (x, y) { return x - y; });
      g.minAngle = passes.length ? passes[0] : null;
      g.provisional = g.minAngle != null && OUTCOMES[g.outcome[g.minAngle]].provisional;
      g.failed = Object.keys(g.outcome).map(Number).filter(function (a) { return OUTCOMES[g.outcome[a]].fail; });
      g.label = g.steel + (g.hrc != null ? " " + fmt(g.hrc) + " HRc" : "");
      return g;
    }).sort(function (a, b) { return (b.charpy || 0) - (a.charpy || 0); });
  }

  $("#ctl-usecase").addEventListener("change", function () { ui.usecase = this.value; saveUI(); renderFindings(); });
  $("#ctl-tmin").addEventListener("input", function () { ui.tmin = this.value; saveUI(); renderPareto(); });
  $("#findings-notes").addEventListener("change", function () { state.notes = this.value; save(); });

  function renderFindings() {
    var ucs = Array.from(new Set(state.runs.map(function (r) { return r.useCase || ""; }).filter(Boolean)));
    $("#ctl-usecase").innerHTML = '<option value="">All use cases</option>' + ucs.map(function (u) { return '<option' + (u === ui.usecase ? " selected" : "") + ">" + esc(u) + "</option>"; }).join("");
    var gs = groups(ui.usecase);
    var angles = Array.from(new Set(STD_ANGLES.concat(state.runs.map(edgeAngle)))).sort(function (a, b) { return a - b; });
    $("#matrix").innerHTML = "<thead><tr><th>Steel / hardness</th><th>Charpy</th>" + angles.map(function (a) { return "<th>" + fmt(a) + "°</th>"; }).join("") + "<th>Min safe</th></tr></thead><tbody>" +
      (gs.map(function (g) {
        return "<tr><th>" + esc(g.label) + "</th><td>" + (g.charpy != null ? fmt(g.charpy) : "–") + "</td>" + angles.map(function (a) {
          var o = g.outcome[a];
          if (!o) return '<td title="Untested">·</td>';
          var d = OUTCOMES[o], n = g.cells[a].length;
          return '<td class="' + (a === g.minAngle ? "min" : "") + '" style="background:' + d.color + ";color:" + d.ink + '" title="' + esc(d.label + " (" + n + " run" + (n > 1 ? "s" : "") + ")") + '">' + esc(d.label.split(",")[0]) + "</td>";
        }).join("") + "<td><b>" + (g.minAngle != null ? fmt(g.minAngle) + "°" : "–") + "</b>" + (g.provisional ? ' <span class="muted small">(provisional)</span>' : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="' + (angles.length + 3) + '" class="muted">No runs for this use case.</td></tr>') + "</tbody>";
    $("#matrix-legend").innerHTML = Object.keys(OUTCOMES).map(function (k) { return '<span><span class="sdot swatch dot" style="background:' + OUTCOMES[k].color + '"></span>' + OUTCOMES[k].label + "</span>"; }).join("") +
      '<span><span class="swatch dot" style="background:var(--untested)"></span>Untested</span><span>Outlined cell: lowest passing angle. Any chip at an angle marks that angle failed.</span>';

    var pts = [];
    gs.forEach(function (g, i) {
      if (g.charpy == null) return;
      var color = ironColor(g.ironId);
      if (g.minAngle != null) pts.push({ x: g.charpy, y: g.minAngle, color: color, label: g.label + (g.provisional ? " (provisional)" : ""), tip: "<b>" + esc(g.label) + "</b><br>Charpy " + fmt(g.charpy) + " ft-lbs<br>Lowest stable angle " + fmt(g.minAngle) + "°" + (g.provisional ? "<br>Provisional: plateau not yet microscope-checked" : "") });
      g.failed.forEach(function (a) { pts.push({ x: g.charpy, y: a, color: color, hollow: true, tip: "<b>" + esc(g.label) + "</b><br>Failed at " + fmt(a) + "° (" + OUTCOMES[g.outcome[a]].label + ")" }); });
    });
    Charts.scatterChart($("#chart-threshold"), { points: pts, xLabel: "Charpy toughness (ft-lbs)", yLabel: "Edge angle (°)", yExtent: [15, 30], height: 320, emptyText: "Needs runs on irons with a Charpy estimate", ariaLabel: "Charpy toughness versus minimum safe edge angle" });

    renderPareto();
    renderObservations();
    $("#findings-notes").value = state.notes || "";
  }

  function renderPareto() {
    $("#ctl-tmin").value = ui.tmin;
    var steels = state.steels.filter(function (s) { return s.hrc != null && s.charpy != null; });
    var frontier = steels.filter(function (s) { return !steels.some(function (o) { return o !== s && o.hrc >= s.hrc && o.charpy >= s.charpy && (o.hrc > s.hrc || o.charpy > s.charpy); }); });
    var tmin = num(ui.tmin), pick = null;
    if (tmin != null) steels.forEach(function (s) { if (s.charpy >= tmin && (!pick || s.hrc > pick.hrc)) pick = s; });
    var pts = steels.map(function (s) {
      var onF = frontier.indexOf(s) >= 0, isPick = s === pick;
      return { x: s.charpy, y: s.hrc, color: onF ? "var(--series-1)" : "var(--text-muted)", hollow: !onF, r: isPick ? 9 : 6, label: s.name + (isPick ? " ← pick" : ""), tip: "<b>" + esc(s.name) + "</b><br>" + fmt(s.hrc) + " HRc, " + fmt(s.charpy) + " ft-lbs" + (onF ? "<br>On the frontier" : "<br>Dominated") + (s.source ? '<br><span class="muted">' + esc(s.source) + "</span>" : "") };
    });
    Charts.scatterChart($("#chart-pareto"), {
      points: pts, lines: frontier.length > 1 ? [{ points: frontier.map(function (s) { return { x: s.charpy, y: s.hrc }; }), color: "var(--series-1)" }] : [],
      vlines: tmin != null ? [{ x: tmin, label: "required ≥ " + fmt(tmin) }] : [],
      xLabel: "Charpy toughness (ft-lbs)", yLabel: "Hardness (HRc)", height: 340, emptyText: "Add steels with HRc and Charpy on the Irons & steels tab", ariaLabel: "Hardness versus toughness with Pareto frontier"
    });
    $("#pareto-pick").textContent = tmin == null ? "Enter a required toughness to pick the hardest steel that meets it." : pick ? "Pick: " + pick.name + " at " + fmt(pick.hrc) + " HRc (" + fmt(pick.charpy) + " ft-lbs)." : "No listed steel reaches that toughness.";
    if (steels.length < 3) $("#pareto-pick").textContent += " Only " + steels.length + " steel(s) listed so far; add more from Larrin's tables.";
  }

  function renderObservations() {
    var items = state.runs.map(function (r) {
      var s = stats(r); if (!s || s.plateau == null) return "";
      return "<li><b>" + esc(runLabel(r)) + ":</b> starts at " + fmt(s.start) + " g and plateaus near " + fmt(s.plateau) + " g (" + (s.change >= 0 ? "+" : "") + Math.round(s.change * 100) + "%) over " + s.strokes + " strokes; triplet noise about ±" + Math.round(s.noise * 100) + "%.</li>";
    }).join("");
    items += "<li>Both irons lose sharpness fast in the first 20–40 strokes, then plateau. That fits the apex deforming or micro-chipping down to a stable width (edge stability) rather than ordinary wear. 250 strokes is still within the plateau.</li>" +
      "<li>AEB-L at ~64 HRc holding a stable 20° edge under a heavy cut is notable, since typical advice calls 20° too acute for a plane iron.</li>" +
      "<li>The AEB-L bump at 80–100 strokes (~600 g) then back to ~470 g could be a burr breaking off, a micro-chip leaving a fresh apex, or a different test spot. Force readings alone can't tell which; microscope checks and fixed spots will.</li>";
    $("#obs-list").innerHTML = items;
  }

  // ---------- data tab ----------
  function download(name, text, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $("#btn-export").addEventListener("click", function () { download("edge-lab-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(state, null, 2), "application/json"); });
  $("#btn-export-csv").addEventListener("click", function () {
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [["run", "iron", "steel", "hrc", "charpy", "bed_deg", "bevel_deg", "microbevel_deg", "edge_deg", "wood", "use_case", "shaving_in", "strokes", "feet", "spot", "grams", "media", "failure_mode", "chip_count", "chip_max_um", "outcome"].join(",")];
    state.runs.forEach(function (r) {
      var iron = ironOf(r);
      sortedCps(r).forEach(function (c) {
        c.readings.forEach(function (g, j) {
          if (g == null) return;
          lines.push([runLabel(r), iron.name, iron.steel, iron.hrc, iron.charpy, r.bedAngle, r.bevelAngle, r.microbevelAngle, edgeAngle(r), r.wood, r.useCase, r.shavingIn, c.strokes, cpFeet(r, c), j + 1, g, c.media || r.media, c.failureMode, c.chipCount, c.chipMaxUm, r.outcome].map(q).join(","));
        });
      });
    });
    download("edge-lab-readings.csv", lines.join("\n"), "text/csv");
  });
  $("#file-import").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (t) {
      var d = JSON.parse(t);
      if (!d || !Array.isArray(d.runs) || !Array.isArray(d.irons)) throw new Error("Not an Edge Stability Lab export");
      if (!confirm("Replace all current data with " + d.runs.length + " runs from " + f.name + "?")) return;
      state = normalize(d); ui.selected = null; save(); saveUI(); renderData();
    }).catch(function (e) { alert("Import failed: " + e.message); });
    this.value = "";
  });
  $("#btn-reset").addEventListener("click", function () {
    if (!confirm("Replace all data with the original seed data? Export first if you want to keep your runs.")) return;
    state = normalize(clone(window.BLADE_SEED)); ui.selected = null; ui.editing = null; save(); saveUI(); renderData();
  });
  function renderData() {
    var bytes = 0; try { bytes = (localStorage.getItem(KEY) || "").length * 2; } catch (e) { /* ignore */ }
    var photos = state.runs.reduce(function (n, r) { return n + r.checkpoints.reduce(function (m, c) { return m + c.photos.length; }, 0); }, 0);
    $("#storage-status").textContent = state.runs.length + " runs, " + state.irons.length + " irons, " + photos + " photos. About " + Math.round(bytes / 1024) + " KB used of the browser's ~5 MB limit.";
  }

  setTab(ui.tab);
})();
