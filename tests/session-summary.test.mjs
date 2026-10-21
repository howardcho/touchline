import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,endSession,restartGame,changeTeamRoster} from '../engine.mjs';
import {summarizeSession} from '../stats.mjs';

test('manual end reports games and actual playing time for every selected team',()=>{
  const state=fresh(5);
  toggle(state,0);
  settle(state,240000);
  settle(state,270000);
  endSession(state,390000);
  assert.equal(state.finishReason,'manual');
  assert.deepEqual(summarizeSession(state),{
    teams:[
      {color:'Red',games:1,playingMs:240000},
      {color:'Blue',games:1,playingMs:240000},
      {color:'Green',games:1,playingMs:120000},
      {color:'Black',games:1,playingMs:120000},
      {color:'Yellow',games:0,playingMs:0}
    ],
    averagePlayingMs:144000,
    totalSessionMs:390000,
    totalGames:2
  });
});

test('team time excludes pauses while total session time includes them',()=>{
  const state=fresh(2);
  toggle(state,0);
  toggle(state,60000);
  toggle(state,120000);
  endSession(state,180000);
  const summary=summarizeSession(state);
  assert.equal(summary.totalSessionMs,180000);
  assert.deepEqual(summary.teams.map(team=>[team.games,team.playingMs]),[[1,120000],[1,120000]]);
  assert.equal(summary.averagePlayingMs,120000);
});

test('restart discards a false start and late teams join the same report',()=>{
  const state=fresh(4);
  toggle(state,0);settle(state,30000);toggle(state,30000);restartGame(state);
  toggle(state,40000);changeTeamRoster(state,'add','Yellow',50000);settle(state,850000);endSession(state,910000);
  const summary=summarizeSession(state);
  assert.equal(summary.totalGames,4);
  assert.deepEqual(summary.teams.map(team=>team.color),['Red','Blue','Green','Black','Yellow']);
  assert.equal(summary.teams.find(team=>team.color==='Yellow').games,1);
  assert.equal(summary.teams.find(team=>team.color==='Blue').playingMs,480000);
});
