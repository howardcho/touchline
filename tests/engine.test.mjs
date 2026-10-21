import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEDULES,COLORS,assignColors,applySettings,audit,fresh,settle,toggle,move,matchup,GAME_MS,CHANGE_MS,MAX_DURATION_MS} from '../engine.mjs';
test('exact supplied schedules',()=>{
assert.equal(SCHEDULES[4].join(' '),'AB CD AC BD AD BC');
assert.equal(SCHEDULES[5].join(' '),'AB CD AE BD CE AD BE AC DE BC AE BD AC BE CD AB DE BC AD CE');
});
test('five team fairness including cyclic transitions and rest',()=>{const a=audit(5);assert.deepEqual(Object.values(a.counts),[8,8,8,8,8]);assert.equal(Object.keys(a.pairs).length,10);assert.ok(Object.values(a.pairs).every(n=>n===2));assert.deepEqual(a.conflicts,[]);assert.ok(Object.values(a.maxRest).every(n=>n===2));});
test('four team fairness and honest conflict detection',()=>{const a=audit(4);assert.deepEqual(Object.values(a.counts),[3,3,3,3]);assert.equal(Object.keys(a.pairs).length,6);assert.deepEqual(a.conflicts,[{team:'C',from:2,to:3},{team:'D',from:4,to:5},{team:'B',from:6,to:1}]);assert.equal(Math.max(...Object.values(a.maxRest)),2);});
test('both loops repeat indefinitely',()=>{for(const t of [4,5]){for(let g=1;g<=1000;g++)assert.equal(matchup(t,g),SCHEDULES[t][(g-1)%SCHEDULES[t].length]);}});
test('full game, changeover, and automatic next game boundaries',()=>{let s=fresh(5);toggle(s,0);settle(s,GAME_MS);assert.equal(s.phase,'changeover');assert.equal(s.game,1);assert.equal(s.remaining,CHANGE_MS);settle(s,GAME_MS+CHANGE_MS);assert.equal(s.phase,'game');assert.equal(s.game,2);assert.equal(s.remaining,GAME_MS);});
test('pause freezes time and resume preserves remainder',()=>{let s=fresh(5);toggle(s,1000);toggle(s,11000);assert.equal(s.remaining,230000);settle(s,90000);assert.equal(s.remaining,230000);toggle(s,90000);assert.equal(s.deadline,320000);settle(s,320000);assert.equal(s.phase,'changeover');});
test('changeover pause and resume',()=>{let s=fresh(4);toggle(s,0);toggle(s,250000);assert.equal(s.phase,'changeover');assert.equal(s.remaining,20000);toggle(s,500000);settle(s,520000);assert.equal(s.game,2);assert.equal(s.remaining,GAME_MS);});
test('background recovery agrees with stepped clock for many elapsed times',()=>{for(const time of [1,239999,240000,269999,270000,510000,540000,86400000,123456789]){const colors=assignColors(5);let a=fresh(5,colors), b=fresh(5,colors);toggle(a,0);toggle(b,0);settle(a,time);for(let n=5000;n<time;n+=5000)settle(b,n);settle(b,time);assert.deepEqual(a,b);}});
test('manual navigation pauses, resets timer, respects first game and loop',()=>{let s=fresh(4);toggle(s,0);move(s,-1);assert.equal(s.game,1);assert.equal(s.running,false);assert.equal(s.remaining,GAME_MS);move(s,6);assert.equal(s.game,7);assert.equal(matchup(s.teams,s.game),'AB');assert.equal(s.running,false);});
test('restored running session recovers correct phase and game',()=>{let s=fresh(5);toggle(s,100);s=JSON.parse(JSON.stringify(s));settle(s,100+20*270000+250000);assert.equal(s.game,21);assert.equal(s.phase,'changeover');assert.equal(s.remaining,20000);});

test('ordered colors use the first requested colors and stay fixed across navigation',()=>{for(const t of [2,3,4,5]) {const mapping=assignColors(t);assert.deepEqual(Object.keys(mapping),'ABCDE'.slice(0,t).split(''));assert.deepEqual(Object.values(mapping),COLORS.slice(0,t));let s=fresh(t,mapping);move(s,50);assert.deepEqual(s.colors,mapping);assert.deepEqual(fresh(t,s.colors).colors,mapping);}});

test('custom duration covers boundaries, navigation and background catch-up',()=>{
  for(const duration of [1000,90000,3600000]) {
    const mapping=assignColors(5);let a=fresh(5,mapping,duration), b=fresh(5,mapping,duration);
    toggle(a,0);toggle(b,0);
    settle(a,duration);assert.equal(a.phase,'changeover');assert.equal(a.remaining,CHANGE_MS);
    settle(a,duration+CHANGE_MS);assert.equal(a.game,2);assert.equal(a.remaining,duration);
    const now=100*(duration+CHANGE_MS)+duration+1000;
    settle(a,now);
    for(let i=1000;i<now;i+=1000)settle(b,i);
    settle(b,now);assert.deepEqual(a,b);
    move(a,1);assert.equal(a.remaining,duration);assert.equal(a.running,false);
    assert.equal(fresh(5,a.colors,a.gameMs).remaining,duration);
  }
});
test('settings reject duplicates, invalid palette entries and invalid durations without changes',()=>{
  for(const duration of [0,500,1001,MAX_DURATION_MS+1000,NaN]){const s=fresh(5), saved=structuredClone(s);assert.throws(()=>applySettings(s,s.colors,duration,0));assert.deepEqual(s,saved);}
  for(const colors of [{A:'Red',B:'Red',C:'Green',D:'Black'},{A:'<script>',B:'Blue',C:'Green',D:'Black'}]){const s=fresh(4);assert.throws(()=>applySettings(s,colors,GAME_MS,0));}
});
test('overflowing seconds and minutes are valid normalized durations',()=>{
  const seconds=fresh(4);applySettings(seconds,seconds.colors,61000,0,61000);assert.equal(seconds.gameMs,61000);assert.equal(seconds.changeMs,61000);
  const minutes=fresh(4);applySettings(minutes,minutes.colors,61*60000,0,61*60000);assert.equal(minutes.gameMs,3660000);assert.equal(minutes.changeMs,3660000);
});
test('color-only edits preserve active timer; duration edit resets current game and pauses',()=>{
 const s=fresh(4), colors={A:'Orange',B:'White',C:'Purple',D:'Yellow'};
 toggle(s,0);applySettings(s,colors,GAME_MS,10000);
 assert.equal(s.running,true);assert.equal(s.remaining,230000);assert.deepEqual(s.colors,colors);
 applySettings(s,colors,300000,20000);assert.equal(s.game,1);assert.equal(s.remaining,300000);assert.equal(s.running,false);assert.equal(s.deadline,null);
 toggle(s,30000);settle(s,330000);assert.equal(s.phase,'changeover');
 applySettings(s,colors,120000,331000);assert.equal(s.phase,'game');assert.equal(s.remaining,120000);assert.equal(s.running,false);
});
