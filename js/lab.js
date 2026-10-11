/* Experiment notebook helpers. No hidden world parameters or browser dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.InvisibleWorldLab = factory(root.InvisibleWorld);
})(typeof self !== 'undefined' ? self : this, function (IW) {
  'use strict';

  function changes(commodity, before, after) {
    return commodity.variables.reduce(function (out, v, i) {
      if (before[i] !== after[i]) out.push({ name: v.name, from: v.levels[before[i]], to: v.levels[after[i]] });
      return out;
    }, []);
  }

  function direction(before, after) {
    return Math.abs(after - before) < 1e-9 ? 'same' : after > before ? 'up' : 'down';
  }

  function predictionResult(observations, observation) {
    var base = observations[observation.baseline];
    if (!base || !observation.prediction) return [];
    return ['price', 'quantity'].reduce(function (out, key) {
      var guess = observation.prediction[key];
      if (!guess) return out;
      var axis = key === 'price' ? 'P' : 'Q';
      var actual = direction(base[axis], observation[axis]);
      out.push({ axis: key, guess: guess, actual: actual, correct: guess === actual });
      return out;
    }, []);
  }

  // Quote all text and neutralize spreadsheet formula prefixes in student-authored fields.
  function csvCell(value) {
    if (typeof value === 'number') return String(value);
    var s = String(value == null ? '' : value);
    if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function csvRecord(record) {
    var c = record.commodity;
    var header = ['World', 'Market', 'Point'].concat(c.variables.map(function (v) { return v.name; }),
      [c.price.title, c.quantity.title, 'Compared with', 'Predicted price direction',
       'Predicted quantity direction', 'Experiment reasoning', 'Phase', 'Curves identified',
       'Final score (only after finish)', 'Reflection']);
    var rows = [header];
    record.observations.forEach(function (o) {
      var p = o.prediction || {}, base = record.observations[o.baseline];
      rows.push([record.code, c.name, o.label].concat(o.settings.map(function (level, i) {
        return c.variables[i].levels[level];
      }), [IW.toDisplay(c.price, o.P), IW.toDisplay(c.quantity, o.Q), base ? base.label : '',
        p.price || '', p.quantity || '', p.reason || '', record.phase,
        record.found.join('; '), record.phase === 'done' ? record.score : '', record.reflection || '']));
    });
    return '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  return { changes: changes, direction: direction, predictionResult: predictionResult,
    csvCell: csvCell, csvRecord: csvRecord };
});
