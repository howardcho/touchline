import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,beginTeamCycle,changeTeamRoster} from '../engine.mjs';
import {configureSessionAccess,FREE_THREE_TEAM_MS,requiresPremium} from '../access.mjs';
import {sessionBoundary} from '../session.mjs';

test('only four- and five-team rotations require Premium',()=>{
  assert.deepEqual([2,3,4,5].map(requiresPremium),[false,false,true,true]);
});

test('a free three-team session gets one hard 30-minute window from first start',()=>{
  const s=configureSessionAccess(fresh(3),false);
  assert.equal(s.accessEndAt,undefined);
  toggle(s,1000);
  assert.equal(s.accessEndAt,1000+FREE_THREE_TEAM_MS);
  toggle(s,61000);toggle(s,121000);
  assert.equal(s.accessEndAt,1000+FREE_THREE_TEAM_MS);
  settle(s,1000+FREE_THREE_TEAM_MS);
  assert.equal(s.finished,true);assert.equal(s.finishedAt,1000+FREE_THREE_TEAM_MS);assert.equal(s.finishReason,'free-limit');
});

test('Premium removes the three-team limit and an earlier configured end still wins',()=>{
  const premium=configureSessionAccess(fresh(3),true);toggle(premium,0);
  assert.equal(sessionBoundary(premium),null);
  const limited={...configureSessionAccess(fresh(3),false),endAt:600000,endMode:'soft',minGameMs:120000};
  toggle(limited,0);
  assert.deepEqual(sessionBoundary(limited),{endAt:600000,endMode:'soft',minGameMs:120000,reason:'end-time'});
});

test('moving between free team counts starts and removes the three-team limit',()=>{
  const s=configureSessionAccess(fresh(2),false);
  beginTeamCycle(s,3,{A:'Red',B:'Blue',C:'Green'},true,10000);
  assert.equal(s.accessEndAt,10000+FREE_THREE_TEAM_MS);
  beginTeamCycle(s,2,{A:'Red',B:'Blue'});
  assert.equal(s.accessLimitMs,undefined);assert.equal(s.accessEndAt,undefined);
});

test('a queued third team cannot bypass the limit during long background catch-up',()=>{
  const s=configureSessionAccess(fresh(2),false);
  toggle(s,0);changeTeamRoster(s,'add','Green',60000);settle(s,5000000);
  assert.equal(s.teams,3);assert.equal(s.finished,true);
  assert.equal(s.finishedAt,270000+FREE_THREE_TEAM_MS);assert.equal(s.finishReason,'free-limit');
});
