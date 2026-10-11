/* Model tests for The Invisible World. Run: node tests/model-tests.cjs */
'use strict';
const IW = require('../js/model.js');

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('FAIL: ' + msg); } }
function close(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')'); }

const rand = IW.mulberry32(12345);
const SEEDS = Array.from({ length: 1000 }, () => IW.randomCode(rand));
const combos = IW.allSettings();
const roleCounts = {};

// 1. Every generated world satisfies Friedman's conditions and our margins for all 125 combinations.
for (const c of IW.COMMODITIES) {
  for (const seed of SEEDS) {
    const w = IW.createWorld(c.id, seed);
    roleCounts[w.ambiguousRole] = (roleCounts[w.ambiguousRole] || 0) + 1;
    ok(IW.validateWorld(w), c.id + ' ' + seed + ' fails validation');
    for (const s of combos) {
      const k = IW.intercepts(w, s);
      ok(IW.friedmanConditions(w.Bs, w.Bd, k.As, k.Ad), `${c.id} ${seed} ${s} Friedman conditions`);
      const e = IW.equilibrium(w, s);
      ok(e.P >= 15 && e.P <= 185 && e.Q >= 15 && e.Q <= 185, `${c.id} ${seed} ${s} equilibrium in margin`);
      // Qs = Qd at the equilibrium
      close(k.As + w.Bs * e.P, k.Ad - w.Bd * e.P, 1e-9, `${c.id} ${seed} Qs=Qd`);
    }
    // 2. Exclusion restrictions: supply-only variable never moves demand, demand-only never moves supply.
    ok(w.effects[0].demand === 0 && w.effects[0].supply !== 0, `${c.id} ${seed} supply shifter is supply-only`);
    ok(w.effects[1].supply === 0 && w.effects[1].demand !== 0, `${c.id} ${seed} demand shifter is demand-only`);
    const e2 = w.effects[2], role = w.ambiguousRole;
    ok((e2.supply !== 0) === (role === 'supply' || role === 'both'), `${c.id} ${seed} ambiguous supply matches role ${role}`);
    ok((e2.demand !== 0) === (role === 'demand' || role === 'both'), `${c.id} ${seed} ambiguous demand matches role ${role}`);
    // Signs follow the commodity story.
    for (let v = 0; v < 3; v++) {
      const spec = c.variables[v];
      if (w.effects[v].supply) ok(Math.sign(w.effects[v].supply) === spec.signs.supply, `${c.id} supply sign ${spec.id}`);
      if (w.effects[v].demand) ok(Math.sign(w.effects[v].demand) === spec.signs.demand, `${c.id} demand sign ${spec.id}`);
    }
  }
}
for (const r of IW.AMBIGUOUS_ROLES) ok((roleCounts[r] || 0) > 500, 'role ' + r + ' appears often: ' + roleCounts[r]);

// 3. Determinism.
{
  const a = IW.createWorld('wool', 'K7Q2MX'), b = IW.createWorld('wool', 'k7q2mx');
  ok(a.Bs === b.Bs && a.Ad0 === b.Ad0 && a.ambiguousRole === b.ambiguousRole && a.initial.join() === b.initial.join(), 'same code -> same world (case-insensitive)');
  const d = IW.createWorld('icecream', 'K7Q2MX');
  ok(a.Bs !== d.Bs, 'same code, different commodity -> different world');
}

// Helpers to build observations.
function obs(w, settings, i) { const e = IW.equilibrium(w, settings); return { label: IW.observationLabel(i), settings, P: e.P, Q: e.Q }; }
function worldWithRole(role, commodity = 'wool') {
  for (const seed of SEEDS) { const w = IW.createWorld(commodity, seed); if (w.ambiguousRole === role) return w; }
  throw new Error('no world with role ' + role);
}

// 4. Grading and the classroom acceptance scenario.
for (const c of IW.COMMODITIES) {
  for (const seed of SEEDS.slice(0, 200)) {
    const w = IW.createWorld(c.id, seed);
    const s0 = [2, 2, 2];
    const A = obs(w, s0, 0);
    const B = obs(w, [3, 2, 2], 1); // supply shifter only -> A,B on the same demand curve
    const C = obs(w, [2, 3, 2], 2); // demand shifter only -> A,C on the same supply curve
    const list = [A, B, C];
    const dLine = IW.lineThrough(A, B), sLine = IW.lineThrough(A, C);
    ok(IW.gradeCurve(w, dLine, 'demand', s0, list).correct, `${c.id} ${seed} demand through A,B accepted`);
    ok(IW.gradeCurve(w, sLine, 'supply', s0, list).correct, `${c.id} ${seed} supply through A,C accepted`);
    ok(!IW.gradeCurve(w, dLine, 'supply', s0, list).correct, `${c.id} ${seed} demand line rejected as supply`);
    ok(!IW.gradeCurve(w, IW.lineThrough(B, C), 'demand', s0, list).correct, `${c.id} ${seed} line through B,C rejected as demand`);
    ok(!IW.gradeCurve(w, IW.lineThrough(B, C), 'supply', s0, list).correct, `${c.id} ${seed} line through B,C rejected as supply`);
    // Demand at B's conditions is the same curve as at A's (only supply moved).
    ok(IW.gradeCurve(w, dLine, 'demand', B.settings, list).correct, `${c.id} ${seed} demand also correct at B`);
    // Wrong attachment: the supply line attached to B's conditions (supply moved) is rejected.
    ok(!IW.gradeCurve(w, sLine, 'supply', B.settings, list).correct, `${c.id} ${seed} supply at A rejected when attached to B`);
    // Table-precision entry: points rounded to display precision still pass.
    const r = (o) => ({ Q: IW.fromDisplay(c.quantity, IW.toDisplay(c.quantity, o.Q)), P: IW.fromDisplay(c.price, IW.toDisplay(c.price, o.P)) });
    ok(IW.gradeCurve(w, IW.lineThrough(r(A), r(B)), 'demand', s0, list).correct, `${c.id} ${seed} rounded table entry accepted`);
    // Explanation text agrees.
    ok(/same demand curve/.test(IW.describeStep(w, A, B).text), `${c.id} ${seed} A->B explanation`);
    ok(/same supply curve/.test(IW.describeStep(w, A, C).text), `${c.id} ${seed} A->C explanation`);
    const sh = IW.sharedCurves(w, list, 0);
    ok(sh.demand.join() === 'A,B' && sh.supply.join() === 'A,C', `${c.id} ${seed} shared curves ${JSON.stringify(sh)}`);
  }
}

