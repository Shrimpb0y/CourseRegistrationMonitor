'use strict';
function validateConfig(c) {
  if(!c || !Number.isInteger(c.port) || c.port<1024 || c.port>65535) throw Error('端口配置无效');
  if(!Number.isFinite(c.pollIntervalSeconds) || c.pollIntervalSeconds<15 || c.pollIntervalSeconds>3600) throw Error('查询间隔需在15至3600秒之间');
  const t=c.target;
  if(!t || !/^[A-Z]{2,8}\d{3,5}$/.test(t.courseCode) || !/^\d+$/.test(String(t.lectureGroup))) throw Error('课程或班级配置无效');
  if(!normalizeTime(t.lectureTime) || !['EL','YW','AU','AW'].includes(t.category)) throw Error('时间或性质配置无效');
  if(t.labGroup && !/^\d+$/.test(String(t.labGroup))) throw Error('Lab Group配置无效');
  return structuredClone(c);
}
function normalizeTime(text) {
  return [...String(text||'').toUpperCase().replace(/\([^)]*\)/g,'').matchAll(/\b[ISRKJAH]\d{2}(?:-\d{2})?\b/g)].map(m=>m[0]).sort().join(',');
}
const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toUpperCase();
function parseSchedule(tables,target) {
  const matches=[];
  for(const rows of tables) {
    const hi=rows.findIndex(r=>r.some(x=>norm(x)==='NO. OF QUOTA AVAILABLE'));
    if(hi<0)continue;
    const header=rows[hi].map(norm);
    const idx=name=>header.indexOf(name);
    for(const row of rows.slice(hi+1)) {
      if(norm(row[idx('COURSE CODE')])!==target.courseCode || norm(row[idx('LECTURE GROUP')])!==String(target.lectureGroup))continue;
      if(normalizeTime(row[idx('LECTURE TIME/VENUE')])!==normalizeTime(target.lectureTime))continue;
      const numbers=['QUOTA','NO. OF STUDENT REGISTERED','NO. OF QUOTA AVAILABLE','AVAILABLE'].map(key=>{
        const value=norm(row[idx(key)]);
        if(!/^\d+$/.test(value))throw Error('余量字段未完整加载');
        return Number(value);
      });
      const [quota,registered,quotaAvailable,available]=numbers;
      matches.push({quota,registered,quotaAvailable,available,open:quotaAvailable>0&&available>0});
    }
  }
  if(matches.length!==1)throw Error('目标班级未找到或存在重复，暂停本轮操作');
  return matches[0];
}
function matchRegistered(tables,target) {
  return tables.some(rows=>{
    const hi=rows.findIndex(r=>r.map(norm).includes('STATUS')&&r.map(norm).includes('LECTURE GROUP'));
    if(hi<0)return false;
    const h=rows[hi].map(norm); const val=(r,k)=>norm(r[h.indexOf(k)]);
    return rows.slice(hi+1).some(r=>val(r,'COURSE CODE')===target.courseCode && val(r,'LECTURE GROUP')===String(target.lectureGroup) && val(r,'STATUS')===target.category && normalizeTime(val(r,'LECTURE TIME'))===normalizeTime(target.lectureTime) && (!target.labGroup||val(r,'LAB GROUP')===String(target.labGroup)));
  });
}
function pendingEmpty(rows) { return rows.length>=2 && rows.slice(1).every(r=>r.length===1&&norm(r[0])==='NO RECORD'); }
module.exports={validateConfig,normalizeTime,parseSchedule,matchRegistered,pendingEmpty};
