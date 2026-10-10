const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const http=require('node:http');const {createApp}=require('../src/server');
test('loopback API rejects foreign Host Origin and missing tokens',async(t)=>{
  const parent=path.resolve(__dirname,'../../../work');fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'upm-app-'));fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'public','index.html'),'<p>TOKEN_PLACEHOLDER</p>');
  const group={lectureGroup:'2',lectureTime:'I14-16,R10',timeLabel:'周一14–16；周三10',quota:28,registered:28,quotaAvailable:0,available:0};
  let releaseSearch;const fake={launch:async()=>{},page:{isClosed:()=>false},frame:async()=>{},registered:async()=>true,
   searchCourses:async q=>q==='WAIT'?new Promise(r=>{releaseSearch=r;}):[{courseCode:'LPD2107',courseName:'GERMAN I',creditHours:'3'},{courseCode:'SSW3310',courseName:'SOFTWARE',creditHours:'3'}],
   listGroups:async courseCode=>({courseCode,lectures:[group],labs:courseCode==='SSW3310'?[{labGroup:'3',labTime:'J09-11'}]:[]})};
  const app=createApp(root,{config:{port:18765,pollIntervalSeconds:30,target:{courseCode:'LPD2107',lectureGroup:'1',lectureTime:'I10-12,R09',category:'EL'}},adapter:fake});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.port=app.server.address().port;t.after(async()=>{try{app.monitor.stop();}finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}});
  const url='http://127.0.0.1:'+app.config.port;const homepage=await fetch(url);assert.match(homepage.headers.get('content-security-policy'),/script-src 'self'/,'local app.js must be allowed');const html=await homepage.text();const token=html.match(/<p>(\w+)<\/p>/)[1];
  const health=await fetch(url+'/health');assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{app:'upm-local-course-monitor',ok:true});
  assert.equal((await fetch(url+'/health',{headers:{origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(url+'/api/status')).status,403);
  assert.equal((await fetch(url+'/api/status',{headers:{'x-local-token':token,origin:'https://evil.test'}})).status,403);
  const foreignHost=await new Promise((resolve,reject)=>{const req=http.get(url+'/api/status',{headers:{'x-local-token':token,host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(foreignHost,403);
  assert.equal((await fetch(url+'/api/status',{headers:{'x-local-token':token}})).status,200);
  const post=(action,data)=>fetch(url+'/api/'+action,{method:'POST',headers:{'x-local-token':token,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('target',{courseCode:'LPD2107',lectureGroup:'2',category:'EL'})).status,400,'must load groups before saving');
  assert.equal((await post('courses',{query:'<script>'})).status,400);
  const courses=await post('courses',{query:'LPD'});assert.equal(courses.status,200);assert.equal((await courses.json()).courses[0].courseCode,'LPD2107');
  assert.equal((await post('groups',{courseCode:'SSW4300'})).status,400,'course must be selected from search');
  assert.equal((await post('groups',{courseCode:'LPD2107'})).status,200);
  assert.equal((await post('target',{courseCode:'LPD2107',lectureGroup:'9',category:'EL'})).status,400);
  const save=await post('target',{courseCode:'LPD2107',lectureGroup:'2',category:'EL',pollIntervalSeconds:45});assert.equal(save.status,200);
  const saved=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));assert.equal(saved.target.lectureTime,group.lectureTime);assert.equal(saved.target.courseName,'GERMAN I');
  assert.equal(app.monitor.state.seats,null);assert.equal(app.monitor.state.autoEnroll,false);assert.equal(app.monitor.state.lastCheck,null);
  assert.equal((await post('groups',{courseCode:'SSW3310'})).status,200);
  assert.equal((await post('target',{courseCode:'SSW3310',lectureGroup:'2',category:'EL'})).status,400,'lab choice required');
  assert.equal((await post('target',{courseCode:'SSW3310',lectureGroup:'2',labGroup:'3',category:'FE'})).status,400,'invalid category rejected');
  app.monitor.state.needsReview=true;assert.equal((await post('target',{courseCode:'SSW3310',lectureGroup:'2',labGroup:'3',category:'EL'})).status,400);app.monitor.state.needsReview=false;
  assert.equal((await post('target',{courseCode:'SSW3310',lectureGroup:'2',labGroup:'3',category:'EL'})).status,200);
  assert.equal(app.config.target.courseCode,'SSW3310');assert.equal(app.monitor.config.target.labTime,'J09-11');
  assert.equal((await post('start-auto',{})).status,400,'lab auto-enroll is blocked at API boundary');
  assert.equal(createApp(root,{adapter:fake}).config.target.courseCode,'SSW3310','saved target survives a new app instance');
  const waiting=post('courses',{query:'WAIT'});while(!releaseSearch)await new Promise(r=>setTimeout(r,5));
  assert.equal((await post('start',{})).status,400,'cannot start while browser selection is busy');
  assert.equal((await post('courses',{query:'LPD'})).status,400,'browser operations are serialized');releaseSearch([]);assert.equal((await waiting).status,200);
  app.monitor.state.running=true;assert.equal((await post('courses',{query:'LPD'})).status,400);app.monitor.state.running=false;
  for(const action of ['login','start','stop','review-clear']){const r=await fetch(url+'/api/'+action,{method:'POST',headers:{'x-local-token':token}});const body=await r.text();assert.equal(r.status,200,action+': '+body);}
  assert.equal((await fetch(url+'/api/unknown',{method:'POST',headers:{'x-local-token':token}})).status,404);
  assert.equal((await fetch(url+'/missing',{headers:{'x-local-token':token}})).status,404);
});
