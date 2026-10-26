import { DEFAULT_FIVE, POSITIONS, validLineup, substitute, difference } from './model.js';
const $ = s => document.querySelector(s);
const STORAGE = 'heat-lineup-lab:v1';
const groups = {
  shooting: [
    ['ts_pct','TS%','Scoring efficiency including free throws; percentage points.', '%'],
    ['three_point_attempt_rate','3-point attempt rate','Share of field-goal attempts taken from three. Not shooting accuracy.', 'ratio%'],
    ['free_throw_attempt_rate','Free-throw rate','Free-throw attempts divided by field-goal attempts.', 'ratio'],
    ['usg_pct','Usage','Estimated percentage of team plays used while on court.', '%'],
  ],
  creation: [
    ['ast_pct','Assist percentage','Estimated percentage of teammate field goals assisted while on court.', '%'],
    ['tov_pct','Turnover percentage','Estimated turnovers per 100 individual plays. Not turnovers per 100 team possessions.', '%'],
    ['usg_pct','Usage','Estimated share of team plays used while on court.', '%'],
    ['obpm','Offensive BPM','Box-score estimate of offensive contribution per 100 possessions relative to average.', 'number'],
  ],
  defense: [
    ['drb_pct','Defensive rebounding','Estimated share of available defensive rebounds collected.', '%'],
    ['stl_pct','Steal percentage','Estimated share of opponent possessions ending in a steal by this player.', '%'],
    ['blk_pct','Block percentage','Estimated share of opponent two-point attempts blocked while on court.', '%'],
    ['dbpm','Defensive BPM','Box-score defensive impact estimate; does not fully measure defensive ability.', 'number'],
    ['orb_pct','Offensive rebounding','Estimated share of available offensive rebounds collected.', '%'],
    ['trb_pct','Total rebounding','Estimated share of available rebounds collected.', '%'],
  ],
  impact: [
    ['per','PER','Player Efficiency Rating, a box-score summary.', 'number'],
    ['bpm','BPM','Box-score impact estimate relative to an average player. Not raw plus/minus.', 'number'],
    ['obpm','Offensive BPM','Offensive component of Basketball Reference BPM.', 'number'],
    ['dbpm','Defensive BPM','Defensive component of Basketball Reference BPM.', 'number'],
    ['vorp','VORP','Season value over a replacement player; depends on playing time.', 'number'],
    ['ws','Win shares','Estimated season win contribution; depends on playing time.', 'number'],
    ['ows','Offensive win shares','Offensive component of win shares.', 'number'],
    ['dws','Defensive win shares','Defensive component of win shares.', 'number'],
    ['ws_per_48','Win shares / 48','Win shares normalized to 48 minutes.', 'precise'],
  ],
};
let data, players, lineup = [...DEFAULT_FIVE], selectedSlot = 0, pendingId = null, focus = 'shooting';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const player = id => players.find(p => p.id === id);
const initials = p => p.name.split(' ').slice(0,2).map(n => n[0]).join('');
const shortName = p => p.name === 'Tim Hardaway Jr.' ? 'Hardaway Jr.' : p.name === 'Bobby Portis Jr.' ? 'Portis Jr.' : p.name.split(' ').slice(-1)[0];
function format(value, type = 'number') {
  if (!Number.isFinite(value)) return '—';
  if (type === 'ratio%') return (value * 100).toFixed(1) + '%';
  return value.toFixed(type === 'precise' ? 3 : type === 'ratio' ? 2 : 1) + (type === '%' ? '%' : '');
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}
function playerContents(p, slot) {
  return `<div class="card-top"><span class="player-avatar"><span class="avatar-initials" aria-hidden="true">${esc(initials(p))}</span><img class="player-photo" src="assets/players/${p.id}.png" alt="${esc(p.name)}" width="260" height="190" draggable="false" decoding="async"></span><span class="card-position">${slot == null ? esc(p.position || 'NBA') : POSITIONS[slot]}</span></div><span class="player-last">${esc(shortName(p))}</span><span class="player-first">${esc(p.name)}</span>${p.stats ? `<span class="card-metrics"><span>TS <strong>${format(p.stats.ts_pct,'%')}</strong></span><span>USG <strong>${format(p.stats.usg_pct,'%')}</strong></span></span>` : '<span class="missing-label">No baseline history</span>'}`;
}
function bindPortraitFallbacks(root) {
  root.querySelectorAll('.player-photo').forEach(photo => {
    const markLoaded = () => photo.parentElement.classList.add('photo-loaded');
    const markMissing = () => { photo.hidden = true; photo.parentElement.classList.remove('photo-loaded'); };
    photo.addEventListener('load', markLoaded, {once:true});
    photo.addEventListener('error', markMissing, {once:true});
    if (photo.complete) { if (photo.naturalWidth > 0) markLoaded(); else markMissing(); }
  });
}
function swap(incomingId, slot) {
  try { lineup = substitute(lineup, incomingId, slot, players); }
  catch { toast('That player cannot be added to this lineup.'); return; }
  selectedSlot = slot; pendingId = null; render();
  toast(`${player(incomingId).name} at ${POSITIONS[slot]}.`);
}
function attachDrag(button, id) {
  button.draggable = true;
  button.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain',String(id)); e.dataTransfer.effectAllowed='move'; });
}
function renderCourt() {
  $('#court-players').innerHTML = lineup.map((id,slot) => `<button class="court-card slot-${slot} ${selectedSlot === slot ? 'selected' : ''}" data-slot="${slot}" aria-label="${POSITIONS[slot]}: ${esc(player(id).name)}. Select position or drop replacement here." aria-pressed="${selectedSlot === slot}">${playerContents(player(id),slot)}</button>`).join('');
  bindPortraitFallbacks($('#court-players'));
  document.querySelectorAll('.court-card').forEach(button => {
    const slot = Number(button.dataset.slot); attachDrag(button,lineup[slot]);
    button.addEventListener('click', () => { if (pendingId !== null) swap(pendingId,slot); else {selectedSlot=slot;render();} });
    button.addEventListener('dragover',e => {e.preventDefault();button.classList.add('drag-over');});
    button.addEventListener('dragleave',() => button.classList.remove('drag-over'));
    button.addEventListener('drop',e => {e.preventDefault();button.classList.remove('drag-over');swap(Number(e.dataTransfer.getData('text/plain')),slot);});
  });
  $('#lineup-status').textContent = lineup.every((id,i) => id === DEFAULT_FIVE[i]) ? 'Starting lineup' : `${lineup.filter((id,i) => id !== DEFAULT_FIVE[i]).length} positions changed`;
}
function renderBench() {
  const search = $('#search').value.trim().toLocaleLowerCase();
  const bench = players.filter(p => !lineup.includes(p.id));
  const visible = bench.filter(p => p.name.toLocaleLowerCase().includes(search));
  $('#bench-count').textContent = `${bench.length} players`;
  $('#bench').innerHTML = visible.map(p => `<button class="bench-card ${pendingId===p.id?'picked':''}" data-id="${p.id}" aria-label="Choose ${esc(p.name)}, then select a court position" aria-pressed="${pendingId===p.id}">${playerContents(p,null)}</button>`).join('') || '<p class="bench-empty">No players match your search.</p>';
  bindPortraitFallbacks($('#bench'));
  document.querySelectorAll('.bench-card').forEach(button => {
    const id = Number(button.dataset.id); attachDrag(button,id);
    button.addEventListener('click',() => {pendingId = pendingId===id ? null : id;renderBench();toast(pendingId===null?'Selection cleared.':`Now select a court position for ${player(id).name}.`);});
  });
}
function deltaText(value,type) {
  if (value===null) return '—';
  if (Math.abs(value)<0.0000001) return '—';
  const displayed = type==='ratio%' ? value*100 : value;
  return `${displayed>0?'+':''}${displayed.toFixed(type==='precise'?3:type==='ratio'?2:1)}${type==='%'||type==='ratio%'?' pp':''}`;
}
function renderAnalysis() {
  const baseline=player(DEFAULT_FIVE[selectedSlot]), current=player(lineup[selectedSlot]);
  $('#selected-position').textContent=POSITIONS[selectedSlot];
  $('#compare-players').innerHTML=`<div class="compare-player"><div class="compare-label">ORIGINAL</div><div class="compare-name">${esc(baseline.name)}</div></div><span class="compare-arrow">→</span><div class="compare-player current"><div class="compare-label">SELECTED</div><div class="compare-name">${esc(current.name)}</div></div>`;
  $('#comparison-caption').textContent=current.id===baseline.id?'Select a bench player, then a position to compare.':'Same position · two individual season profiles';
  $('#comparison').innerHTML='<div class="metric-row metric-header"><span>METRIC</span><span>ORIGINAL</span><span>SELECTED</span><span>CHANGE</span></div>'+groups[focus].map(([key,label,description,type])=>{
    const old=baseline.stats?.[key], now=current.stats?.[key], delta=difference(now,old);
    return `<div class="metric-row"><span class="metric-label" title="${esc(description)}">${label}</span><span class="old-value">${format(old,type)}</span><span>${format(now,type)}</span><span class="delta ${delta!==null&&Math.abs(delta)>0.0000001?'changed':''}">${deltaText(delta,type)}</span></div>`;
  }).join('');
  let note;
  if (!current.stats) note=`${current.name} has no 2025–26 NBA history in the supplied file. Missing values are not zeros; we cannot compare this profile yet.`;
  else if (focus==='shooting') note=`${shortName(current)} took ${format(current.stats.three_point_attempt_rate,'ratio%')} of field-goal attempts from three, with ${format(current.stats.ts_pct,'%')} true shooting across ${current.stats.games} games. This describes shot selection and scoring efficiency; three-point accuracy is not in this source.`;
  else if (focus==='creation') note=`${shortName(current)} had ${format(current.stats.usg_pct,'%')} usage, ${format(current.stats.ast_pct,'%')} assist percentage and ${format(current.stats.tov_pct,'%')} turnover percentage. These describe their previous role; ball-handling duties with these five still need to be modeled.`;
  else if (focus==='defense') note=`${shortName(current)} recorded ${format(current.stats.drb_pct,'%')} defensive rebounding and ${format(current.stats.dbpm)} defensive BPM in ${current.stats.minutes.toLocaleString()} minutes. These indicators do not measure switching, positioning or matchup defense on their own.`;
  else note=`${shortName(current)} posted ${format(current.stats.bpm)} BPM and ${format(current.stats.vorp)} VORP in ${current.stats.minutes.toLocaleString()} minutes. These are individual box-score estimates. Adding the five players’ BPM values would not predict a lineup’s net rating.`;
  $('#insight-text').textContent=note;
  document.querySelectorAll('[data-focus]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.focus===focus));button.tabIndex=button.dataset.focus===focus?0:-1;});
}
function renderProfiles() {
  const metrics=groups[focus];
  $('#profiles').innerHTML=`<table class="stats-table"><thead><tr><th>PLAYER</th><th>GAMES</th><th>MINUTES</th>${metrics.map(([,label,description])=>`<th><abbr title="${esc(description)}">${esc(label.toUpperCase())}</abbr></th>`).join('')}</tr></thead><tbody>${lineup.map((id,slot)=>{const p=player(id);return `<tr><td><span class="pos">${POSITIONS[slot]}</span>${esc(p.name)}</td><td>${p.stats?.games??'—'}</td><td>${p.stats?.minutes?.toLocaleString()??'—'}</td>${metrics.map(([key,,,type])=>`<td>${format(p.stats?.[key],type)}</td>`).join('')}</tr>`;}).join('')}</tbody></table>`;
  $('#table-note').textContent='Percentages describe each player’s own season. pp = percentage-point change. — = unavailable or no change in the comparison column. No team averages or lineup forecasts are calculated.';
}
function render() {renderCourt();renderBench();renderAnalysis();renderProfiles();}
async function start() {
  try {
    const response=await fetch('./players.json');
    if(!response.ok) throw new Error('Could not load player profiles');
    data=await response.json();players=data.players;
    try {const saved=JSON.parse(localStorage.getItem(STORAGE));if(validLineup(saved,players))lineup=saved;} catch {}
    $('#fingerprint').textContent=`Source file fingerprint: ${data.source_sha256}`;
    render();
  } catch(error) {$('#court-players').innerHTML='<p class="bench-empty">Player data could not load. Please refresh the page.</p>';toast(error.message);return;}
  $('#search').addEventListener('input',renderBench);
  $('#reset').addEventListener('click',()=>{lineup=[...DEFAULT_FIVE];pendingId=null;selectedSlot=0;render();toast('Starting five restored. Save to keep this selection.');});
  $('#save').addEventListener('click',()=>{try{localStorage.setItem(STORAGE,JSON.stringify(lineup));toast('Lineup saved on this browser.');}catch{toast('Browser storage is unavailable. Use Export five instead.');}});
  $('#export').addEventListener('click',()=>{
    const output={name:'Heat lineup',roster_season:'2026–27',baseline_season:'2025–26',slots:lineup.map((id,i)=>({slot:i+1,position:POSITIONS[i],nba_player_id:id,name:player(id).name}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='heat-lineup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Lineup exported.');
  });
  document.querySelectorAll('[data-focus]').forEach(button=>{
    button.addEventListener('click',()=>{focus=button.dataset.focus;renderAnalysis();renderProfiles();});
    button.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();const keys=Object.keys(groups);focus=keys[(keys.indexOf(focus)+(e.key==='ArrowRight'?1:3))%4];renderAnalysis();renderProfiles();document.querySelector(`[data-focus="${focus}"]`).focus();});
  });
  const dialog=$('#data-dialog');
  $('#source-button').addEventListener('click',()=>dialog.showModal());
  $('#footer-source').addEventListener('click',()=>dialog.showModal());
  $('#close-dialog').addEventListener('click',()=>dialog.close());
}
start();
