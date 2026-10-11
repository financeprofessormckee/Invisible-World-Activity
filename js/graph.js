/* The Invisible World — SVG graph rendering. Draws from a plain view object; holds no game state. */
(function (root) {
  'use strict';
  var IW = root.InvisibleWorld;
  var NS = 'http://www.w3.org/2000/svg';
  var LEFT = 64, TOP = 16, SIZE = 280, K = SIZE / IW.GRID;

  function x(q) { return LEFT + q * K; }
  function y(p) { return TOP + (IW.GRID - p) * K; }

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    if (text != null) n.textContent = text;
    return n;
  }

  function tickLabel(axis, v) {
    var d = IW.toDisplay(axis, v);
    return axis.prefix + d.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // Full-width line across the plot, clipped to the plot area.
  function drawLine(g, priceAt, cls) {
    g.appendChild(el('line', {
      x1: x(0), y1: y(priceAt(0)), x2: x(IW.GRID), y2: y(priceAt(IW.GRID)),
      'class': cls, 'clip-path': 'url(#plot-clip)'
    }));
  }

  function lineFn(line) { return function (q) { return IW.linePriceAt(line, q); }; }

  // Group observations at (nearly) the same spot so their labels share one tag.
  function clusters(observations) {
    var out = [];
    observations.forEach(function (o, i) {
      for (var c = 0; c < out.length; c++) {
        if (Math.abs(out[c].Q - o.Q) < 0.5 && Math.abs(out[c].P - o.P) < 0.5) { out[c].labels.push(o.label); out[c].idx.push(i); return; }
      }
      out.push({ Q: o.Q, P: o.P, labels: [o.label], idx: [i] });
    });
    return out;
  }

  /* view = { commodity, observations, highlight (index|null), draft (partial line), found {supply, demand} lines,
              revealed { supply: priceAt, demand: priceAt } | null } */
  function render(svg, view) {
    var c = view.commodity;
    // Keep <title>/<desc>; rebuild everything else.
    Array.prototype.slice.call(svg.childNodes).forEach(function (n) {
      if (n.nodeName !== 'title' && n.nodeName !== 'desc') svg.removeChild(n);
    });
    var defs = el('defs', {});
    var clip = el('clipPath', { id: 'plot-clip' });
    clip.appendChild(el('rect', { x: LEFT, y: TOP, width: SIZE, height: SIZE }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var g = el('g', { 'aria-hidden': 'true' });
    svg.appendChild(g);
    g.appendChild(el('rect', { x: LEFT, y: TOP, width: SIZE, height: SIZE, 'class': 'plot-bg', 'data-plot': '1' }));

    for (var v = 0; v <= IW.GRID; v += 50) {
      if (v > 0) {
        g.appendChild(el('line', { x1: x(v), y1: TOP, x2: x(v), y2: TOP + SIZE, 'class': 'gridline' }));
        g.appendChild(el('line', { x1: LEFT, y1: y(v), x2: LEFT + SIZE, y2: y(v), 'class': 'gridline' }));
      }
      g.appendChild(el('text', { x: x(v), y: TOP + SIZE + 16, 'class': 'tick', 'text-anchor': 'middle' }, tickLabel(c.quantity, v)));
      g.appendChild(el('text', { x: LEFT - 6, y: y(v) + 4, 'class': 'tick', 'text-anchor': 'end' }, tickLabel(c.price, v)));
    }
    g.appendChild(el('line', { x1: LEFT, y1: TOP + SIZE, x2: LEFT + SIZE, y2: TOP + SIZE, 'class': 'axis' }));
    g.appendChild(el('line', { x1: LEFT, y1: TOP, x2: LEFT, y2: TOP + SIZE, 'class': 'axis' }));
    g.appendChild(el('text', { x: LEFT + SIZE / 2, y: TOP + SIZE + 38, 'class': 'axis-title', 'text-anchor': 'middle' }, c.quantity.title));
    g.appendChild(el('text', { x: 14, y: TOP + SIZE / 2, 'class': 'axis-title', 'text-anchor': 'middle',
      transform: 'rotate(-90 14 ' + (TOP + SIZE / 2) + ')' }, c.price.title));

    if (view.revealed) {
      drawLine(g, view.revealed.supply, 'curve curve--supply');
      drawLine(g, view.revealed.demand, 'curve curve--demand');
    }
    ['supply', 'demand'].forEach(function (kind) {
      var f = view.found && view.found[kind];
      if (f) drawLine(g, lineFn(f), 'curve curve--' + kind + (view.revealed ? ' curve--student' : ''));
    });

    var d = view.draft;
    if (d && !IW.lineCheck(d)) drawLine(g, lineFn(d), 'draft');

    clusters(view.observations).forEach(function (cl) {
      var hot = view.highlight != null && cl.idx.indexOf(view.highlight) !== -1;
      var dim = view.highlight != null && !hot;
      g.appendChild(el('circle', { cx: x(cl.Q), cy: y(cl.P), r: hot ? 6 : 4.5, 'class': 'obs' + (hot ? ' obs--hot' : '') + (dim ? ' obs--dim' : '') }));
      g.appendChild(el('text', { x: x(cl.Q) + 7, y: y(cl.P) - 7, 'class': 'obs-label' + (dim ? ' obs--dim' : '') }, cl.labels.join(', ')));
    });

    if (d) {
      [1, 2].forEach(function (end) {
        var q = d['q' + end], p = d['p' + end];
        if (typeof q !== 'number' || typeof p !== 'number' || !isFinite(q) || !isFinite(p) ||
            q < 0 || q > IW.GRID || p < 0 || p > IW.GRID) return;
        var hg = el('g', { 'class': 'handle', 'data-end': end });
        hg.appendChild(el('circle', { cx: x(q), cy: y(p), r: 11, 'class': 'handle__hit', 'data-end': end }));
        hg.appendChild(el('circle', { cx: x(q), cy: y(p), r: 6.5, 'class': 'handle__dot', 'data-end': end }));
        hg.appendChild(el('text', { x: x(q), y: y(p) + 3.5, 'class': 'handle__num', 'text-anchor': 'middle', 'data-end': end }, String(end)));
        g.appendChild(hg);
      });
    }
  }

  // Convert a pointer event to grid coordinates (clamped to the plot).
  function toGrid(svg, evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var m = svg.getScreenCTM();
    if (!m) return null;
    var s = pt.matrixTransform(m.inverse());
    var q = (s.x - LEFT) / K, p = IW.GRID - (s.y - TOP) / K;
    var inside = q >= -4 && q <= IW.GRID + 4 && p >= -4 && p <= IW.GRID + 4;
    return { q: Math.min(IW.GRID, Math.max(0, q)), p: Math.min(IW.GRID, Math.max(0, p)), inside: inside };
  }

  root.InvisibleWorldGraph = { render: render, toGrid: toGrid };
})(this);