// 5. Tolerance edge: a line parallel to the true curve, offset by 2.9 and 3.1 price units.
{
  const w = IW.createWorld('wool', 'EDGE01');
  const s = [2, 2, 2], A = obs(w, s, 0), list = [A, obs(w, [3, 2, 2], 1)];
  const curve = IW.trueCurve(w, 'demand', s);
  const at = (off) => ({ q1: 10, p1: curve.priceAt(10) + off, q2: 190, p2: curve.priceAt(190) + off });
  ok(IW.gradeCurve(w, at(2.9), 'demand', s, list).correct, 'offset 2.9 accepted');
  ok(!IW.gradeCurve(w, at(3.1), 'demand', s, list).correct, 'offset 3.1 rejected');
  ok(IW.gradeCurve(w, { q1: 50, p1: 10, q2: 50, p2: 90 }, 'demand', s, list).error === 'vertical', 'vertical line flagged');
  ok(IW.gradeCurve(w, { q1: 50, p1: NaN, q2: 60, p2: 90 }, 'demand', s, list).error === 'incomplete', 'incomplete line flagged');
}

// 6. Trap: when the ambiguous variable shifts both curves, points it generates are on neither curve.
{
  const w = worldWithRole('both');
  const A = obs(w, [2, 2, 2], 0), B = obs(w, [2, 2, 4], 1), list = [A, B];
  const line = IW.lineThrough(A, B);
  ok(!IW.gradeCurve(w, line, 'supply', A.settings, list).correct && !IW.gradeCurve(w, line, 'demand', A.settings, list).correct,
    'ambiguous "both" pair traces neither curve');
  ok(/neither curve/.test(IW.describeStep(w, A, B).text), 'both-shift explanation');
  const n = worldWithRole('neither');
  const A2 = obs(n, [2, 2, 1], 0), B2 = obs(n, [2, 2, 4], 1);
  close(A2.P, B2.P, 1e-12, '"neither" role leaves the point unchanged');
  ok(/Neither curve moved/.test(IW.describeStep(n, A2, B2).text), 'neither explanation');
}

// 7. Scoring.
{
  const f = (observations, wrong, s, d) => IW.finalScore({ observations, wrong, found: { supply: s, demand: d } });
  ok(f(3, 0, true, true).final === 90, 'scenario score 90');
  ok(f(1, 0, true, true).final === 100, 'impossible-but-defined perfect');
  ok(f(12, 0, true, true).final === 45, '12 observations -> 45');
  ok(f(5, 1, true, false).final === 35, 'one curve halves: (100-20-10)/2 = 35');
  ok(f(3, 0, false, false).final === 0, 'neither curve -> 0');
  ok(f(12, 9, true, true).final === 0 && IW.runningScore({ observations: 12, wrong: 9 }) === 0, 'floor at 0');
  ok(IW.CONFIG.maxObservations === 12, 'observation cap 12');
}

// 8. Units round-trip.
for (const c of IW.COMMODITIES) {
  close(IW.fromDisplay(c.price, IW.toDisplay(c.price, 200)) , 200, 1e-9, c.id + ' price axis top');
}
ok(IW.formatAxis(IW.getCommodity('wool').price, 105) === '$2.10', 'wool price format');
ok(IW.formatAxis(IW.getCommodity('homes').quantity, 123.4) === '1,234 homes', 'homes quantity format');

// 9. A repeated equilibrium cannot identify two curves within a narrow tolerance window.
{
  const w = IW.createWorld('wool', 'AUDIT235');
  const A = obs(w, w.initial, 0), B = obs(w, w.initial, 1);
  const flat = { q1: 0, p1: A.P, q2: 200, p2: A.P };
  for (const kind of ['supply', 'demand']) {
    ok(IW.gradeCurve(w, flat, kind, A.settings, [A, B]).error === 'evidence', 'duplicate equilibria give no identification evidence');
    const shifted = w.initial.slice(); shifted[0]++;
    const C = obs(w, shifted, 2);
    ok(!IW.gradeCurve(w, flat, kind, A.settings, [A, C]).correct, 'flat line cannot pass as ' + kind);
    ok(IW.gradeCurve(w, { ...flat, p1: -1 }, kind, A.settings, [A, C]).error === 'bounds', 'out-of-range endpoints refused');
  }
  // Direction is enforced even when a narrow window puts a wrong-signed line within tolerance.
  const almost = { ...A, Q: A.Q + 0.01, label: 'C' };
  const backwards = { q1: 0, p1: A.P + 0.2, q2: 200, p2: A.P - 0.2 };
  ok(!IW.gradeCurve(w, backwards, 'supply', A.settings, [A, almost]).correct, 'downward line cannot be supply');
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
