import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,move,restartGame,changeTeamCount,changeTeamRoster,consecutiveColors,rosterColorChoices,upcomingGame,colorsForTeams,matchup,audit} from '../engine.mjs';
import {timerCue} from '../sounds.mjs';
const colors={A:'Purple',B:'Green',C:'Red',D:'Blue',E:'Yellow'};
test('before kickoff, team changes apply immediately, retain order and clamp allowed counts',()=>{
 const s=fresh(4,colorsForTeams(4,colors),300000,45000);changeTeamCount(s,1,colors,0);
 assert.equal(s.teams,5);assert.equal(s.game,1);assert.equal(s.running,false);assert.equal(s.remaining,300000);assert.deepEqual(s.colors,colors);assert.throws(()=>changeTeamCount(s,1,colors,0));
 for(let i=0;i<3;i++)changeTeamCount(s,-1,colors,0);
 assert.equal(s.teams,2);assert.deepEqual(s.colors,colorsForTeams(2,colors));assert.throws(()=>changeTeamCount(s,-1,colors,0));assert.throws(()=>changeTeamCount(s,2,colors,0));
});
test('four to five is queued during play and starts at kickoff after the full changeover',()=>{
 const s=fresh(4,colorsForTeams(4,colors),300000,45000);s.game=6;toggle(s,0);changeTeamCount(s,1,colors,10000);
 assert.equal(s.teams,4);assert.equal(s.game,6);assert.equal(s.remaining,290000);assert.equal(s.pendingTeams.teams,5);
 assert.deepEqual(upcomingGame(s,1),{teams:5,game:1,colors});assert.equal(upcomingGame(s,2).game,2);assert.equal(upcomingGame(s).game,6);
 settle(s,300000);assert.equal(s.phase,'changeover');assert.equal(s.teams,4);assert.equal(s.remaining,45000);
 settle(s,344999);assert.equal(s.teams,4);const before={...s};settle(s,345000);
 assert.equal(s.teams,5);assert.equal(s.game,1);assert.equal(s.remaining,300000);assert.equal(s.running,true);assert.equal(s.pendingTeams,undefined);assert.deepEqual(s.teamHistory,[{teams:4,colors:colorsForTeams(4,colors),lastGame:6}]);assert.equal(timerCue(before,s,345000),'start');
 assert.deepEqual(Object.values(audit(s.teams).counts),[8,8,8,8,8]);assert.equal(matchup(s.teams,s.game),'AB');
});
test('five to four keeps the outgoing team through the current game and removes it next cycle',()=>{
 const s=fresh(5,colors,10000,7000);s.game=5;toggle(s,0);changeTeamCount(s,-1,colors,1000);
 assert.equal(s.colors.E,'Yellow');assert.equal(s.pendingTeams.colors.E,undefined);settle(s,17000);
 assert.equal(s.teams,4);assert.equal(s.colors.E,undefined);assert.deepEqual(s.colors,colorsForTeams(4,colors));assert.equal(s.game,1);assert.equal(s.teamHistory[0].lastGame,5);
});
test('manual next applies queued change paused; restart game preserves pending change',()=>{
 const s=fresh(3,colorsForTeams(3,colors));toggle(s,0);changeTeamCount(s,1,colors,1000);restartGame(s);
 assert.equal(s.pendingTeams.teams,4);assert.equal(s.teams,3);move(s,1);assert.equal(s.teams,4);assert.equal(s.game,1);assert.equal(s.running,false);assert.equal(s.deadline,null);assert.equal(s.remaining,s.gameMs);
});
test('changes may be edited, canceled, and restored without dropping the active timer',()=>{
 let s=fresh(3,colorsForTeams(3,colors));toggle(s,0);changeTeamCount(s,1,colors,1000);changeTeamCount(s,1,colors,2000);assert.equal(s.pendingTeams.teams,5);
 changeTeamCount(s,-1,colors,3000);assert.equal(s.pendingTeams.teams,4);changeTeamCount(s,-1,colors,4000);assert.equal(s.pendingTeams,undefined);
 changeTeamCount(s,-1,colors,5000);assert.equal(s.pendingTeams.teams,2);s=JSON.parse(JSON.stringify(s));settle(s,s.gameMs+s.changeMs);assert.equal(s.teams,2);assert.equal(s.game,1);assert.equal(s.running,true);
});
test('changes requested during a paused changeover wait for resume or manual next',()=>{
 const s=fresh(4,colorsForTeams(4,colors));toggle(s,0);toggle(s,245000);assert.equal(s.phase,'changeover');
 changeTeamCount(s,1,colors,300000);assert.equal(s.teams,4);assert.equal(s.remaining,25000);assert.equal(s.running,false);
 toggle(s,400000);settle(s,425000);assert.equal(s.teams,5);assert.equal(s.game,1);assert.equal(s.remaining,s.gameMs);
});
test('long background catch-up after a queued change agrees with a stepped clock',()=>{
 let a=fresh(4,colorsForTeams(4,colors));toggle(a,0);changeTeamCount(a,1,colors,1000);let b=structuredClone(a);
 const now=86400000;settle(a,now);for(let t=10000;t<now;t+=10000)settle(b,t);settle(b,now);assert.deepEqual(a,b);
 assert.equal(a.teamHistory.length,1);assert.equal(a.teams,5);
});
test('a new-cycle kickoff is detected even when its game number matches the previous segment',()=>{
 const s=fresh(4,colorsForTeams(4,colors),10000,5000);toggle(s,0);changeTeamCount(s,1,colors,1000);const before={...s};settle(s,15000);assert.equal(s.game,before.game);assert.equal(timerCue(before,s,15000),'start');
});

