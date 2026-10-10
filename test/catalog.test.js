const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseCourses,parseGroups,describeTime}=require('../src/catalog');
const headers=['NO','COURSE CODE','LECTURE TIME/VENUE','LECTURE GROUP','LECTURER','QUOTA','NO. OF STUDENT REGISTERED','NO. OF QUOTA AVAILABLE','AVAILABLE'];
test('catalog matches code prefix, deduplicates nested tables and excludes unrelated rows',()=>{
 const table=[['NO','COURSE CODE','COURSE NAME','CREDIT HOURS'],['1','LPD2107','GERMAN I','3'],['2','LPD2108','GERMAN II','3'],['3','SSW3310','OTHER','3']];
 assert.deepEqual(parseCourses([table,table],'LPD').map(x=>x.courseCode),['LPD2107','LPD2108']);
 assert.equal(parseCourses([table],'LPD2107')[0].courseName,'GERMAN I');assert.deepEqual(parseCourses([table],'ABC'),[]);
});
test('groups preserve all timetable slots and keep full groups selectable for monitoring',()=>{
 const rows=[headers,['1','LPD2107','I10-12 (BK03)\nR09 (BK03)','1','T','29','29','0','0'],['2','LPD2107','I14-16\nR10','2','T','28','27','1','1']];
 const result=parseGroups([rows],'LPD2107');assert.equal(result.lectures.length,2);assert.equal(result.lectures[0].lectureTime,'I10-12,R09');assert.equal(result.lectures[0].available,0);
 assert.match(result.lectures[0].timeLabel,/周一 10:00–12:00/);assert.match(result.lectures[0].timeLabel,/周三 09:00/);
 assert.throws(()=>parseGroups([[headers,rows[1],rows[1]]],'LPD2107'),/重复/);
 const bad=[...rows[1]];bad[7]='?';assert.throws(()=>parseGroups([[headers,bad]],'LPD2107'),/余量/);
});
test('lab groups are independent and missing lecture schedule fails closed',()=>{
 const labs=[['NO','COURSE CODE','LAB TIME/VENUE','LAB GROUP','DEMONSTRATOR','QUOTA','NO. OF STUDENT REGISTERED'],['1','SSW3310','J09-11 (LAB)','2','T','20','19']];
 const lectures=[headers,['1','SSW3310','I08-10','1','T','20','19','1','1']];
 const result=parseGroups([lectures,labs],'SSW3310');assert.equal(result.labs[0].labGroup,'2');assert.equal(result.labs[0].labTime,'J09-11');assert.throws(()=>parseGroups([labs],'SSW3310'),/教学班/);
 assert.equal(describeTime('R09,I10-12'),'周一 10:00–12:00；周三 09:00（结束时间未提供）');
});
