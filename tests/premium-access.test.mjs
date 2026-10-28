import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,beginTeamCycle,changeTeamRoster} from '../engine.mjs';
import {configureSessionAccess,requiresPremium} from '../access.mjs';
import {sessionBoundary} from '../session.mjs';

test('only four- and five-team rotations require Premium',()=>{
  assert.deepEqual([2,3,4,5].map(requiresPremium),[false,false,true,true]);
});

test('free three-team sessions are unlimited',()=>{
  const s=configureSessionAccess(fresh(3),false);
  toggle(s,1000);
  settle(s,4*60*60*1000);
  assert.equal(s.finished,undefined);
  assert.equal(sessionBoundary(s),null);
});

test('a configured session end still applies to free three-team play',()=>{
  const s={...configureSessionAccess(fresh(3),false),endAt:600000,endMode:'soft',minGameMs:120000};
  toggle(s,0);
  assert.deepEqual(sessionBoundary(s),{endAt:600000,endMode:'soft',minGameMs:120000,reason:'end-time'});
});

test('moving between free team counts remains unlimited',()=>{
  const s=configureSessionAccess(fresh(2),false);
  beginTeamCycle(s,3,{A:'Red',B:'Blue',C:'Green'},true,10000);
  settle(s,4*60*60*1000);
  assert.equal(s.finished,undefined);
  beginTeamCycle(s,2,{A:'Red',B:'Blue'});
  assert.equal(s.accessLimitMs,undefined);assert.equal(s.accessEndAt,undefined);
});

test('legacy three-team access limits are removed on restore',()=>{
  const s={...fresh(3),accessLimitMs:1800000,accessEndAt:1800000};
  configureSessionAccess(s,false);
  assert.equal(s.accessLimitMs,undefined);assert.equal(s.accessEndAt,undefined);
});

test('a queued third team remains active during long background catch-up',()=>{
  const s=configureSessionAccess(fresh(2),false);
  toggle(s,0);changeTeamRoster(s,'add','Green',60000);settle(s,5000000);
  assert.equal(s.teams,3);assert.equal(s.finished,undefined);assert.equal(s.running,true);
});
