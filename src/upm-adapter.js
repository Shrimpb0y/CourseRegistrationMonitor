'use strict';
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
const {parseSchedule,matchRegistered,pendingEmpty,normalizeTime}=require('./core');
const {parseCourses,parseGroups}=require('./catalog');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class UpmAdapter {
  constructor(root,{baseUrl='https://smp.upm.edu.my',executablePath}={}) {
    this.root=root;this.baseUrl=baseUrl;this.executablePath=executablePath;this.browser=null;this.page=null;this.dialog=null;
  }
  async launch() {
    if(this.browser?.connected) {await this.page.bringToFront();return;}
    const candidates=[this.executablePath,process.env.UPM_EDGE_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
    const executablePath=candidates.find(p=>fs.existsSync(p));
    if(!executablePath)throw Error('未找到 Edge，请设置 UPM_EDGE_PATH');
    fs.mkdirSync(path.join(this.root,'runtime'),{recursive:true});
    this.browser=await puppeteer.launch({executablePath,headless:false,userDataDir:path.join(this.root,'runtime','browser-profile'),args:['--disable-background-networking','--disable-sync','--no-first-run','--disable-features=msEdgeSidebarV2']});
    this.page=(await this.browser.pages())[0]||await this.browser.newPage();
    this.page.setDefaultTimeout(15000);
    this.page.on('dialog',async d=>{this.dialog=d.message().slice(0,500);await d.dismiss();});
    await this.page.goto(this.baseUrl,{waitUntil:'domcontentloaded'});
  }
  async frame() {
    if(!this.page||this.page.isClosed())throw Error('请先打开独立 Edge 并登录');
    const f=this.page.frames().find(f=>f.name()==='contentFrame');
    if(!f||/Expired|loginSmp/i.test(this.page.url()))throw Error('登录已过期，请在独立 Edge 重新登录');
    return f;
  }
  async registrationPage() {
    const f=await this.frame();
    await f.goto(this.baseUrl+'/smp/action/portal/student/myregistra/courseRegistraSetup',{waitUntil:'domcontentloaded'});
    await f.waitForSelector('#registerbutton'); return f;
  }
  async clickText(f,selector,text) {
    const handles=await f.$$(selector);
    for(const h of handles) {
      const match=await h.evaluate((e,t)=>e.textContent.replace(/\s+/g,' ').trim()===t&&e.getClientRects().length>0,text);
      if(match){
        await h.evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}));
        // Facebox hides its inputs before its fading overlay stops intercepting clicks.
        await f.waitForFunction(e=>{
          const r=e.getBoundingClientRect();
          if(!r.width||!r.height)return false;
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return !!hit&&(hit===e||e.contains(hit));
        },{},h);
        await h.click();return;
      }
    }
    throw Error('未找到页面操作 '+text);
  }
  async tables(f) {
    return f.$$eval('table',ts=>ts.filter(t=>!t.querySelector('table')).map(t=>Array.from(t.rows).map(r=>Array.from(r.cells).map(c=>c.innerText.trim()))));
  }
  async sectionTable(f,label) {
    return f.evaluate(label=>{
      const el=Array.from(document.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()===label);
      let p=el;
      while(p){const t=p.querySelector('table');if(t)return Array.from(t.rows).map(r=>Array.from(r.cells).map(c=>c.innerText.trim()));p=p.parentElement;}
      return [];
    },label);
  }
  async row(f,course) {
    await f.waitForFunction(course=>Array.from(document.querySelectorAll('tr')).some(r=>r.getClientRects().length>0&&Array.from(r.cells).some(c=>c.textContent.trim()===course)),{},course);
    const h=await f.evaluateHandle(course=>Array.from(document.querySelectorAll('tr')).find(r=>r.getClientRects().length>0&&Array.from(r.cells).some(c=>c.textContent.trim()===course)),course);
    const el=h.asElement();if(!el)throw Error('目标课程未找到');return el;
  }
  async filter(f,course) {
    const box=await f.waitForSelector('#popupFilter-box',{visible:true});
    await box.click({clickCount:3});await box.press('Backspace');await box.type(course,{delay:35});
    // This site debounces course filtering. Wait for a matching row rather than fixed sleeps.
    return this.row(f,course);
  }
  async registered(target) {
    const f=await this.registrationPage();
    const rows=await this.sectionTable(f,'LIST OF COURSES REGISTERED :');
    return matchRegistered([rows],target);
  }
  async schedulePicker() {
    const f=await this.registrationPage();
    await this.clickText(f,'a','LECTURE/LAB SCHEDULE');
    await f.waitForSelector('#txtCC1');
    const opener=await f.evaluateHandle(()=>document.querySelector('#txtCC1').parentElement.querySelector('img'));
    await opener.asElement().click();
    await f.waitForSelector('#popupFilter-box',{visible:true});return f;
  }
  async searchCourses(query) {
    const f=await this.registrationPage();
    // The observed picker polls every 2s. Read its exact authenticated response,
    // rather than guessing when a debounced DOM update has finished.
    const result=await f.evaluate(async query=>{
      const response=await fetch('/smp/action/portal/student/myregistra/popupSearchCourseJadualFastSetup',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({gloCC:'',currentPage:'1',filterColumn:'0',filterValue:query}).toString(),signal:AbortSignal.timeout(20000)
      });
      if(!response.ok)throw Error('课程目录查询失败 HTTP '+response.status);
      if(/Expired|loginSmp/i.test(response.url))throw Error('登录已过期，请在专用 Edge 重新登录');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      return Array.from(doc.querySelectorAll('table')).filter(t=>!t.querySelector('table')).map(t=>Array.from(t.rows).map(r=>Array.from(r.cells).map(c=>c.textContent.trim())));
    },query);
    if(!result.some(rows=>rows.some(r=>r.includes('COURSE CODE')&&r.includes('COURSE NAME'))))throw Error('课程目录未返回有效列表，请检查登录或学校页面变化');
    return parseCourses(result,query);
  }
  async scheduleTables(courseCode) {
    const f=await this.schedulePicker();
    const row=await this.filter(f,courseCode);
    const image=await row.$('img');if(!image)throw Error('课程选择图标缺失');await image.click();
    await f.waitForFunction(()=>{const b=document.querySelector('#popupFilter-box');return !b||!b.getClientRects().length;});
    await this.clickText(f,'button','Search');
    await f.waitForFunction(course=>Array.from(document.querySelectorAll('table')).some(t=>t.textContent.includes('NO. OF QUOTA AVAILABLE')&&t.textContent.includes(course)),{},courseCode);
    // The lab result arrives in a separate request. Wait before deciding whether it exists.
    await this.page.waitForNetworkIdle({idleTime:500,timeout:20000});
    return this.tables(f);
  }
  async listGroups(courseCode) {return parseGroups(await this.scheduleTables(courseCode),courseCode);}
  async query(target) {return parseSchedule(await this.scheduleTables(target.courseCode),target);}
  async selectTime(f,time) {
    const values=await f.$eval('#select_masakuliah',s=>Array.from(s.options).map(o=>o.value));
    const matches=values.filter(v=>normalizeTime(v)===normalizeTime(time));
    if(matches.length!==1)throw Error('目标完整上课时间不可选或存在重复');
    await f.select('#select_masakuliah',matches[0]);
  }
  async selectGroup(row,target) {
    const selects=await row.$$('select');
    for(const s of selects) {
      const data=await s.evaluate(e=>({name:e.name||e.id,opts:Array.from(e.options).map(o=>({value:o.value,text:o.text.trim()}))}));
      if(/kump|group/i.test(data.name)&&!/amali|lab/i.test(data.name)) {
        const o=data.opts.find(o=>o.text===String(target.lectureGroup)||o.value===String(target.lectureGroup));
        if(!o)throw Error('目标 Lecture Group 不可选');await s.select(o.value);
      }
      if(target.labGroup&&/amali|lab/i.test(data.name)&&/kump|group/i.test(data.name)) {
        const o=data.opts.find(o=>o.text===String(target.labGroup)||o.value===String(target.labGroup));
        if(!o)throw Error('目标 Lab Group 不可选');await s.select(o.value);
      }
    }
  }
  async enroll(target,{beforeSubmit=()=>{},canContinue=()=>true}={}) {
    if(target.labGroup)throw Error('带 Lab 的自动注册尚未适配，仅支持监听');
    const f=await this.registrationPage();
    if(matchRegistered([await this.sectionTable(f,'LIST OF COURSES REGISTERED :')],target))return {already:true};
    if(!pendingEmpty(await this.sectionTable(f,'LIST OF COURSES TO BE REGISTERED :')))throw Error('待注册列表非空，拒绝批量提交');
    await this.clickText(f,'button','SELECT OTHER COURSE');
    await f.waitForSelector('#facultyId',{visible:true});
    // Read live option values; do not assume the school uses fixed faculty IDs.
    await this.selectLabel(f,'#facultyId','ALL FACULTIES');
    await f.waitForFunction(()=>{const s=document.querySelector('#departmentId');return s&&Array.from(s.options).some(o=>o.text.trim()==='ALL DEPARTMENT');});
    await this.selectLabel(f,'#departmentId','ALL DEPARTMENT');
    await f.waitForFunction(()=>Array.from(document.querySelectorAll('#containerListing tr')).some(r=>r.querySelector('input[type=checkbox]')&&r.cells.length>1));
    const row=await this.filter(f,target.courseCode);
    const check=await row.$('input[type=checkbox]');if(!check)throw Error('课程选择控件缺失');await check.click();
    await f.waitForSelector('#select_taraf',{visible:true});
    this.dialog=null;await f.select('#select_taraf',target.category);
    await f.waitForSelector('#select_masakuliah',{visible:true});
    await this.selectTime(f,target.lectureTime);
    // checkClash asynchronously updates dependent group controls.
    await sleep(1500);
    if(this.dialog)throw Error('学校页面提示，需要人工检查');
    await this.selectGroup(row,target);
    if(!canContinue())throw Error('任务已停止，未确认添加');
    await this.clickText(f,'button','OK');
    await f.waitForFunction(course=>{const t=Array.from(document.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim()==='LIST OF COURSES TO BE REGISTERED :');let p=t;while(p){const table=p.querySelector('table');if(table)return table.textContent.includes(course);p=p.parentElement;}return false;},{timeout:10000},target.courseCode);
    const pending=await this.sectionTable(f,'LIST OF COURSES TO BE REGISTERED :');
    if(!matchRegistered([pending],target)||pending.length!==2)throw Error('待注册课程班级或性质不一致，暂停且不提交');
    if(!canContinue())throw Error('任务已停止，未提交注册；请检查待注册列表');
    beforeSubmit();
    await f.click('#registerbutton');
    await sleep(1500);
    if(!(await this.registered(target)))throw Error('注册结果未确认，请人工检查已注册列表');
    return {already:false};
  }
  async selectLabel(f,selector,label) {
    const value=await f.$eval(selector,(s,label)=>Array.from(s.options).find(o=>o.text.trim()===label)?.value,label);
    if(value===undefined)throw Error('缺少选项 '+label);await f.select(selector,value);
  }
  async close(){if(this.browser)await this.browser.close();this.browser=null;this.page=null;}
}
module.exports={UpmAdapter};
