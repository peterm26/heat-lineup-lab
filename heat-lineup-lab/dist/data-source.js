import {validLineup} from './model.js';
export const STAT_FIELDS = ['per','ts_pct','three_point_attempt_rate',
  'free_throw_attempt_rate','orb_pct','drb_pct','trb_pct','ast_pct','stl_pct',
  'blk_pct','tov_pct','usg_pct','ows','dws','ws','ws_per_48','obpm','dbpm','bpm','vorp'];

export function validateConfig(config) {
  if (!config || !config.url || !config.publishableKey) throw new Error('Supabase connection settings are missing.');

  const url=new URL(config.url);

  if (url.protocol!=='https:' || 
    url.username || 
    url.password || 
    url.search || 
    url.hash || 
    (url.pathname!=='/' && url.pathname!=='')
  )
    throw new Error('Use your HTTPS Supabase project address, not the dashboard link.');

  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey))
    throw new Error('This connection requires a publishable key, never a secret or service-role key.');
  return {url:url.origin,
    publishableKey: config.publishableKey};
}

function number(value, label, nullable=true) {
  if (value===null || value===undefined) {
    if (nullable) return null;
    throw new Error(`Database row is missing ${label}.`);
  }
  if (typeof value!=='number' && typeof value!=='string') throw new Error(`Invalid ${label}.`);
  if (value==='' || !Number.isFinite(Number(value))) throw new Error(`Invalid ${label}.`);
  return Number(value);
}
export function normalizePlayers(rows) {
  if (!Array.isArray(rows) || rows.length<5) throw new Error('No complete roster is visible. Check the read-access migration.');
  const seen=new Set();
  return rows.map(row=>{
    const id=number(row.nba_player_id,'player ID',false);
    if (!Number.isSafeInteger(id) || id<=0 || seen.has(id)) throw new Error('Invalid or duplicate player IDs in Supabase.');
    seen.add(id);
    if (typeof row.full_name!=='string' || !row.full_name.trim()) throw new Error('A player name is missing.');
    let stats=null;
    if (row.data_status==='available') {
      stats=Object.fromEntries(STAT_FIELDS.map(field=>[field,number(row[field],field)]));
      for (const key of ['games','games_started','minutes']) {
        stats[key]=number(row[key],key,false);
        if (!Number.isInteger(stats[key]) || stats[key]<0) throw new Error(`Invalid ${key}.`);
      }
      if (stats.games<1 || stats.games>82 || stats.games_started>stats.games) throw new Error('Invalid season game count.');
    } else if (row.data_status!=='missing_history') throw new Error('Unknown player history status.');
    return {id,name:row.full_name,position:row.position||'NBA',source_team:row.source_team_label||null,stats};
  });
}
export function normalizeLineup(rows,players) {
  if (!Array.isArray(rows) || rows.length!==5) throw new Error('Supabase needs a complete default five. Run the starting-five migration.');
  const ordered=[...rows].sort((a,b)=>Number(a.court_slot)-Number(b.court_slot));
  if (!ordered.every((row,i)=>Number(row.court_slot)===i+1) || new Set(rows.map(r=>r.lineup_id)).size!==1)
    throw new Error('The default lineup has invalid slots.');
  const ids=ordered.map(row=>Number(row.nba_player_id));
  if (!validLineup(ids,players)) throw new Error('Default lineup players do not match the visible roster.');
  return ids;
}
async function readJson(fetchImpl,url,options={}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetchImpl(url,{...options,signal:controller.signal,cache:'no-store'});
    if (!response.ok) {
      if (response.status>=500) throw new Error('Supabase is unavailable. Check whether the project is starting or paused, then retry.');
      if ([401,403].includes(response.status)) throw new Error('Supabase denied access. Check the publishable key and read policies.');
      if (response.status===404) throw new Error('A database view is missing. Run the read-access migration.');
      throw new Error(`Database request failed (${response.status}).`);
    }
    return await response.json();
  } catch(error) {
    if (error.name==='AbortError') throw new Error('The data request timed out. Please retry.');
    throw error;
  } finally {clearTimeout(timer);}
}
export async function loadSupabase(config,{fetchImpl=fetch}={}) {
  const {url,publishableKey}=validateConfig(config);
  const options={headers:{apikey:publishableKey,Accept:'application/json'}};
  const [rows,lineupRows]=await Promise.all([
    readJson(fetchImpl,`${url}/rest/v1/heat_player_advanced_baseline?select=*&order=full_name.asc`,options),
    readJson(fetchImpl,`${url}/rest/v1/heat_default_lineup?select=*&order=court_slot.asc`,options),
  ]);
  const players=normalizePlayers(rows),defaultLineup=normalizeLineup(lineupRows,players);
  return {source:'supabase',loaded_at:new Date().toISOString(),players,default_lineup:defaultLineup,
    roster_season:'2026–27',baseline_season:'2025–26',
    source_sha256:[...new Set(rows.map(r=>r.source_file_sha256).filter(Boolean))].join(', ')};
}
export async function loadData({fetchImpl=fetch}={}) {
  const config=await readJson(fetchImpl,'./supabase-config.json');
  return loadSupabase(config,{fetchImpl});
}
