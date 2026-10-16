import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEDULES,audit,matchup,assignColors,colorsForTeams,completeColors,validColors,fresh,toggle,settle,applySettings} from '../engine.mjs';
import {loadPreferences,savePreferences} from '../preferences.mjs';
test('two-team cycle repeats indefinitely with no rest and both teams returning',()=>{
 assert.deepEqual(SCHEDULES[2],['AB']);assert.deepEqual(audit(2),{counts:{A:1,B:1},pairs:{AB:1},conflicts:[{team:'A',from:1,to:1},{team:'B',from:1,to:1}],maxRest:{A:0,B:0}});
 assert.equal(matchup(2,1000),'AB');assert.deepEqual(Object.values(assignColors(2)).sort(),['Blue','Red']);
});
test('three-team cycle is balanced and reports its cyclic consecutive appearances',()=>{
 assert.deepEqual(SCHEDULES[3],['AB','AC','BC']);const a=audit(3);assert.deepEqual(a.counts,{A:2,B:2,C:2});assert.deepEqual(a.pairs,{AB:1,AC:1,BC:1});assert.deepEqual(a.maxRest,{A:1,B:1,C:1});assert.equal(a.conflicts.length,3);assert.equal(matchup(3,4),'AB');
 for(const teams of [2,3]) {const s=fresh(teams);applySettings(s,s.colors,300000,0,45000);toggle(s,0);settle(s,345000);assert.equal(s.game,2);assert.equal(s.remaining,300000);}
});
test('splash settings persist all team counts and start rotations with saved colors and durations',()=>{
 const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const p=loadPreferences(storage);p.gameMs=300000;p.changeMs=45000;p.setupTeams=3;
 p.colors={A:'Purple',B:'Green',C:'Blue',D:'White',E:'Pink'};
 savePreferences(storage,p);const restored=loadPreferences(storage);assert.deepEqual(restored,p);
 for(const teams of [2,3,4,5]) {const s=fresh(teams,colorsForTeams(teams,restored.colors),restored.gameMs,restored.changeMs);assert.equal(s.remaining,300000);assert.equal(s.changeMs,45000);assert.deepEqual(s.colors,colorsForTeams(teams,p.colors));}
});

test('old per-count colors migrate in order and preserve the current session prefix',()=>{
 const raw={setupTeams:3,colorsByTeams:{3:{A:'Purple',B:'Blue',C:'Red'}}};
 const p=loadPreferences({getItem:k=>k.includes('preferences')?JSON.stringify(raw):null});
 assert.deepEqual(colorsForTeams(3,p.colors),raw.colorsByTeams[3]);assert.ok(validColors(5,p.colors));
 const migrated=completeColors({...p.colors,A:'Blue',B:'Red'});
 assert.deepEqual(colorsForTeams(2,migrated),{A:'Blue',B:'Red'});assert.ok(validColors(5,migrated));
});
test('five unique colors are required even for a two-team session',()=>{
 assert.equal(validColors(5,{A:'Red',B:'Blue'}),false);
 assert.equal(validColors(5,{A:'Red',B:'Blue',C:'Green',D:'Black',E:'Red'}),false);
 assert.equal(validColors(5,{A:'Red',B:'Blue',C:'Green',D:'Black',E:'Yellow'}),true);
});
