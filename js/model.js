/* The Invisible World — economic model (no DOM).
   Economic concept: David Friedman (Living Paper, Proposal 5). Implementation: Eric McKee.
   Classic script: exposes window.InvisibleWorld in the browser and module.exports under Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InvisibleWorld = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Friedman's model lives on a 0–200 grid for both price and quantity:
     supply Qs = As + Bs*P, demand Qd = Ad - Bd*P. Commodities map the grid to economic units. */
  var GRID = 200;
  var LEVELS = 5;
  var CONFIG = {
    startScore: 100,
    observationCost: 5,
    wrongCost: 10,
    maxObservations: 12,
    tolerance: 3,          // grid units of price (1.5% of the price axis)
    gradePadding: 10,      // grading window extends this far beyond the observed quantities
    equilibriumMargin: 15, // every possible equilibrium lies in [15, 185] on both axes
    shiftRange: [12, 26],  // intercept shift per level step, in quantity units
    minPointMove: 9,       // one step of any active variable moves the point at least this far
    minCurveShift: 6,      // ...and moves each curve it affects at least this far vertically (2x tolerance)
    snapDistance: 6        // pointer clicks this close to an observation snap onto it
  };
  var AMBIGUOUS_ROLES = ['supply', 'demand', 'both', 'neither'];

  var COMMODITIES = [
    {
      id: 'wool',
      name: 'Wool',
      price: { title: 'Price of wool (dollars per pound)', scale: 0.02, decimals: 2, prefix: '$', suffix: '' },
      quantity: { title: 'Quantity of wool (millions of pounds per year)', scale: 1, decimals: 1, prefix: '', suffix: ' million lb' },
      variables: [
        { id: 'lamb', name: 'Price of lamb', kind: 'supply',
          levels: ['$1.50/lb', '$2.00/lb', '$2.50/lb', '$3.00/lb', '$3.50/lb'],
          signs: { supply: 1, demand: 0 },
          story: 'Wool and lamb are joint products: when lamb pays better, ranchers keep bigger flocks and shear more wool.' },
        { id: 'fashion', name: 'Fashion for wool', kind: 'demand',
          levels: ['Very out', 'Out', 'Neutral', 'In', 'Very in'],
          signs: { supply: 0, demand: 1 },
          story: 'When wool clothing is in fashion, buyers want more of it at every price.' },
        { id: 'winter', name: 'Winter weather', kind: 'ambiguous',
          levels: ['Very mild', 'Mild', 'Normal', 'Cold', 'Very cold'],
          signs: { supply: -1, demand: 1 },
          story: { supply: 'Hard winters kill sheep and shrink flocks, reducing supply.',
                   demand: 'Cold winters make people want warm wool clothing, raising demand.' } }
      ]
    },
    {
      id: 'icecream',
      name: 'Ice cream',
      price: { title: 'Price of ice cream (dollars per gallon)', scale: 0.05, decimals: 2, prefix: '$', suffix: '' },
      quantity: { title: 'Quantity of ice cream (millions of gallons per year)', scale: 5, decimals: 0, prefix: '', suffix: ' million gal' },
      variables: [
        { id: 'milk', name: 'Price of milk', kind: 'supply',
          levels: ['$2.50/gal', '$3.00/gal', '$3.50/gal', '$4.00/gal', '$4.50/gal'],
          signs: { supply: -1, demand: 0 },
          story: 'Milk is the main input: dearer milk raises the cost of every gallon of ice cream, reducing supply.' },
        { id: 'froyo', name: 'Price of frozen yogurt', kind: 'demand',
          levels: ['$3/pint', '$4/pint', '$5/pint', '$6/pint', '$7/pint'],
          signs: { supply: 0, demand: 1 },
          story: 'Frozen yogurt is a substitute: when it costs more, shoppers switch toward ice cream.' },
        { id: 'heat', name: 'Summer heat', kind: 'ambiguous',
          levels: ['Cool', 'Mild', 'Warm', 'Hot', 'Heat wave'],
          signs: { supply: -1, demand: 1 },
          story: { supply: 'Heat-stressed dairy cows give less milk, raising costs and reducing supply.',
                   demand: 'Hot weather makes people want more ice cream, raising demand.' } }
      ]
    },
    {
      id: 'homes',
      name: 'New homes',
      price: { title: 'Price of a new home (thousands of dollars)', scale: 3, decimals: 0, prefix: '$', suffix: 'k' },
      quantity: { title: 'New homes built per year', scale: 10, decimals: 0, prefix: '', suffix: ' homes' },
      variables: [
        { id: 'lumber', name: 'Price of lumber', kind: 'supply',
          levels: ['$400/mbf', '$500/mbf', '$600/mbf', '$700/mbf', '$800/mbf'],
          signs: { supply: -1, demand: 0 },
          story: 'Lumber is a major building cost: dearer lumber makes each house costlier to build, reducing supply.' },
        { id: 'jobs', name: 'Local job growth', kind: 'demand',
          levels: ['-2%', '-1%', '0%', '+1%', '+2%'],
          signs: { supply: 0, demand: 1 },
          story: 'More local jobs bring more households looking for homes, raising demand.' },
        { id: 'mortgage', name: 'Mortgage interest rate', kind: 'ambiguous',
          levels: ['4%', '5%', '6%', '7%', '8%'],
          signs: { supply: -1, demand: -1 },
          story: { supply: 'Builders borrow to finance construction, so higher rates raise their costs and reduce supply.',
                   demand: 'Higher mortgage rates make buying a home costlier, reducing demand.' } }
      ]
    }
  ];

  /* ---------- Seeded randomness ---------- */
  var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function hashString(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomCode(rand) {
    rand = rand || Math.random;
    var s = '';
    for (var i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
    return s;
  }

  function normalizeCode(code) {
    var clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    return clean.length ? clean : null;
  }

  function getCommodity(id) {
    for (var i = 0; i < COMMODITIES.length; i++) if (COMMODITIES[i].id === id) return COMMODITIES[i];
    return null;
  }

  /* ---------- World construction ---------- */
  function uniform(rng, lo, hi) { return lo + (hi - lo) * rng(); }

  // Intercepts for a settings vector [level0, level1, level2], each level 0..4 (2 = centre).
  function intercepts(world, settings) {
    var As = world.As0, Ad = world.Ad0;
    for (var i = 0; i < 3; i++) {
      var d = settings[i] - 2;
      As += world.effects[i].supply * d;
      Ad += world.effects[i].demand * d;
    }
    return { As: As, Ad: Ad };
  }

  function equilibriumFrom(Bs, Bd, As, Ad) {
    var P = (Ad - As) / (Bs + Bd);
    return { P: P, Q: As + Bs * P };
  }

  function equilibrium(world, settings) {
    var k = intercepts(world, settings);
    return equilibriumFrom(world.Bs, world.Bd, k.As, k.Ad);
  }

  function allSettings() {
    var out = [];
    for (var a = 0; a < LEVELS; a++)
      for (var b = 0; b < LEVELS; b++)
        for (var c = 0; c < LEVELS; c++) out.push([a, b, c]);
    return out;
  }
  var ALL_SETTINGS = allSettings();

  // Friedman's conditions 1–3 (curves stay inside the 200x200 box and cross inside it), plus our margin.
  function friedmanConditions(Bs, Bd, As, Ad) {
    return Bs > 1 && Bs < 5 && Bd > 1 && Bd < 5 &&
      As > GRID - GRID * Bs && As < 0 &&
      Ad > GRID && Ad < GRID * Bd &&
      Ad / Bd > -As / Bs &&
      (Ad - GRID) / Bd < (GRID - As) / Bs;
  }

  function validateWorld(world) {
    var lo = CONFIG.equilibriumMargin, hi = GRID - CONFIG.equilibriumMargin;
    for (var i = 0; i < ALL_SETTINGS.length; i++) {
      var k = intercepts(world, ALL_SETTINGS[i]);
      if (!friedmanConditions(world.Bs, world.Bd, k.As, k.Ad)) return false;
      var e = equilibriumFrom(world.Bs, world.Bd, k.As, k.Ad);
      if (!(e.P >= lo && e.P <= hi && e.Q >= lo && e.Q <= hi)) return false;
    }
    // Every active variable must move the observed point visibly per step.
    for (var v = 0; v < 3; v++) {
      var dAs = world.effects[v].supply, dAd = world.effects[v].demand;
      if (dAs === 0 && dAd === 0) continue;
      var dP = (dAd - dAs) / (world.Bs + world.Bd);
      var dQ = dAs + world.Bs * dP;
      if (Math.sqrt(dP * dP + dQ * dQ) < CONFIG.minPointMove) return false;
      if (dAs !== 0 && Math.abs(dAs) / world.Bs < CONFIG.minCurveShift) return false;
      if (dAd !== 0 && Math.abs(dAd) / world.Bd < CONFIG.minCurveShift) return false;
    }
    return true;
  }

  function createWorld(commodityId, code) {
    var commodity = getCommodity(commodityId) || COMMODITIES[0];
    code = normalizeCode(code) || randomCode();
    var rng = mulberry32(hashString(code + ':' + commodity.id));
    var ambiguousRole = AMBIGUOUS_ROLES[Math.floor(rng() * AMBIGUOUS_ROLES.length)];
    var world = null;
    for (var attempt = 0; attempt < 50000; attempt++) {
      var w = {
        Bs: uniform(rng, 1.1, 4.9),
        Bd: uniform(rng, 1.1, 4.9),
        effects: []
      };
      var P0 = uniform(rng, 60, 140), Q0 = uniform(rng, 60, 140);
      w.As0 = Q0 - w.Bs * P0;
      w.Ad0 = Q0 + w.Bd * P0;
      for (var v = 0; v < 3; v++) {
        var spec = commodity.variables[v];
        var affectsSupply = spec.kind === 'supply' ||
          (spec.kind === 'ambiguous' && (ambiguousRole === 'supply' || ambiguousRole === 'both'));
        var affectsDemand = spec.kind === 'demand' ||
          (spec.kind === 'ambiguous' && (ambiguousRole === 'demand' || ambiguousRole === 'both'));
        w.effects.push({
          supply: affectsSupply ? spec.signs.supply * uniform(rng, CONFIG.shiftRange[0], CONFIG.shiftRange[1]) : 0,
          demand: affectsDemand ? spec.signs.demand * uniform(rng, CONFIG.shiftRange[0], CONFIG.shiftRange[1]) : 0
        });
      }
      if (validateWorld(w)) { world = w; break; }
    }
    if (!world) throw new Error('Could not generate a valid world for ' + code);
    world.code = code;
    world.commodity = commodity;
    world.ambiguousRole = ambiguousRole;
    world.initial = [Math.floor(rng() * LEVELS), Math.floor(rng() * LEVELS), Math.floor(rng() * LEVELS)];
    return world;
  }

  /* ---------- Curves and grading (all in grid units) ---------- */
  function trueCurve(world, kind, settings) {
    var k = intercepts(world, settings);
    if (kind === 'supply') return { kind: kind, priceAt: function (q) { return (q - k.As) / world.Bs; } };
    return { kind: kind, priceAt: function (q) { return (k.Ad - q) / world.Bd; } };
  }

  function lineCheck(line) {
    if (!line || [line.q1, line.p1, line.q2, line.p2].some(function (x) { return typeof x !== 'number' || !isFinite(x); }))
      return 'incomplete';
    if ([line.q1, line.p1, line.q2, line.p2].some(function (x) { return x < 0 || x > GRID; }))
      return 'bounds';
    if (Math.abs(line.q2 - line.q1) < 1e-9) return 'vertical';
    return null;
  }

  function linePriceAt(line, q) {
    var m = (line.p2 - line.p1) / (line.q2 - line.q1);
    return line.p1 + m * (q - line.q1);
  }

  function lineThrough(a, b) {
    return { q1: a.Q, p1: a.P, q2: b.Q, p2: b.P };
  }

  // Quantity window over which a curve is judged: the observed quantities, padded, inside the box.
  function gradeWindow(observations) {
    var qs = observations.map(function (o) { return o.Q; });
    var lo = Math.max(0, Math.min.apply(null, qs) - CONFIG.gradePadding);
    var hi = Math.min(GRID, Math.max.apply(null, qs) + CONFIG.gradePadding);
    return [lo, hi];
  }

  function gradeCurve(world, line, kind, settings, observations) {
    var problem = lineCheck(line);
    if (problem) return { valid: false, error: problem };
    // Repeated equilibria are one piece of evidence, even if they cost another observation.
    if (observations.length < 2 || !observations.some(function (o) {
      return Math.abs(o.Q - observations[0].Q) > 1e-9;
    })) return { valid: false, error: 'evidence' };
    var curve = trueCurve(world, kind, settings);
    var win = gradeWindow(observations);
    var dev = Math.max(Math.abs(linePriceAt(line, win[0]) - curve.priceAt(win[0])),
                       Math.abs(linePriceAt(line, win[1]) - curve.priceAt(win[1])));
    var slope = (line.p2 - line.p1) / (line.q2 - line.q1);
    var direction = kind === 'supply' ? slope > 0 : slope < 0;
    return { valid: true, correct: direction && dev <= CONFIG.tolerance, deviation: dev, window: win };
  }

  /* ---------- Scoring ---------- */
  // state: { observations: n, wrong: n, found: { supply: bool, demand: bool } }
  function runningScore(state) {
    var s = CONFIG.startScore - CONFIG.observationCost * Math.max(0, state.observations - 1) - CONFIG.wrongCost * state.wrong;
    return Math.max(0, s);
  }

  function finalScore(state) {
    var running = runningScore(state);
    var count = (state.found.supply ? 1 : 0) + (state.found.demand ? 1 : 0);
    var final = count === 2 ? running : count === 1 ? Math.round(running / 2) : 0;
    return {
      running: running,
      curvesFound: count,
      observationPenalty: CONFIG.observationCost * Math.max(0, state.observations - 1),
      wrongPenalty: CONFIG.wrongCost * state.wrong,
      final: final
    };
  }

  /* ---------- Replay explanations ---------- */
  function same(a, b) { return Math.abs(a - b) < 1e-9; }

  function describeStep(world, prev, cur) {
    var a = intercepts(world, prev.settings), b = intercepts(world, cur.settings);
    var changed = [];
    for (var i = 0; i < 3; i++) if (prev.settings[i] !== cur.settings[i]) changed.push(world.commodity.variables[i].name);
    var supplyShift = !same(a.As, b.As), demandShift = !same(a.Ad, b.Ad);
    var pair = prev.label + ' and ' + cur.label;
    var what = changed.length ? 'You changed ' + joinList(changed.map(lower)) + '. ' : 'You changed nothing. ';
    var text;
    if (!supplyShift && !demandShift) {
      text = what + (changed.length ? 'Neither curve moved, so ' + cur.label + ' landed on ' + prev.label + '.'
                                    : 'Same conditions, same point.');
    } else if (supplyShift && !demandShift) {
      text = what + 'Supply shifted and demand did not, so ' + pair + ' lie on the same demand curve.';
    } else if (!supplyShift && demandShift) {
      text = what + 'Demand shifted and supply did not, so ' + pair + ' lie on the same supply curve.';
    } else {
      text = what + 'Both curves shifted, so the line through ' + pair + ' is neither curve.';
    }
    return { changed: changed, supplyShift: supplyShift, demandShift: demandShift, text: text };
  }

  // Labels of observations sharing each curve with observations[index].
  function sharedCurves(world, observations, index) {
    var k = intercepts(world, observations[index].settings);
    var supply = [], demand = [];
    observations.forEach(function (o) {
      var j = intercepts(world, o.settings);
      if (same(j.As, k.As)) supply.push(o.label);
      if (same(j.Ad, k.Ad)) demand.push(o.label);
    });
    return { supply: supply, demand: demand };
  }

  function ambiguousExplanation(world) {
    var spec = world.commodity.variables[2];
    var role = world.ambiguousRole;
    var name = spec.name;
    if (role === 'neither') return name + ' had no effect on either curve in this world.';
    if (role === 'both') return name + ' shifted both curves in this world. ' + spec.story.supply + ' ' + spec.story.demand;
    return name + ' affected only ' + role + ' in this world. ' + spec.story[role];
  }

  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function joinList(items) {
    if (items.length <= 1) return items.join('');
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  /* ---------- Units ---------- */
  function round(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }

  function toDisplay(axis, grid) { return round(grid * axis.scale, axis.decimals); }
  function fromDisplay(axis, value) { return value / axis.scale; }
  function formatAxis(axis, grid, withSuffix) {
    var v = toDisplay(axis, grid);
    var s = v.toLocaleString('en-US', { minimumFractionDigits: axis.decimals, maximumFractionDigits: axis.decimals });
    return axis.prefix + s + (withSuffix === false ? '' : axis.suffix);
  }

  function observationLabel(i) { return String.fromCharCode(65 + i); }

  return {
    GRID: GRID,
    LEVELS: LEVELS,
    CONFIG: CONFIG,
    COMMODITIES: COMMODITIES,
    AMBIGUOUS_ROLES: AMBIGUOUS_ROLES,
    getCommodity: getCommodity,
    randomCode: randomCode,
    normalizeCode: normalizeCode,
    hashString: hashString,
    mulberry32: mulberry32,
    createWorld: createWorld,
    validateWorld: validateWorld,
    friedmanConditions: friedmanConditions,
    allSettings: allSettings,
    intercepts: intercepts,
    equilibrium: equilibrium,
    trueCurve: trueCurve,
    lineCheck: lineCheck,
    linePriceAt: linePriceAt,
    lineThrough: lineThrough,
    gradeWindow: gradeWindow,
    gradeCurve: gradeCurve,
    runningScore: runningScore,
    finalScore: finalScore,
    describeStep: describeStep,
    sharedCurves: sharedCurves,
    ambiguousExplanation: ambiguousExplanation,
    toDisplay: toDisplay,
    fromDisplay: fromDisplay,
    formatAxis: formatAxis,
    observationLabel: observationLabel
  };
});
