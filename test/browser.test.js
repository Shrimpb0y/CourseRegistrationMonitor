const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const puppeteer=require('puppeteer-core');const {UpmAdapter}=require('../src/upm-adapter');
const target={courseCode:'LPD2107',lectureGroup:'1',lectureTime:'I10-12,R09',category:'EL',labGroup:''};
const table=(h,r)=>`<table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</table>`;
const regH=['NO','COURSE CODE','COURSE NAME','CREDIT HOUR','STATUS','LECTURE TIME','LECTURE GROUP','LECTURE LOCATION','LAB TIME','LAB GROUP'];
const regR=['1','LPD2107','GERMAN','3','EL','I10-12,R09','1','BK03','',''];
const schH=['NO','COURSE CODE','LECTURE TIME/VENUE','LECTURE GROUP','LECTURER','QUOTA','NO. OF STUDENT REGISTERED','NO. OF QUOTA AVAILABLE','AVAILABLE'];
function fixture(registered,pendingOther=false){return `<!doctype html><html><body><a onclick="schedule()">LECTURE/LAB SCHEDULE</a><button onclick="openEnroll()">SELECT OTHER COURSE</button><section><span>LIST OF COURSES TO BE REGISTERED :</span><div id="pending">${table(regH,pendingOther?[['1','OTHER101','OTHER','3','EL','I10-12','1','','','']]:[['NO RECORD']])}</div></section><section><span>LIST OF COURSES REGISTERED :</span>${table(regH,registered?[regR]:[['NO RECORD']])}</section><button id="registerbutton" onclick="fetch('/submit')">REGISTER COURSE(S)</button><div id="panel"></div><div id="popup" style="display:none"></div><script>
const courseRow=${JSON.stringify(regR)};const head=${JSON.stringify(regH)};
function t(h,r){return '<table><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr>'+r.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</table>';}
function schedule(){document.getElementById('panel').innerHTML='<div><input id="txtCC1" readonly><img onclick="picker()" src="/icon"></div><button onclick="search()">Search</button>';}
function picker(){document.getElementById('popup').style.display='block';document.getElementById('popup').innerHTML='<input id="popupFilter-box"><table><tr><th>COURSE CODE</th><th>COURSE NAME</th><th>CREDIT HOURS</th><th>SELECT</th></tr><tr><td>LPD2107</td><td>GERMAN</td><td>3</td><td><img src="/icon" onclick="choose()"></td></tr></table>';}
function choose(){document.getElementById('txtCC1').value='LPD2107';document.getElementById('popup').style.display='none';}
function search(){document.getElementById('panel').insertAdjacentHTML('beforeend',${JSON.stringify(table(schH,[['1','LPD2107','I10-12 (BK03 KAA)<br>R09 (BK03 KAA)','1','Teacher','29','28','1','1']]))});}
function openEnroll(){const p=document.getElementById('popup');p.style.display='block';p.innerHTML='<select id="facultyId"><option value="all">ALL FACULTIES</option></select><select id="departmentId"><option value="all">ALL DEPARTMENT</option></select><input id="popupFilter-box"><div id="containerListing"><table><tr><td>LPD2107</td><td>GERMAN</td><td><input type="checkbox" onclick="document.getElementById(\'fields\').style.display=\'block\'"><div id="fields" style="display:none"><select id="select_taraf"><option value="EL">ELECTIVE COURSE (EL)</option><option value="YW">COMPULSORY COURSE (YW)</option></select><select id="select_masakuliah"><option value="I10-12,R09">ISNIN</option></select><select name="lecture_group"><option value="1">1</option></select></div></td></tr></table></div><button onclick="add()">OK</button>';}
function add(){document.getElementById('popup').style.display='none';document.getElementById('pending').innerHTML=t(head,[courseRow]);}
</script></body></html>`;}
test('local browser E2E reads quota, adds correct course, submits and verifies',async(t)=>{
  let registered=false,submits=0,pendingOther=false;
  const server=http.createServer((req,res)=>{if(req.url==='/submit'){submits++;registered=true;res.end('ok');return;}res.setHeader('Content-Type','text/html; charset=utf-8');if(req.url.endsWith('/popupSearchCourseJadualFastSetup'))res.end(table(['COURSE CODE','COURSE NAME','CREDIT HOURS'],[['LPD2107','GERMAN I','3']]));else if(req.url.startsWith('/smp/'))res.end(fixture(registered,pendingOther));else if(req.url==='/icon'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>');}else res.end('<iframe name="contentFrame" style="width:1200px;height:900px" src="/smp/action/portal/student/myregistra/courseRegistraSetup"></iframe>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const baseUrl='http://127.0.0.1:'+server.address().port;
  let browser;
  t.after(async()=>{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
  browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,pipe:true,timeout:15000,userDataDir:path.resolve(__dirname,'../../../work/test-edge-profile'),args:['--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check','--disable-gpu']});
  const a=new UpmAdapter(os.tmpdir(),{baseUrl});a.browser=browser;a.page=(await browser.pages())[0];a.page.setDefaultTimeout(5000);await a.page.goto(baseUrl);
  assert.equal(await a.registered(target),false);
  const courses=await a.searchCourses('LPD');assert.equal(courses[0].courseCode,'LPD2107');
  const groups=await a.listGroups('LPD2107');assert.equal(groups.lectures[0].lectureGroup,'1');assert.equal(groups.lectures[0].lectureTime,'I10-12,R09');
  const quota=await a.query(target);assert.equal(quota.available,1);assert.equal(quota.open,true);
  let before=0;assert.deepEqual(await a.enroll(target,{beforeSubmit:()=>before++}),{already:false});assert.equal(before,1);assert.equal(submits,1);assert.equal(await a.registered(target),true);
  assert.deepEqual(await a.enroll(target),{already:true});assert.equal(submits,1);
  registered=false;pendingOther=true;await assert.rejects(a.enroll(target),/待注册列表非空/);assert.equal(submits,1);
  pendingOther=false;await assert.rejects(a.enroll(target,{canContinue:()=>false}),/任务已停止/);assert.equal(submits,1);
  await assert.rejects(a.query({...target,lectureGroup:'2'}),/目标班级/);
  await assert.rejects(a.clickText(await a.frame(),'button','Missing'),/未找到/);
  await assert.rejects(a.selectLabel(await a.frame(),'#facultyId','Missing'),/缺少选项|failed|not found/);
  await assert.rejects(new UpmAdapter(os.tmpdir()).frame(),/请先/);
});
