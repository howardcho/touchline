import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,restartGame,adjustTime,move} from '../engine.mjs';
test('restart gives the same teams and game a full five minutes, paused',()=>{
 const s=fresh(5,undefined,300000,45000), colors={...s.colors};s.game=8;toggle(s,1000);settle(s,31000);restartGame(s);
 assert.equal(s.game,8);assert.deepEqual(s.colors,colors);assert.equal(s.phase,'game');assert.equal(s.remaining,300000);assert.equal(s.phaseMs,300000);assert.equal(s.running,false);assert.equal(s.deadline,null);
});
test('restart from changeover restores current matchup rather than advancing',()=>{
 const s=fresh(4,undefined,300000);toggle(s,0);settle(s,305000);assert.equal(s.phase,'changeover');restartGame(s);assert.equal(s.game,1);assert.equal(s.phase,'game');assert.equal(s.remaining,300000);assert.equal(s.running,false);
});
test('add/subtract keeps active timer running and uses the current clock',()=>{
 const s=fresh(5,undefined,300000);toggle(s,1000);adjustTime(s,30000,11000);assert.equal(s.remaining,320000);assert.equal(s.deadline,331000);assert.equal(s.running,true);
 adjustTime(s,-30000,21000);assert.equal(s.remaining,280000);assert.equal(s.deadline,301000);assert.equal(s.gameMs,300000);settle(s,301000);assert.equal(s.phase,'changeover');assert.equal(s.phaseMs,s.changeMs);
});
test('paused adjustments persist through serialization and navigation restores configured duration',()=>{
 let s=fresh(4,undefined,300000);adjustTime(s,30000,1000);assert.equal(s.remaining,330000);assert.equal(s.running,false);assert.equal(s.deadline,null);
 s=JSON.parse(JSON.stringify(s));toggle(s,5000);assert.equal(s.deadline,335000);move(s,1);assert.equal(s.remaining,300000);assert.equal(s.phaseMs,300000);
});
test('changeover adjustments preserve the game and phase; next game gets its own duration',()=>{
 const s=fresh(5,undefined,300000,45000);toggle(s,0);settle(s,300000);adjustTime(s,30000,310000);assert.equal(s.phase,'changeover');assert.equal(s.game,1);assert.equal(s.remaining,65000);assert.equal(s.changeMs,45000);assert.equal(s.deadline,375000);settle(s,375000);assert.equal(s.game,2);assert.equal(s.remaining,300000);assert.equal(s.phaseMs,300000);
});
test('adjustments clamp safely and settle overdue phases before changing time',()=>{
 const s=fresh(4);adjustTime(s,-30000,0);s.remaining=5000;adjustTime(s,-30000,0);assert.equal(s.remaining,1000);s.remaining=3590000;adjustTime(s,30000,0);assert.equal(s.remaining,3600000);
 const overdue=fresh(4);toggle(overdue,0);adjustTime(overdue,30000,245000);assert.equal(overdue.phase,'changeover');assert.equal(overdue.remaining,55000);assert.equal(overdue.game,1);
 assert.throws(()=>adjustTime(overdue,100,245000));
});

test('time added before kickoff retains kickoff state while mid-game adjustments retain resume state',()=>{
 const s=fresh(5,undefined,300000);adjustTime(s,30000,0);assert.equal(s.phaseStarted,false);
 toggle(s,0);assert.equal(s.phaseStarted,true);settle(s,10000);toggle(s,10000);adjustTime(s,30000,20000);assert.equal(s.phaseStarted,true);
 restartGame(s);assert.equal(s.phaseStarted,false);
});
