const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateConfig, parseSchedule, matchRegistered, pendingEmpty, normalizeTime} = require('../src/core');
const config = {port:8765,pollIntervalSeconds:30,target:{courseCode:'LPD2107',lectureGroup:'1',lectureTime:'I10-12,R09',category:'EL',labGroup:''}};
const headings=['NO','COURSE CODE','LECTURE TIME/VENUE','LECTURE GROUP','LECTURER','QUOTA','NO. OF STUDENT REGISTERED','NO. OF QUOTA AVAILABLE','AVAILABLE','SPECIALIZATION'];
const row=['1','LPD2107','I10-12 (BK03 KAA)\nR09 (BK03 KAA)','1','Teacher','29','29','0','0',''];
test('validates configurable target and rejects unsafe polling or invalid category',()=>{
  assert.equal(validateConfig(config).target.category,'EL');
  assert.equal(validateConfig({...config,target:{...config.target,courseCode:'SSW3310',lectureGroup:'2'}}).target.courseCode,'SSW3310');
  for(const value of [0,2,NaN]) assert.throws(()=>validateConfig({...config,pollIntervalSeconds:value}));
  assert.throws(()=>validateConfig({...config,target:{...config.target,category:'FE'}}));
  assert.throws(()=>validateConfig({...config,port:80}));
});
test('matches full timetable independent of ordering and venue',()=>{
  assert.equal(normalizeTime('R09 (BK03 KAA)\nI10-12 (BK03 KAA)'),normalizeTime('I10-12,R09'));
  assert.notEqual(normalizeTime('I10-12,R10'),normalizeTime('I10-12,R09'));
});
test('full course never triggers registration',()=>{
  const r=parseSchedule([[headings,row]],config.target);
  assert.equal(r.available,0); assert.equal(r.open,false);
});
test('requires both availability fields positive',()=>{
  let r=[...row]; r[6]='28';r[7]='1';r[8]='1';
  assert.equal(parseSchedule([[headings,r]],config.target).open,true);
  r[8]='0';assert.equal(parseSchedule([[headings,r]],config.target).open,false);
});
test('missing, ambiguous or malformed target fails closed',()=>{
  assert.throws(()=>parseSchedule([[headings,[...row.slice(0,3),'2',...row.slice(4)]]],config.target));
  assert.throws(()=>parseSchedule([[headings,row,row]],config.target));
  const invalid=[...row];invalid[7]='unknown';assert.throws(()=>parseSchedule([[headings,invalid]],config.target));
  assert.throws(()=>parseSchedule([],config.target));
});
test('verifies registered course, group, time, category and lab together',()=>{
  const h=['NO.','COURSE CODE','COURSE NAME','CREDIT HOUR','STATUS','LECTURE TIME','LECTURE GROUP','LECTURE LOCATION','LAB TIME','LAB GROUP'];
  const r=['1','LPD2107','GERMAN','3','EL','I10-12,R09','1','BK03','',''];
  assert.equal(matchRegistered([[h,r]],config.target),true);
  const wrong=[...r];wrong[4]='YW';assert.equal(matchRegistered([[h,wrong]],config.target),false);
  assert.equal(matchRegistered([],config.target),false);
  assert.equal(matchRegistered([[h,r]],{...config.target,labGroup:'2'}),false);
});
test('pending list must be explicitly empty, unknown structures are refused',()=>{
  assert.equal(pendingEmpty([['NO','COURSE CODE'],['NO RECORD']]),true);
  assert.equal(pendingEmpty([['NO','COURSE CODE'],['1','OTHER101']]),false);
  assert.equal(pendingEmpty([]),false);
});
