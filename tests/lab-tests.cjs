'use strict';
const assert = require('node:assert/strict');
const IW = require('../js/model.js');
const Lab = require('../js/lab.js');
let checks = 0;
function ok(condition, text) { assert.ok(condition, text); checks++; }
for (const c of IW.COMMODITIES) {
  const changes = Lab.changes(c, [2, 2, 2], [4, 2, 0]);
  ok(changes.length === 2 && changes[0].name === c.variables[0].name, 'only changed conditions included');
  ok(changes[1].from === c.variables[2].levels[2] && changes[1].to === c.variables[2].levels[0], 'condition labels preserved');
  const w = IW.createWorld(c.id, 'LAB001');
  const a = { label:'A', settings:[2,2,2], ...IW.equilibrium(w,[2,2,2]) };
  const b = { label:'B', settings:[3,2,2], ...IW.equilibrium(w,[3,2,2]), baseline:0 };
  b.prediction = { price:Lab.direction(a.P,b.P),quantity:Lab.direction(a.Q,b.Q),reason:'Hold demand fixed.' };
  ok(Lab.predictionResult([a,b],b).every(p=>p.correct), 'predictions compare with chosen baseline');
  ok(Lab.predictionResult([a,b],a).length === 0, 'missing prediction remains unscored');
  const record = {commodity:c,code:w.code,observations:[a,b],phase:'play',found:[],score:95,reflection:''};
  const csv = Lab.csvRecord(record);
  ok(csv.startsWith('\uFEFF') && csv.includes(c.price.title), 'CSV includes encoding marker and price units');
  ok(!csv.includes(w.Bs.toString()) && !csv.includes(w.ambiguousRole), 'active-game CSV contains no hidden world parameters');
  ok(csv.includes('"play","","",""'), 'final score absent until finish');
  record.phase='done';record.found=['demand'];record.score=48;record.reflection='A and B hold demand fixed.';
  ok(Lab.csvRecord(record).includes('"done","demand",48,"A and B hold demand fixed."'), 'finished CSV includes score and reflection');
}
for(const dangerous of ['=SUM(1,2)','+1','-2','@SUM(A1)','\t=1','\n=1','   =1'])
  ok(Lab.csvCell(dangerous).startsWith('"\''), 'spreadsheet formula prefix neutralized');
ok(Lab.csvCell('Reason: "one",\ntwo') === '"Reason: ""one"",\ntwo"', 'quotes, commas and newlines preserved');
ok(Lab.csvCell(12.5)==='12.5', 'numeric observations remain numeric');
ok(Lab.direction(2,2)==='same' && Lab.direction(2,3)==='up' && Lab.direction(3,2)==='down', 'prediction directions');
console.log(checks+' notebook checks passed');
