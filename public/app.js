'use strict';
const $=id=>document.getElementById(id);const text=(id,value)=>$(id).textContent=value;
let state=null,requestBusy=false,lastSignal='',selectedCourse=null,options=null,lecture=null,lab=null,draft=false;
function message(value,error=false){text('message',value);$('message').className=error?'error':'';}
async function api(action,data){
 const r=await fetch('/api/'+action,{method:'POST',headers:{'x-local-token':token,'Content-Type':'application/json'},body:JSON.stringify(data||{})});
 const value=await r.json();if(!r.ok)throw Error(value.error||'操作失败');return value;
}
function controls(){
 const blocked=requestBusy||!state||state.running||state.busy;
 $('search-button').disabled=blocked;$('query').disabled=blocked;
 for(const e of document.querySelectorAll('#courses button,#groups input,#labs input,#category,#poll'))e.disabled=blocked;
 $('save').disabled=blocked||!lecture||!!state.needsReview||(options?.labs.length&&!lab);
 $('auto').disabled=requestBusy||!!state?.target.labGroup||draft;
 $('auto-button').disabled=requestBusy||!state||!$('auto').checked||!!state.target.labGroup||draft||state.busy;
 for(const b of document.querySelectorAll('[data-action]')){
  if(b.dataset.action==='start-auto')continue;
  b.disabled=requestBusy||!state||(b.dataset.action==='stop'?false:b.dataset.action==='start'?(draft||state.busy||state.needsReview):(state.running||state.busy));
 }
}
async function task(fn){if(requestBusy)return;requestBusy=true;controls();try{await fn();}catch(e){message(e.message,true);}finally{requestBusy=false;await refresh();controls();}}
function preview(){
 draft=!!selectedCourse;
 text('preview',lecture?`${selectedCourse.courseCode} · Group ${lecture.lectureGroup} · ${lecture.timeLabel}${lab?'；Lab '+lab.labGroup+' · '+lab.timeLabel:''} · ${$('category').value}`:'请选择教学班；满员班级也可以保存并监听。');
 $('auto').checked=false;controls();
}
function radioCard(container,name,value,title,detail,choose){
 const label=document.createElement('label');label.className='group';const input=document.createElement('input');input.type='radio';input.name=name;input.value=value;
 const strong=document.createElement('strong');strong.textContent=title;const desc=document.createElement('span');desc.className='small';desc.textContent=detail;
 label.append(input,strong,desc);input.onchange=choose;container.append(label);
}
async function chooseCourse(course,button){
 await task(async()=>{
  selectedCourse=course;options=null;lecture=null;lab=null;draft=true;
  $('groups').replaceChildren();$('labs').replaceChildren();text('lab-note','');preview();
  for(const b of $('courses').children)b.classList.toggle('selected',b===button);
  text('selected-course',course.courseCode+' · '+course.courseName);message('正在从 UPM 加载教学班和时间…');
  options=await api('groups',{courseCode:course.courseCode});
  for(const g of options.lectures)radioCard($('groups'),'lecture',g.lectureGroup,`Group ${g.lectureGroup} · ${g.timeLabel}`,`${g.timeVenue} · 容量 ${g.quota} / 已注册 ${g.registered} / 余量 ${g.quotaAvailable} / 可用 ${g.available}`,()=>{lecture=g;preview();});
  if(options.labs.length){
   const title=document.createElement('h3');title.textContent='Lab 班级（必选）';$('labs').append(title);
   for(const g of options.labs)radioCard($('labs'),'lab',g.labGroup,`Lab ${g.labGroup} · ${g.timeLabel}`,g.timeVenue,()=>{lab=g;preview();});
   text('lab-note','此课程有 Lab。保存后仅监测 Lecture 余量，带 Lab 自动注册暂不可用。');
  }
  message(`已加载 ${options.lectures.length} 个教学班。选择完整时间后保存目标；名额为本次查询快照。`);
 });
}
$('search-form').onsubmit=event=>{event.preventDefault();task(async()=>{
 const query=$('query').value.trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9]{1,12}$/.test(query))throw Error('请输入至少两位课程代码或前缀，例如 LPD');
 selectedCourse=null;options=null;lecture=null;lab=null;draft=false;$('courses').replaceChildren();$('groups').replaceChildren();$('labs').replaceChildren();text('selected-course','尚未选择课程');text('lab-note','');preview();
 message('正在搜索 UPM 课程…');const result=await api('courses',{query});text('course-note',result.note);
 for(const course of result.courses){const b=document.createElement('button');b.textContent=`${course.courseCode} · ${course.courseName}（${course.creditHours||'—'} 学分）`;b.onclick=()=>chooseCourse(course,b);$('courses').append(b);}
 message(result.courses.length?`找到 ${result.courses.length} 门课程，点击课程加载教学班。`:'未找到匹配课程，请检查代码或缩短前缀后重试。');
});};
$('category').onchange=preview;$('poll').onchange=()=>{if(selectedCourse)preview();};
$('save').onclick=()=>task(async()=>{
 const interval=Number($('poll').value);if(!Number.isInteger(interval)||interval<15||interval>3600)throw Error('查询间隔需为 15–3600 秒的整数');
 await api('target',{courseCode:selectedCourse.courseCode,lectureGroup:lecture.lectureGroup,category:$('category').value,labGroup:lab?.labGroup||'',pollIntervalSeconds:interval});
 draft=false;$('auto').checked=false;message('目标已保存到本机。点击“开始监听”执行首次只读查询；自动选课需要单独确认。');
});
$('auto').onchange=controls;
$('notify').onchange=async()=>{if($('notify').checked){if(!('Notification'in window)||await Notification.requestPermission()!=='granted'){$('notify').checked=false;message('桌面通知未启用，可通过本页查看结果。');}}};
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>task(async()=>{
 await api(b.dataset.action);message(b.dataset.action==='login'?'请在专用 Edge 中登录 UPM，然后搜索课程。':'操作成功');
});
async function refresh(){
 try{const r=await fetch('/api/status',{headers:{'x-local-token':token}});const s=await r.json();if(!r.ok)throw Error(s.error);state=s;
 text('target',`${s.target.courseCode}${s.target.courseName?' · '+s.target.courseName:''} · Group ${s.target.lectureGroup} · ${s.target.category}`);
 text('details',`完整时间 ${s.target.lectureTime}，Lab ${s.target.labGroup||'无'}${s.target.labTime?'（'+s.target.labTime+'）':''}`);
 text('state',s.status+(s.running?' · 运行中':''));text('busy',s.busy?'浏览器正在处理请求…':'');text('interval',s.interval+' 秒');
 text('checked',s.lastCheck?new Date(s.lastCheck).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'}):'尚未查询');
 text('seats',s.seats?`容量 ${s.seats.quota} / 已注册 ${s.seats.registered} / 余量 ${s.seats.quotaAvailable} / 可用 ${s.seats.available}`:'尚未读取');text('mode',s.autoEnroll?'自动选课':'仅监听');
 text('auto-note',s.target.labGroup?'此目标有 Lab，目前仅能监测 Lecture 余量，不能自动注册。':'默认仅监听。自动注册结果不确定时会暂停并要求核实。');
 if(s.error&&!requestBusy)message(s.error,true);
 const signal=s.status==='已注册'?'success':s.seats?.open?'open':s.status==='需要登录'?'login':s.needsReview?'review':'';
 if(signal&&signal!==lastSignal&&$('notify').checked&&'Notification'in window&&Notification.permission==='granted')new Notification('UPM 本地选课监听',{body:s.status});lastSignal=signal;controls();
 }catch(e){state=null;message('本地服务连接失败：'+e.message,true);controls();}
}
refresh();setInterval(refresh,3000);
