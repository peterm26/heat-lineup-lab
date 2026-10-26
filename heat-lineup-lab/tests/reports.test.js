import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {metricDirection,swapReport,lineupReport} from '../dist/reports.js';
import {DEFAULT_FIVE} from '../dist/model.js';
const players=JSON.parse(fs.readFileSync(new URL('../dist/players.json',import.meta.url))).players;
const find=id=>players.find(p=>p.id===id);
test('lower turnover percentage is favorable and higher is unfavorable',()=>{
  assert.equal(metricDirection('tov_pct',-3.1),'benefit');
  assert.equal(metricDirection('tov_pct',3.1),'drawback');
});
test('higher efficiency is favorable while lower defensive BPM is unfavorable',()=>{
  assert.equal(metricDirection('ts_pct',8.3),'benefit');
  assert.equal(metricDirection('dbpm',-.4),'drawback');
});
test('usage, perimeter volume, free-throw rate and cumulative value stay contextual',()=>{
  for(const key of ['usg_pct','three_point_attempt_rate','free_throw_attempt_rate','ws','vorp'])
    assert.equal(metricDirection(key,1),'context');
});
test('missing and unchanged values are not labeled good or bad',()=>{
  assert.equal(metricDirection('ts_pct',null),'unchanged');
  assert.equal(metricDirection('ts_pct',0),'unchanged');
});
test('real supplied swap has benefits and drawbacks with exact evidence',()=>{
  const r=swapReport(find(202691),find(203501));
  assert.ok(r.benefits.some(t=>t.includes('54.1% → 62.4%')));
  assert.ok(r.benefits.some(t=>t.includes('7.8% → 4.7%')));
  assert.ok(r.drawbacks.some(t=>t.includes('-1.5 → -1.9')));
  assert.ok(r.context.some(t=>t.includes('does not establish better accuracy')));
});
test('no substitution does not manufacture pros or cons',()=>{
  const r=swapReport(find(202691),find(202691));
  assert.equal(r.benefits.length,0);assert.equal(r.drawbacks.length,0);
});
test('missing history does not become zero or a false advantage',()=>{
  const r=swapReport(find(202691),find(1643553));
  assert.equal(r.benefits.length,0);assert.equal(r.drawbacks.length,0);
  assert.ok(r.context[0].includes('cannot be treated as zero'));
});
test('default five report has evidence, role overlap and explicit limits',()=>{
  const r=lineupReport(DEFAULT_FIVE.map(find));
  assert.ok(r.strengths.some(t=>t.includes('Klay Thompson')));
  assert.ok(r.weaknesses.some(t=>t.includes('Giannis Antetokounmpo')));
  assert.ok(r.weaknesses.some(t=>t.includes('usage rates cannot be added')));
  assert.ok(r.context.some(t=>t.includes('do not predict')));
});
test('a low-minute outlier does not displace an established efficiency leader',()=>{
  const five=[find(1642884),...DEFAULT_FIVE.slice(1).map(find)];
  const r=lineupReport(five);
  assert.ok(r.strengths.some(t=>t.includes('Scoring efficiency: Giannis')));
  assert.ok(r.weaknesses.some(t=>t.includes('Vladislav Goldin (24 minutes)')));
});
test('an entirely missing lineup returns uncertainty rather than grades',()=>{
  const r=lineupReport([find(1643553),find(1643621)]);
  assert.equal(r.strengths.length,0);assert.ok(r.weaknesses[0].includes('No historical'));
});
