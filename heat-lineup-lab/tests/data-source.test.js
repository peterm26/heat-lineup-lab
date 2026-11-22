import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadData, validateConfig} from '../dist/data-source.js';
import {DEFAULT_FIVE} from '../dist/model.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/players.json',import.meta.url)));
const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
const rows=fixture.players.map(p=>({
  nba_player_id:p.id, full_name:p.name, position:p.position,
  source_team_label:p.source_team,
  data_status:p.stats?'available':'missing_history', ...p.stats,
}));
const lineup=DEFAULT_FIVE.map((id,i)=>({lineup_id:'shared-five',court_slot:i+1,nba_player_id:id}));
const response=(body,status=200)=>({ok:status===200,status,json:async()=>body});

test('loads database profiles and five without requesting bundled player data',async()=>{
  const requests=[];
  const data=await loadData({fetchImpl:async(url,options)=>{
    requests.push(url);
    if(url==='./supabase-config.json') return response(config);
    assert.equal(options.headers.apikey,config.publishableKey);
    assert.equal(options.cache,'no-store');
    if(url.includes('/heat_player_advanced_baseline?')) return response(rows);
    if(url.includes('/heat_default_lineup?')) return response(lineup);
    throw new Error(`Unexpected request: ${url}`);
  }});
  assert.equal(requests.length,3);
  assert.equal(data.source,'supabase');
  assert.deepEqual(data.default_lineup,DEFAULT_FIVE);
  assert.equal(data.players.length,17);
  assert.equal(data.players.filter(p=>p.stats===null).length,2);
  assert.deepEqual(data.players.find(p=>p.id===1628389).stats,fixture.players.find(p=>p.id===1628389).stats);
});

test('denied database reads fail explicitly without a local fallback',async()=>{
  const requests=[];
  await assert.rejects(loadData({fetchImpl:async(url)=>{
    requests.push(url);
    return url==='./supabase-config.json'?response(config):response({},403);
  }}),/denied access/);
  assert.ok(requests.every(url=>!url.includes('players.json')));
});

test('a missing database lineup is reported rather than replaced with local IDs',async()=>{
  await assert.rejects(loadData({fetchImpl:async(url)=>{
    if(url==='./supabase-config.json') return response(config);
    return response(url.includes('/heat_default_lineup?')?[]:rows);
  }}),/complete default five/);
});

test('rejects secret keys before any database request',async()=>{
  assert.throws(()=>validateConfig({...config,publishableKey:'sb_secret_test'}),/never a secret/);
});
