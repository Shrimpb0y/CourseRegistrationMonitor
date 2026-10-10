'use strict';
const {normalizeTime,parseSchedule}=require('./core');
const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toUpperCase();
function describeTime(value){
 const days={I:'周一',S:'周二',R:'周三',K:'周四',J:'周五',A:'周六',H:'周日'};
 return normalizeTime(value).split(',').filter(Boolean).sort((a,b)=>'ISRKJAH'.indexOf(a[0])-'ISRKJAH'.indexOf(b[0])||a.localeCompare(b)).map(t=>{
  const [from,to]=t.slice(1).split('-');return `${days[t[0]]} ${from}:00${to?'–'+to+':00':'（结束时间未提供）'}`;
 }).join('；');
}
function parseCourses(tables,query){
 const courses=new Map();
 for(const rows of tables){
  const hi=rows.findIndex(r=>r.map(norm).includes('COURSE CODE')&&r.map(norm).includes('COURSE NAME'));if(hi<0)continue;
  const h=rows[hi].map(norm);const col=(r,k)=>r[h.indexOf(k)];
  for(const r of rows.slice(hi+1)){
   const courseCode=norm(col(r,'COURSE CODE'));const courseName=String(col(r,'COURSE NAME')||'').trim();
   if(!/^[A-Z]{2,8}\d{3,5}$/.test(courseCode)||!courseCode.startsWith(query)||!courseName)continue;
   courses.set(courseCode,{courseCode,courseName,creditHours:String(col(r,'CREDIT HOURS')||col(r,'CREDIT HOUR')||'').trim()});
  }
 }return [...courses.values()];
}
function parseGroups(tables,courseCode){
 const lectures=[];const labs=[];const seen=new Set();
 for(const rows of tables){
  const hi=rows.findIndex(r=>r.map(norm).includes('LECTURE GROUP')&&r.map(norm).includes('LECTURE TIME/VENUE'));if(hi<0)continue;
  const h=rows[hi].map(norm);
  for(const r of rows.slice(hi+1)){
   if(norm(r[h.indexOf('COURSE CODE')])!==courseCode)continue;
   const lectureGroup=norm(r[h.indexOf('LECTURE GROUP')]);const timeVenue=String(r[h.indexOf('LECTURE TIME/VENUE')]||'').trim();const lectureTime=normalizeTime(timeVenue);
   if(!/^\d+$/.test(lectureGroup)||!lectureTime)throw Error('教学班或时间字段未完整加载');
   if(seen.has(lectureGroup))throw Error('教学班重复，无法安全选择');seen.add(lectureGroup);
   const seats=parseSchedule([rows],{courseCode,lectureGroup,lectureTime});
   lectures.push({lectureGroup,lectureTime,timeLabel:describeTime(lectureTime),timeVenue,...seats});
  }
 }
 const labSeen=new Set();
 for(const rows of tables){
  const hi=rows.findIndex(r=>r.map(norm).includes('LAB GROUP')&&r.map(norm).includes('LAB TIME/VENUE'));if(hi<0)continue;
  const h=rows[hi].map(norm);
  for(const r of rows.slice(hi+1)){
   if(norm(r[h.indexOf('COURSE CODE')])!==courseCode)continue;
   const labGroup=norm(r[h.indexOf('LAB GROUP')]);const timeVenue=String(r[h.indexOf('LAB TIME/VENUE')]||'').trim();const labTime=normalizeTime(timeVenue);
   if(!/^\d+$/.test(labGroup)||!labTime||labSeen.has(labGroup))throw Error('Lab 班级或时间缺失、重复');labSeen.add(labGroup);
   labs.push({labGroup,labTime,timeLabel:describeTime(labTime),timeVenue});
  }
 }
 if(!lectures.length)throw Error('该课程没有可识别的教学班，请核对课程和学期');
 return {courseCode,lectures,labs};
}
module.exports={describeTime,parseCourses,parseGroups};
