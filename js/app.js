/* The Invisible World — page controller: game state, DOM wiring, announcements. */
(function () {
  'use strict';
  var IW = window.InvisibleWorld;
  var Graph = window.InvisibleWorldGraph;
  var Lab = window.InvisibleWorldLab;
  var CFG = IW.CONFIG;

  function $(id) { return document.getElementById(id); }
  var svg = $('graph');

  var state = null;

  /* ---------- Setup ---------- */
  function readParams() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    return {
      good: params && params.get('good'),
      seed: params && IW.normalizeCode(params.get('seed'))
    };
  }

  function worldUrl(world) {
    var base = window.location.href.split('?')[0].split('#')[0];
    return base + '?good=' + encodeURIComponent(world.commodity.id) + '&seed=' + encodeURIComponent(world.code);
  }

  function startWorld(goodId, code) {
    var world = IW.createWorld(goodId, code);
    state = {
      world: world,
      settings: world.initial.slice(),
      observations: [],
      wrong: 0,
      found: { supply: null, demand: null },
      draft: blankLine(),
      placeNext: 1,
      phase: 'play',
      replayIndex: 0,
      baselineIndex: 0,
      compare: [0, 0]
    };
    document.body.classList.remove('is-complete');
    ['predict-price', 'predict-quantity', 'experiment-reason', 'reflection'].forEach(function (id) { $(id).value = ''; });
    drag = null; press = null;
    ['attach', 'thru-1', 'thru-2'].forEach(function (id) { $(id).value = ''; });
    addObservation();
    try { window.history.replaceState(null, '', worldUrl(world)); } catch (e) { /* file:// may refuse; the link still works */ }
    buildConditionControls();
    buildLogHead();
    $('commodity').value = world.commodity.id;
    $('scenario-code').textContent = world.code;
    $('share-link').href = worldUrl(world);
    document.querySelectorAll('.q-label').forEach(function (n) { n.textContent = 'Quantity'; });
    document.querySelectorAll('.p-label').forEach(function (n) { n.textContent = 'Price'; });
    configureEndpointInputs();
    $('endpoint-units').textContent = 'Quantity: ' + unitWord(world.commodity.quantity) +
      '. Price: ' + unitWord(world.commodity.price) + '. Enter values within the graph’s axes.';
    $('results').hidden = true;
    $('curve-feedback').textContent = '';
    setKind(firstOpenKind());
    render();
  }

  function blankLine() { return { q1: NaN, p1: NaN, q2: NaN, p2: NaN }; }

  function buildConditionControls() {
    var list = $('condition-list');
    list.textContent = '';
    state.world.commodity.variables.forEach(function (spec, i) {
      var wrap = document.createElement('div');
      wrap.className = 'condition';
      var id = 'var-' + i;
      var label = document.createElement('label');
      label.htmlFor = id;
      label.className = 'condition__name';
      label.textContent = spec.name;
      var out = document.createElement('output');
      out.id = id + '-value';
      out.htmlFor = id;
      out.className = 'condition__value';
      var input = document.createElement('input');
      input.type = 'range'; input.id = id; input.min = 0; input.max = IW.LEVELS - 1; input.step = 1;
      input.value = state.settings[i];
      input.addEventListener('input', function () {
        state.settings[i] = Number(input.value);
        updateConditionText(i);
        renderObservePanel();
      });
      var ends = document.createElement('div');
      ends.className = 'condition__ends';
      ends.setAttribute('aria-hidden', 'true');
      ends.innerHTML = '<span></span><span></span>';
      ends.children[0].textContent = spec.levels[0];
      ends.children[1].textContent = spec.levels[IW.LEVELS - 1];
      var head = document.createElement('div');
      head.className = 'condition__head';
      head.appendChild(label); head.appendChild(out);
      wrap.appendChild(head); wrap.appendChild(input); wrap.appendChild(ends);
      list.appendChild(wrap);
      updateConditionText(i);
    });
  }

  function updateConditionText(i) {
    var spec = state.world.commodity.variables[i];
    var text = spec.levels[state.settings[i]];
    $('var-' + i + '-value').textContent = text;
    $('var-' + i).setAttribute('aria-valuetext', text);
  }

  function buildLogHead() {
    var head = $('log-head');
    head.textContent = '';
    var c = state.world.commodity;
    var cols = ['Point'].concat(c.variables.map(function (v) { return v.name; }),
      ['Price (' + unitWord(c.price) + ')', 'Quantity (' + unitWord(c.quantity) + ')', 'Experiment', '']);
    cols.forEach(function (t, i) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = t;
      if (i === cols.length - 1) { th.innerHTML = '<span class="visually-hidden">Action</span>'; }
      head.appendChild(th);
    });
  }

  function unitWord(axis) {
    var m = /\(([^)]+)\)/.exec(axis.title);
    return m ? m[1] : axis.title;
  }

  function configureEndpointInputs() {
    var c = state.world.commodity;
    [['q', c.quantity], ['p', c.price]].forEach(function (pair) {
      var step = Math.pow(10, -pair[1].decimals);
      [1, 2].forEach(function (end) {
        var input = $(pair[0] + end);
        input.min = 0;
        input.max = IW.toDisplay(pair[1], IW.GRID);
        input.step = step;
        input.setAttribute('aria-description', pair[0] === 'q' ? c.quantity.title : c.price.title);
        input.setAttribute('aria-describedby', 'endpoint-units curve-feedback');
      });
    });
  }

  /* ---------- Actions ---------- */
  function addObservation() {
    var e = IW.equilibrium(state.world, state.settings);
    var o = { label: IW.observationLabel(state.observations.length), settings: state.settings.slice(), P: e.P, Q: e.Q };
    state.observations.push(o);
    return o;
  }

  function observe() {
    if (state.phase !== 'play' || state.observations.length >= CFG.maxObservations) return;
    var o = addObservation();
    o.baseline = state.baselineIndex;
    o.prediction = { price: $('predict-price').value, quantity: $('predict-quantity').value,
      reason: $('experiment-reason').value.trim() };
    state.compare = [state.baselineIndex, state.observations.length - 1];
    ['predict-price', 'predict-quantity', 'experiment-reason'].forEach(function (id) { $(id).value = ''; });
    announce('Observation ' + o.label + ': price ' + fmtP(o.P) + ', quantity ' + fmtQ(o.Q) +
      '. Score ' + IW.runningScore(scoreState()) + '.');
    render();
  }

  function scoreState() {
    return { observations: state.observations.length, wrong: state.wrong,
      found: { supply: !!state.found.supply, demand: !!state.found.demand } };
  }

  function currentKind() {
    var r = document.querySelector('input[name="kind"]:checked');
    return r ? r.value : 'supply';
  }
  function setKind(kind) {
    document.querySelectorAll('input[name="kind"]').forEach(function (r) { r.checked = r.value === kind; });
  }
  function firstOpenKind() { return !state.found.supply ? 'supply' : 'demand'; }

  function checkCurve(evt) {
    evt.preventDefault();
    if (state.phase !== 'play') return;
    var fb = $('curve-feedback');
    var kind = currentKind();
    if (state.observations.length < 2) { fb.textContent = 'Take at least one more observation before checking a curve.'; announce(fb.textContent); return; }
    if (state.found[kind]) { fb.textContent = 'You have already identified the ' + kind + ' curve.'; announce(fb.textContent); return; }
    var target = state.observations[Number($('attach').value)];
    var result = IW.gradeCurve(state.world, state.draft, kind, target.settings, state.observations);
    if (!result.valid) {
      var errors = {
        vertical: 'The two endpoints need different quantities; a vertical line cannot be checked.',
        bounds: 'Keep each endpoint within the graph’s quantity and price ranges. No points deducted.',
        evidence: 'Observe at least two different quantities before checking. Repeated points do not identify a curve. No points deducted.',
        incomplete: 'Give the line first: pick two observations, type both endpoints, or click two spots on the graph.'
      };
      fb.textContent = errors[result.error];
      announce(fb.textContent);
      return;
    }
    var name = kind.charAt(0).toUpperCase() + kind.slice(1);
    if (result.correct) {
      state.found[kind] = { q1: state.draft.q1, p1: state.draft.p1, q2: state.draft.q2, p2: state.draft.p2, label: target.label };
      state.draft = blankLine();
      state.placeNext = 1;
      fb.textContent = 'Correct: that is the ' + kind + ' curve under ' + target.label + '’s conditions.';
      announce(fb.textContent);
      if (state.found.supply && state.found.demand) { finish(); return; }
      setKind(firstOpenKind());
    } else {
      state.wrong++;
      fb.textContent = 'Not the ' + kind + ' curve under ' + target.label + '’s conditions. −10 points.';
      announce(fb.textContent + ' Score ' + IW.runningScore(scoreState()) + '.');
    }
    render();
  }

  function finish() {
    state.phase = 'done';
    document.body.classList.add('is-complete');
    state.replayIndex = 0;
    state.compare = [0, 0];
    state.draft = blankLine();
    render();
    $('results').hidden = false;
    renderResults();
    $('results-heading').focus();
  }

  /* ---------- Line entry ---------- */
  function setEndpoint(end, q, p) {
    state.draft['q' + end] = q;
    state.draft['p' + end] = p;
  }

  function snap(q, p) {
    var best = null, bestD = CFG.snapDistance;
    state.observations.forEach(function (o) {
      var d = Math.sqrt((o.Q - q) * (o.Q - q) + (o.P - p) * (o.P - p));
      if (d <= bestD) { best = o; bestD = d; }
    });
    return best;
  }

  function placeFromPointer(evt) {
    var g = Graph.toGrid(svg, evt);
    if (!g || !g.inside) return;
    var s = snap(g.q, g.p);
    var q = s ? s.Q : g.q, p = s ? s.P : g.p;
    var end = state.placeNext;
    setEndpoint(end, q, p);
    state.placeNext = end === 1 ? 2 : 1;
    announce('Endpoint ' + end + (s ? ' snapped to observation ' + s.label : ' placed') + ' at quantity ' + fmtQ(q) + ', price ' + fmtP(p) + '.');
    render();
  }

  var drag = null, press = null;
  function onPointerDown(evt) {
    if (state.phase !== 'play' || evt.button !== 0 || evt.isPrimary === false) return;
    var end = evt.target.getAttribute && evt.target.getAttribute('data-end');
    press = { x: evt.clientX, y: evt.clientY, moved: false };
    if (end) {
      drag = Number(end);
      svg.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    }
  }
  function onPointerMove(evt) {
    if (drag == null) return;
    if (press && Math.abs(evt.clientX - press.x) < 6 && Math.abs(evt.clientY - press.y) < 6 && !press.moved) return;
    if (press) press.moved = true;
    var g = Graph.toGrid(svg, evt);
    if (!g) return;
    setEndpoint(drag, g.q, g.p);
    render();
  }
  function onPointerUp(evt) {
    // A press on a handle that never moved is an ordinary click: place the next endpoint.
    if (drag != null && !(press && press.moved)) drag = null;
    if (drag != null) {
      press = null;
      var g = Graph.toGrid(svg, evt), end = drag;
      drag = null;
      if (g) {
        var s = snap(g.q, g.p);
        if (s) setEndpoint(end, s.Q, s.P);
        announce('Endpoint ' + end + ' moved to quantity ' + fmtQ(state.draft['q' + end]) + ', price ' + fmtP(state.draft['p' + end]) + '.');
      }
      render();
      return;
    }
    if (press && Math.abs(evt.clientX - press.x) < 6 && Math.abs(evt.clientY - press.y) < 6 && state.phase === 'play') placeFromPointer(evt);
    press = null;
  }

  function onEndpointInput(evt) {
    var id = evt.target.id, axisKey = id.charAt(0), end = id.charAt(1);
    var axis = axisKey === 'q' ? state.world.commodity.quantity : state.world.commodity.price;
    var raw = evt.target.value;
    var v = raw === '' ? NaN : IW.fromDisplay(axis, Number(raw));
    state.draft[axisKey + end] = v;
    evt.target.setAttribute('aria-invalid', String(raw !== '' && (!isFinite(v) || v < 0 || v > IW.GRID)));
    renderGraph();
  }

  function drawThrough() {
    var a = $('thru-1').value, b = $('thru-2').value, fb = $('curve-feedback');
    if (a === '' || b === '') { fb.textContent = 'Choose two observations to draw through.'; announce(fb.textContent); return; }
    var A = state.observations[Number(a)], B = state.observations[Number(b)];
    if (Math.abs(A.Q - B.Q) < 1e-9) {
      fb.textContent = A.label === B.label || Math.abs(A.P - B.P) < 1e-9
        ? 'Those are the same point; choose two different points.'
        : 'Those points have the same quantity, so the line through them would be vertical.';
      announce(fb.textContent);
      return;
    }
    state.draft = IW.lineThrough(A, B);
    state.placeNext = 1;
    fb.textContent = '';
    announce('Line drawn through ' + A.label + ' and ' + B.label + '.');
    render();
  }

  /* ---------- Rendering ---------- */
  function fmtP(p) { return IW.formatAxis(state.world.commodity.price, p); }
  function fmtQ(q) { return IW.formatAxis(state.world.commodity.quantity, q); }

  function announce(msg) {
    var s = $('status');
    s.textContent = '';
    window.setTimeout(function () { s.textContent = msg; }, 30);
  }

  function render() {
    renderScore();
    renderObservePanel();
    renderCurvePanel();
    renderLog();
    renderLab();
    renderGraph();
    if (state.phase === 'done') renderResults();
  }

  function renderScore() {
    var s = IW.runningScore(scoreState());
    $('score').textContent = state.phase === 'done' ? IW.finalScore(scoreState()).final : s;
    var n = state.observations.length;
    $('score-note').textContent = state.phase === 'done' ? '(final)'
      : '(' + n + ' of ' + CFG.maxObservations + ' observations' + (state.wrong ? ', ' + state.wrong + ' wrong' : '') + ')';
  }

  function renderObservePanel() {
    renderBaselineInfo();
    var n = state.observations.length;
    var done = state.phase !== 'play';
    $('conditions').disabled = done;
    var btn = $('observe'), note = $('observe-note');
    if (done) {
      btn.disabled = true; btn.textContent = 'Observing closed';
      note.textContent = '';
      return;
    }
    if (n >= CFG.maxObservations) {
      btn.disabled = true;
      btn.textContent = 'All ' + CFG.maxObservations + ' observations used';
      note.textContent = 'You can keep trying curves; each wrong try costs 10 points.';
      return;
    }
    btn.disabled = false;
    btn.textContent = 'Observe point ' + IW.observationLabel(n) + ' (−5)';
    var dup = state.observations.filter(function (o) { return o.settings.join() === state.settings.join(); });
    note.textContent = dup.length
      ? 'These are the same conditions as ' + dup.map(function (o) { return o.label; }).join(', ') + '; observing again costs 5 points and lands on the same spot.'
      : (CFG.maxObservations - n) + ' observations left.';
  }

  function optionsFor(select, withBlank) {
    var keep = select.value;
    select.textContent = '';
    if (withBlank) select.appendChild(new Option('—', ''));
    state.observations.forEach(function (o, i) { select.appendChild(new Option(o.label, String(i))); });
    if (keep !== '' && Number(keep) < state.observations.length) select.value = keep;
    else if (!withBlank) select.value = '0';
  }

  function renderCurvePanel() {
    var done = state.phase !== 'play';
    optionsFor($('attach'), false);
    optionsFor($('thru-1'), true);
    optionsFor($('thru-2'), true);
    document.querySelectorAll('input[name="kind"]').forEach(function (r) {
      r.disabled = done || !!state.found[r.value];
      r.parentNode.classList.toggle('choice--done', !!state.found[r.value]);
    });
    ['attach', 'thru-1', 'thru-2', 'thru-apply', 'q1', 'p1', 'q2', 'p2', 'check', 'clear-line', 'finish']
      .forEach(function (id) { $(id).disabled = done; });
    var c = state.world.commodity;
    [1, 2].forEach(function (end) {
      var q = state.draft['q' + end], p = state.draft['p' + end];
      var qi = $('q' + end), pi = $('p' + end);
      if (document.activeElement !== qi) qi.value = isFinite(q) ? IW.toDisplay(c.quantity, q) : '';
      if (document.activeElement !== pi) pi.value = isFinite(p) ? IW.toDisplay(c.price, p) : '';
      qi.setAttribute('aria-invalid', String(isFinite(q) && (q < 0 || q > IW.GRID)));
      pi.setAttribute('aria-invalid', String(isFinite(p) && (p < 0 || p > IW.GRID)));
    });
    var parts = [];
    ['supply', 'demand'].forEach(function (k) {
      if (state.found[k]) parts.push(k.charAt(0).toUpperCase() + k.slice(1) + ' found (under ' + state.found[k].label + '’s conditions).');
    });
    $('found').textContent = parts.join(' ');
  }

  function renderLog() {
    var body = document.querySelector('#log tbody');
    var focusId = body.contains(document.activeElement) ? document.activeElement.id : null;
    body.textContent = '';
    var c = state.world.commodity;
    state.observations.forEach(function (o, i) {
      var tr = document.createElement('tr');
      if (state.phase === 'done' && i === state.replayIndex) tr.className = 'row--hot';
      var th = document.createElement('th');
      th.scope = 'row'; th.textContent = o.label;
      tr.appendChild(th);
      o.settings.forEach(function (lvl, v) { td(tr, c.variables[v].levels[lvl]); });
      td(tr, fmtP(o.P), 'num');
      td(tr, fmtQ(o.Q), 'num');
      var note = document.createElement('td');
      note.className = 'experiment-note';
      if (o.prediction) {
        var base = state.observations[o.baseline];
        note.textContent = 'Compared with ' + base.label + '. ' + (o.prediction.reason || 'No reasoning recorded.');
        var predicted = document.createElement('small');
        predicted.textContent = 'Prediction — price: ' + predictionWord(o.prediction.price) +
          '; quantity: ' + predictionWord(o.prediction.quantity) + '.';
        note.appendChild(predicted);
      } else note.textContent = 'Starting observation';
      tr.appendChild(note);
      var cell = document.createElement('td');
      var b = document.createElement('button');
      b.type = 'button';
      b.id = 'log-action-' + i;
      b.className = 'btn btn--small';
      if (state.phase === 'done') {
        b.textContent = 'Replay ' + o.label;
        b.addEventListener('click', function () { replayAt(i); });
      } else {
        b.textContent = 'Use ' + o.label;
        b.setAttribute('aria-label', 'Use observation ' + o.label + '’s conditions for the curve');
        b.addEventListener('click', function () {
          $('attach').value = String(i);
          announce('Curve will be checked under ' + o.label + '’s conditions.');
        });
      }
      cell.appendChild(b);
      tr.appendChild(cell);
      body.appendChild(tr);
    });
    if (focusId && $(focusId)) $(focusId).focus({ preventScroll: true });
  }

  function td(tr, text, cls) {
    var cell = document.createElement('td');
    cell.textContent = text;
    if (cls) cell.className = cls;
    tr.appendChild(cell);
  }

  function renderGraph() {
    var w = state.world, done = state.phase === 'done';
    var revealed = null, highlight = null;
    if (done) {
      highlight = state.replayIndex;
      var s = state.observations[highlight].settings;
      revealed = { supply: IW.trueCurve(w, 'supply', s).priceAt, demand: IW.trueCurve(w, 'demand', s).priceAt };
    }
    Graph.render(svg, {
      commodity: w.commodity,
      observations: state.observations,
      highlight: highlight,
      selection: done ? null : state.compare,
      draft: done ? null : state.draft,
      found: state.found,
      revealed: revealed
    });
    renderLegend(done);
    $('graph-desc').textContent = describeGraph(revealed);
    $('graph-help').hidden = done;
  }

  function renderLegend(done) {
    var items = [['obs', 'Observed equilibrium']];
    if (!done) items.push(['draft', 'Your line being drawn']);
    if (done) items.push(['supply', 'True supply'], ['demand', 'True demand']);
    if (state.found.supply) items.push(['supply' + (done ? ' student' : ''), 'Your supply curve']);
    if (state.found.demand) items.push(['demand' + (done ? ' student' : ''), 'Your demand curve']);
    var ul = $('legend');
    ul.textContent = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var sw = document.createElement('span');
      sw.className = 'swatch ' + it[0].split(' ').map(function (k) { return 'swatch--' + k; }).join(' ');
      sw.setAttribute('aria-hidden', 'true');
      li.appendChild(sw);
      li.appendChild(document.createTextNode(it[1]));
      ul.appendChild(li);
    });
  }

  function lineText(priceAt) {
    return 'from quantity 0 at ' + fmtP(priceAt(0)) + ' to quantity ' + fmtQ(IW.GRID) + ' at ' + fmtP(priceAt(IW.GRID));
  }

  function describeGraph(revealed) {
    var parts = [];
    parts.push(state.observations.map(function (o) { return o.label + ' at price ' + fmtP(o.P) + ', quantity ' + fmtQ(o.Q); }).join('; ') + '.');
    ['supply', 'demand'].forEach(function (k) {
      var f = state.found[k];
      if (f) parts.push('Your ' + k + ' curve runs ' + lineText(function (q) { return IW.linePriceAt(f, q); }) + '.');
    });
    if (revealed) {
      var o = state.observations[state.replayIndex];
      parts.push('True curves under ' + o.label + '’s conditions: supply ' + lineText(revealed.supply) + '; demand ' + lineText(revealed.demand) + '.');
    } else if (!IW.lineCheck(state.draft)) {
      parts.push('Your draft line runs ' + lineText(function (q) { return IW.linePriceAt(state.draft, q); }) + '.');
    }
    return 'Observed market equilibria: ' + parts.join(' ');
  }

  function renderResults() {
    var sc = IW.finalScore(scoreState());
    var extra = state.observations.length - 1;
    var found = sc.curvesFound === 2 ? 'You identified both curves.'
      : sc.curvesFound === 1 ? 'You identified one curve, so the running score is halved.'
      : 'You did not identify either curve, so the score is 0.';
    $('final-score').textContent = 'Final score: ' + sc.final;
    $('breakdown').textContent = 'Started at ' + CFG.startScore +
      ', −' + sc.observationPenalty + ' for ' + extra + ' extra observation' + (extra === 1 ? '' : 's') +
      ', −' + sc.wrongPenalty + ' for ' + state.wrong + ' wrong tr' + (state.wrong === 1 ? 'y' : 'ies') +
      '; running score ' + sc.running + ' (minimum 0). ' + found;
    $('role-reveal').textContent = IW.ambiguousExplanation(state.world);
    var predictions = state.observations.reduce(function (all, point) {
      return all.concat(Lab.predictionResult(state.observations, point));
    }, []);
    $('prediction-review').textContent = predictions.length
      ? predictions.filter(function (p) { return p.correct; }).length + ' of ' + predictions.length +
        ' predicted directions matched the observations. Predictions do not affect your score.'
      : 'No directional predictions recorded. On your next run, predict before you observe.';
    var i = state.replayIndex, obs = state.observations, o = obs[i];
    $('replay-heading').textContent = 'Replay: observation ' + o.label + ' (' + (i + 1) + ' of ' + obs.length + ')';
    $('prev').disabled = i === 0;
    $('next').disabled = i === obs.length - 1;
    $('replay-text').textContent = i === 0
      ? 'A is where the market started. The colored lines are the true supply and demand curves under A’s conditions.'
      : 'From ' + obs[i - 1].label + ' to ' + o.label + ', ' + lowerFirst(IW.describeStep(state.world, obs[i - 1], o).text);
    var sh = IW.sharedCurves(state.world, obs, i);
    $('replay-groups').textContent = 'On this supply curve: ' + sh.supply.join(', ') + '. On this demand curve: ' + sh.demand.join(', ') + '.';
  }

  function lowerFirst(t) { return t.charAt(0).toLowerCase() + t.slice(1); }

  function announceReplay() {
    announce($('replay-heading').textContent + '. ' + $('replay-text').textContent);
  }

  /* ---------- Experiment workbench ---------- */
  function predictionWord(value) {
    return { up: 'rise', down: 'fall', same: 'stay the same' }[value] || 'not specified';
  }

  function renderBaselineInfo() {
    var base = state.observations[state.baselineIndex];
    if (!base) return;
    var changed = Lab.changes(state.world.commodity, base.settings, state.settings);
    $('baseline-diff').textContent = changed.length === 0
      ? 'No changes from ' + base.label + '. Observing will repeat that point.'
      : changed.length + ' condition' + (changed.length === 1 ? '' : 's') + ' changed from ' + base.label + ': ' +
        changed.map(function (v) { return v.name; }).join(', ') + '.' +
        (changed.length > 1 ? ' Multiple changes can make cause and effect harder to separate.' : '');
  }

  function renderLab() {
    ['baseline', 'compare-first', 'compare-second'].forEach(function (id) { optionsFor($(id), false); });
    $('baseline').value = String(state.baselineIndex);
    $('compare-first').value = String(state.compare[0]);
    $('compare-second').value = String(state.compare[1]);
    $('baseline').disabled = state.phase === 'done';
    $('restore-baseline').disabled = state.phase === 'done';
    var count = (state.found.supply ? 1 : 0) + (state.found.demand ? 1 : 0);
    $('progress-copy').textContent = count + ' of 2 curves identified' +
      (state.phase === 'done' ? ' · investigation complete' : ' · ' + (CFG.maxObservations - state.observations.length) + ' observations left');
    var stage = state.phase === 'done' ? 'explain' : state.observations.length > 1 ? 'identify' : 'observe';
    ['observe', 'identify', 'explain'].forEach(function (name) {
      if (name === stage) $('stage-' + name).setAttribute('aria-current', 'step');
      else $('stage-' + name).removeAttribute('aria-current');
    });
    var latest = state.observations[state.phase === 'done' ? state.replayIndex : state.observations.length - 1];
    var readout = $('market-readout');
    readout.textContent = '';
    [['Price at ' + latest.label, fmtP(latest.P)], ['Quantity at ' + latest.label, fmtQ(latest.Q)]].forEach(function (item) {
      var group = document.createElement('div'), label = document.createElement('small'), value = document.createElement('strong');
      label.textContent = item[0]; value.textContent = item[1];
      group.appendChild(label); group.appendChild(value); readout.appendChild(group);
    });
    renderComparison();
  }

  function renderComparison() {
    var a = state.observations[state.compare[0]], b = state.observations[state.compare[1]];
    var changed = Lab.changes(state.world.commodity, a.settings, b.settings);
    var distinct = state.compare[0] !== state.compare[1];
    $('comparison-summary').textContent = distinct
      ? a.label + ' → ' + b.label + ': ' + changed.length + ' condition' + (changed.length === 1 ? '' : 's') + ' changed.'
      : 'Choose two observations to compare what changed and what stayed fixed.';
    var list = $('comparison-changes'); list.textContent = '';
    changed.forEach(function (v) {
      var li = document.createElement('li'); li.textContent = v.name + ': ' + v.from + ' → ' + v.to; list.appendChild(li);
    });
    var deltas = $('comparison-deltas'); deltas.textContent = '';
    if (distinct) {
      [['Price', b.P - a.P, fmtP], ['Quantity', b.Q - a.Q, fmtQ]].forEach(function (item) {
        var group = document.createElement('div'), term = document.createElement('dt'), value = document.createElement('dd');
        term.textContent = item[0] + ' change';
        value.textContent = (Math.abs(item[1]) < 1e-9 ? '' : item[1] > 0 ? '+' : '−') + item[2](Math.abs(item[1]));
        group.appendChild(term); group.appendChild(value); deltas.appendChild(group);
      });
    }
    var explain = $('comparison-explanation');
    explain.hidden = state.phase !== 'done' || !distinct;
    explain.textContent = !explain.hidden ? IW.describeStep(state.world, a, b).text : '';
    $('compare-draw').disabled = state.phase === 'done' || !distinct || Math.abs(a.Q - b.Q) < 1e-9;
  }

  function replayAt(index) {
    state.replayIndex = index;
    state.compare = [Math.max(0, index - 1), index];
    render(); announceReplay();
  }

  function exportRecord() {
    var record = { commodity: state.world.commodity, code: state.world.code,
      observations: state.observations, phase: state.phase,
      found: ['supply', 'demand'].filter(function (kind) { return !!state.found[kind]; }),
      score: IW.finalScore(scoreState()).final, reflection: $('reflection').value };
    var blob = new Blob([Lab.csvRecord(record)], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'invisible-world-' + state.world.commodity.id + '-' + state.world.code + '.csv';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    announce('Observation notebook downloaded as CSV.');
  }

  function wireLab() {
    $('baseline').addEventListener('change', function () {
      state.baselineIndex = Number(this.value); renderBaselineInfo();
    });
    $('restore-baseline').addEventListener('click', function () {
      if (state.phase !== 'play') return;
      var base = state.observations[state.baselineIndex];
      state.settings = base.settings.slice();
      state.settings.forEach(function (value, i) { $('var-' + i).value = value; updateConditionText(i); });
      renderObservePanel();
      announce('Restored ' + base.label + '’s conditions. No observation taken; no points spent.');
    });
    ['compare-first', 'compare-second'].forEach(function (id, i) {
      $(id).addEventListener('change', function () {
        state.compare[i] = Number(this.value);
        if (state.phase === 'done') state.replayIndex = state.compare[1];
        renderComparison(); renderGraph();
        if (state.phase === 'done') { renderLog(); renderResults(); renderLab(); }
      });
    });
    $('compare-draw').addEventListener('click', function () {
      if (state.phase !== 'play') return;
      $('thru-1').value = String(state.compare[0]); $('thru-2').value = String(state.compare[1]);
      drawThrough(); $('attach').focus();
    });
    $('export-csv').addEventListener('click', exportRecord);
  }

  /* ---------- Wiring ---------- */
  function init() {
    wireLab();
    var sel = $('commodity');
    IW.COMMODITIES.forEach(function (c) { sel.appendChild(new Option(c.name, c.id)); });
    sel.addEventListener('change', function () {
      if (state.phase === 'play' && state.observations.length > 1 &&
          !window.confirm('Switching markets starts a new world and discards this one. Continue?')) {
        sel.value = state.world.commodity.id;
        return;
      }
      startWorld(sel.value, null);
      announce('New ' + state.world.commodity.name.toLowerCase() + ' world, code ' + state.world.code + '.');
    });
    $('new-world').addEventListener('click', function () {
      if (state.phase === 'play' && state.observations.length > 1 &&
          !window.confirm('Start a new world and discard this one?')) return;
      startWorld(state.world.commodity.id, null);
      announce('New world, code ' + state.world.code + '.');
    });
    $('play-again').addEventListener('click', function () {
      startWorld(state.world.commodity.id, null);
      $('observe-heading').scrollIntoView({ block: 'start' });
      $('var-0').focus();
      announce('New world, code ' + state.world.code + '.');
    });
    $('observe').addEventListener('click', observe);
    $('curve-form').addEventListener('submit', checkCurve);
    $('thru-apply').addEventListener('click', drawThrough);
    $('clear-line').addEventListener('click', function () {
      state.draft = blankLine(); state.placeNext = 1;
      $('curve-feedback').textContent = '';
      announce('Line cleared.');
      render();
    });
    $('finish').addEventListener('click', function () {
      if (!(state.found.supply && state.found.demand) &&
          !window.confirm('Finish now? Your score counts only the curves you have identified.')) return;
      finish();
    });
    ['q1', 'p1', 'q2', 'p2'].forEach(function (id) {
      $(id).addEventListener('input', onEndpointInput);
      $(id).addEventListener('change', render);
    });
    $('prev').addEventListener('click', function () { if (state.replayIndex > 0) replayAt(state.replayIndex - 1); });
    $('next').addEventListener('click', function () { if (state.replayIndex < state.observations.length - 1) replayAt(state.replayIndex + 1); });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', function () { drag = null; press = null; });

    var p = readParams();
    startWorld(IW.getCommodity(p.good) ? p.good : 'wool', p.seed);
  }

  init();
})();