test('any selected departing color is removed while survivors retain identity and relative order',()=>{
 const s=fresh(4,colorsForTeams(4,colors));changeTeamRoster(s,'remove','Green',0);
 assert.deepEqual(Object.values(s.colors),['Purple','Red','Blue']);assert.equal(s.teams,3);assert.equal(s.sessionRoster,true);assert.equal(s.running,false);
});
test('a custom arriving color is session-only and does not mutate the saved defaults',()=>{
 const defaults={...colors},s=fresh(4,colorsForTeams(4,defaults));changeTeamRoster(s,'add','Orange',0);
 assert.deepEqual(Object.values(s.colors),['Purple','Green','Red','Blue','Orange']);assert.deepEqual(defaults,colors);assert.equal(s.sessionRoster,true);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(restored.colors.E,'Orange');assert.equal(restored.sessionRoster,true);
 assert.deepEqual(fresh(5,colorsForTeams(5,defaults)).colors,colors);
});
test('a queued departure and arrival may replace a team at the same count without canceling',()=>{
 let s=fresh(4,colorsForTeams(4,colors));toggle(s,0);changeTeamRoster(s,'remove','Green',1000);changeTeamRoster(s,'add','Pink',2000);
 assert.equal(s.pendingTeams.teams,4);assert.deepEqual(Object.values(s.pendingTeams.colors),['Purple','Red','Blue','Pink']);
 s=JSON.parse(JSON.stringify(s));settle(s,s.gameMs+s.changeMs);assert.equal(s.teams,4);assert.equal(s.game,1);assert.equal(s.sessionRoster,true);assert.deepEqual(Object.values(s.colors),['Purple','Red','Blue','Pink']);
});
test('roster edits reject duplicate arrivals, absent departures, unknown colors and min/max violations',()=>{
 const s=fresh(4,colorsForTeams(4,colors));assert.throws(()=>changeTeamRoster(s,'add','Purple',0));assert.throws(()=>changeTeamRoster(s,'remove','Yellow',0));assert.throws(()=>changeTeamRoster(s,'add','Invisible',0));
 assert.throws(()=>changeTeamRoster(fresh(2),'remove','Red',0));assert.throws(()=>changeTeamRoster(fresh(5),'add','Orange',0));
});

test('transition warnings follow team colors after a selected removal changes schedule slots',()=>{
 const s=fresh(4,colorsForTeams(4,colors));s.game=4;toggle(s,0);changeTeamRoster(s,'remove','Green',1000);
 assert.deepEqual(consecutiveColors(s),[]);
 s.game=1;assert.deepEqual(consecutiveColors(s),['Purple']);
});

test('remove picker lists exactly the selected active colors, including session-only arrivals',()=>{
 const s=fresh(3,{A:'Orange',B:'Blue',C:'Pink'});
 assert.deepEqual(rosterColorChoices(s,'remove',colors),['Orange','Blue','Pink']);
 assert.ok(!rosterColorChoices(s,'remove',colors).includes('Yellow'));
});
test('remove picker excludes a queued arrival until it actually joins',()=>{
 const s=fresh(4,colorsForTeams(4,colors));toggle(s,0);changeTeamRoster(s,'add','Orange',1000);
 assert.deepEqual(rosterColorChoices(s,'remove',colors),Object.values(colorsForTeams(4,colors)));
 settle(s,s.gameMs+s.changeMs);assert.ok(rosterColorChoices(s,'remove',colors).includes('Orange'));
});
test('already queued departures disappear while add choices exclude the planned active roster',()=>{
 const s=fresh(4,colorsForTeams(4,colors));toggle(s,0);changeTeamRoster(s,'remove','Green',1000);
 assert.deepEqual(rosterColorChoices(s,'remove',colors),['Purple','Red','Blue']);
 const choices=rosterColorChoices(s,'add',colors);assert.ok(choices.includes('Green'));assert.ok(choices.includes('Orange'));assert.ok(!choices.includes('Purple'));
});
