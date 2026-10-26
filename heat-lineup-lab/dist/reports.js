// These summaries describe observed individual profiles, not lineup forecasts.
export const HIGHER_BETTER = new Set([
  'ts_pct','per','orb_pct','drb_pct','trb_pct','ast_pct','stl_pct','blk_pct',
  'obpm','dbpm','bpm','ws_per_48',
]);
export const LOWER_BETTER = new Set(['tov_pct']);
export function metricDirection(key, delta) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0000001) return 'unchanged';
  const direction = HIGHER_BETTER.has(key) ? 1 : LOWER_BETTER.has(key) ? -1 : 0;
  if (!direction) return 'context';
  return delta * direction > 0 ? 'benefit' : 'drawback';
}
const display = (value, type='pct') => Number.isFinite(value)
  ? type==='ratio' ? `${(value*100).toFixed(1)}%`
    : `${value.toFixed(1)}${type==='pct'?'%':''}` : 'unavailable';
const facts = [
  ['ts_pct','Scoring efficiency','true shooting','pct'],
  ['tov_pct','Ball security','turnover percentage','pct'],
  ['ast_pct','Playmaking signal','assist percentage','pct'],
  ['drb_pct','Defensive rebounding','defensive rebound percentage','pct'],
  ['orb_pct','Offensive rebounding','offensive rebound percentage','pct'],
  ['dbpm','Defensive impact estimate','defensive BPM','number'],
  ['obpm','Offensive impact estimate','offensive BPM','number'],
];
export function swapReport(before, after) {
  if (before.id===after.id) return {
    title:`${after.name} at this position`,benefits:[],drawbacks:[],
    context:['Make a substitution to see the incoming player’s advantages and tradeoffs against the player being replaced.'],
  };
  if (!before.stats || !after.stats) return {
    title:`${after.name} for ${before.name}`,benefits:[],drawbacks:[],
    context:[`${!before.stats?before.name:after.name} has no baseline history in the source. A missing profile cannot be treated as zero or rated as an upgrade.`],
  };
  const benefits=[],drawbacks=[],context=[];
  for (const [key,title,label,type] of facts) {
    const a=before.stats[key],b=after.stats[key];
    if (!Number.isFinite(a)||!Number.isFinite(b)) continue;
    const kind=metricDirection(key,b-a);
    const text=`${title}: ${display(a,type)} → ${display(b,type)} ${label}.`;
    if (kind==='benefit') benefits.push(text);
    if (kind==='drawback') drawbacks.push(text);
  }
  const rateBefore=before.stats.three_point_attempt_rate,rateAfter=after.stats.three_point_attempt_rate;
  if (Number.isFinite(rateBefore)&&Number.isFinite(rateAfter)&&rateBefore!==rateAfter)
    context.push(`Three-point shot share changes from ${display(rateBefore,'ratio')} to ${display(rateAfter,'ratio')}. That changes the shooting profile; it does not establish better accuracy or spacing.`);
  if (Number.isFinite(before.stats.usg_pct)&&Number.isFinite(after.stats.usg_pct)&&before.stats.usg_pct!==after.stats.usg_pct)
    context.push(`Usage changes from ${display(before.stats.usg_pct)} to ${display(after.stats.usg_pct)}. More or less offensive involvement can help depending on the other four players.`);
  context.push(`${after.name}: ${after.stats.games} games / ${after.stats.minutes.toLocaleString()} minutes; ${before.name}: ${before.stats.games} games / ${before.stats.minutes.toLocaleString()} minutes. These were different team and opponent contexts.`);
  return {title:`${after.name} for ${before.name}`,benefits:benefits.slice(0,3),drawbacks:drawbacks.slice(0,3),context};
}
export function lineupReport(five) {
  const known=five.filter(p=>p.stats);
  const established=known.filter(p=>p.stats.minutes>=500);
  const pool=established.length?established:known;
  const strengths=[],weaknesses=[],context=[];
  if (!known.length) return {strengths,weaknesses:['No historical profiles are available for this five.'],context:['Collective performance cannot be estimated from missing history.']};
  const sorted = (key, source=pool) => source.filter(p=>Number.isFinite(p.stats[key])).toSorted((a,b)=>b.stats[key]-a.stats[key]);
  const creator=sorted('ast_pct')[0];
  if (creator) strengths.push(`Passing option: ${creator.name} has the highest observed assist percentage in this group (${display(creator.stats.ast_pct)}).`);
  const efficient=sorted('ts_pct')[0];
  if (efficient) strengths.push(`Scoring efficiency: ${efficient.name} leads the established profiles at ${display(efficient.stats.ts_pct)} true shooting. This includes free throws, not just jump shooting.`);
  const perimeter=known.filter(p=>p.stats.three_point_attempt_rate>=0.4).sort((a,b)=>b.stats.three_point_attempt_rate-a.stats.three_point_attempt_rate);
  if (perimeter.length>=2) strengths.push(`Perimeter shot profiles: ${perimeter.slice(0,2).map(p=>`${p.name} (${display(p.stats.three_point_attempt_rate,'ratio')})`).join(' and ')} took at least 40% of their shots from three. Accuracy still needs to be checked.`);
  const rebounder=sorted('drb_pct')[0];
  if (rebounder) strengths.push(`Rebounding option: ${rebounder.name} collected an estimated ${display(rebounder.stats.drb_pct)} of available defensive rebounds while on court.`);
  const interior=known.filter(p=>Number.isFinite(p.stats.three_point_attempt_rate)&&p.stats.three_point_attempt_rate<0.2);
  if (interior.length) weaknesses.push(`Spacing question: ${interior.map(p=>`${p.name} (${display(p.stats.three_point_attempt_rate,'ratio')})`).join(', ')} took fewer than 20% of shots from three. Review how the other players create room; this is a shot-profile signal, not measured spacing.`);
  const highUsage=known.filter(p=>p.stats.usg_pct>=25).sort((a,b)=>b.stats.usg_pct-a.stats.usg_pct);
  if (highUsage.length>=2) weaknesses.push(`Role overlap to resolve: ${highUsage.map(p=>`${p.name} (${display(p.stats.usg_pct)} usage)`).join(' and ')} previously used a large share of plays. Their usage rates cannot be added together.`);
  const defense=sorted('dbpm').toReversed().filter(p=>p.stats.dbpm<0);
  if (defense.length) weaknesses.push(`Defensive signal to review: ${defense[0].name} had ${display(defense[0].stats.dbpm,'number')} defensive BPM. Matchup and film evidence are needed before calling the five a weak defensive unit.`);
  const thin=known.filter(p=>p.stats.minutes<500);
  const missing=five.filter(p=>!p.stats);
  if (missing.length) weaknesses.unshift(`Missing evidence: ${missing.map(p=>p.name).join(', ')} ${missing.length===1?'has':'have'} no baseline profile. The five-player assessment is incomplete.`);
  if (thin.length) weaknesses.unshift(`Limited sample: ${thin.map(p=>`${p.name} (${p.stats.minutes} minutes)`).join(', ')}. Strong-looking rates may not hold over a larger role.`);
  context.push('Summaries describe player options and possible fit questions. They do not predict team offensive rating, defensive rating, or net rating.');
  context.push('Rules: perimeter profile ≥40% three-point shot share; low perimeter share <20%; high usage ≥25%. Leaders use players with ≥500 source minutes when available. These are transparent screening rules, not learned lineup effects.');
  return {strengths:strengths.slice(0,4),weaknesses:weaknesses.slice(0,4),context};
}
