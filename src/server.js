'use strict';
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {validateConfig}=require('./core');const {UpmAdapter}=require('./upm-adapter');const {Monitor}=require('./monitor');
function createApp(root,{adapter,config}={}){
  config=validateConfig(config||JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')));
  const runtime=path.join(root,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const stateFile=path.join(runtime,'state.json');let initial={};
  if(fs.existsSync(stateFile)){try{const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));initial={needsReview:!!saved.needsReview};}catch{initial={needsReview:true};}}
  adapter=adapter||new UpmAdapter(root);const token=crypto.randomBytes(24).toString('hex');
  let operationBusy=false;let courses=[];let groupOptions=null;
  async function body(req){
    let value='';for await(const chunk of req){value+=chunk.toString('utf8');if(Buffer.byteLength(value)>16384)throw Error('请求内容过大');}
    try{return JSON.parse(value||'{}');}catch{throw Error('请求内容不是有效 JSON');}
  }
  async function selection(fn){
    if(operationBusy||monitor.busy||monitor.state.running)throw Error('请先停止监听，等待当前操作结束后再选择课程');
    operationBusy=true;try{await adapter.frame();return await fn();}finally{operationBusy=false;}
  }
  const monitor=new Monitor(adapter,config,{initial,persist:s=>{
    fs.writeFileSync(stateFile+'.tmp',JSON.stringify(s,null,2));fs.renameSync(stateFile+'.tmp',stateFile);
    fs.appendFileSync(path.join(runtime,'events.jsonl'),JSON.stringify({time:new Date().toISOString(),status:s.status,seats:s.seats,needsReview:s.needsReview})+'\n');
  },notify:message=>{fs.appendFileSync(path.join(runtime,'notifications.jsonl'),JSON.stringify({time:new Date().toISOString(),message})+'\n');}});
  const server=http.createServer(async(req,res)=>{
    const host=req.headers.host;
    const allowedHost=host===`127.0.0.1:${config.port}`||host===`localhost:${config.port}`;
    const origin=req.headers.origin;
    const allowedOrigin=!origin||origin===`http://127.0.0.1:${config.port}`||origin===`http://localhost:${config.port}`;
    const json=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
    if(!allowedHost||!allowedOrigin)return json(403,{error:'仅允许本机管理页面访问'});
    try{
      if(req.method==='GET'&&req.url==='/health')return json(200,{app:'upm-local-course-monitor',ok:true});
      if(req.method==='GET'&&req.url==='/app.js'){
        res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(fs.readFileSync(path.join(root,'public','app.js'),'utf8'));return;
      }
      if(req.method==='GET'&&req.url==='/'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'"});
        res.end(fs.readFileSync(path.join(root,'public','index.html'),'utf8').replace('TOKEN_PLACEHOLDER',token));return;
      }
      if(req.headers['x-local-token']!==token)return json(403,{error:'本地令牌无效，请刷新页面'});
      if(req.method==='GET'&&req.url==='/api/status')return json(200,{...monitor.state,target:config.target,interval:config.pollIntervalSeconds,busy:monitor.busy||operationBusy});
      if(req.method!=='POST')return json(404,{error:'未找到'});
      if(req.url==='/api/courses'){
        const data=await body(req);const query=String(data.query||'').trim().toUpperCase();
        if(!/^[A-Z][A-Z0-9]{1,12}$/.test(query))throw Error('请输入至少两位课程代码或前缀，例如 LPD、LPD2107');
        const result=await selection(async()=>{courses=[];groupOptions=null;courses=await adapter.searchCourses(query);return courses;});
        return json(200,{courses:result,note:'返回学校搜索弹窗当前页；结果较多时请输入更完整的课程代码'});
      }
      if(req.url==='/api/groups'){
        const data=await body(req);const course=courses.find(c=>c.courseCode===data.courseCode);
        if(!course)throw Error('请先搜索并选择结果中的课程');
        const result=await selection(async()=>{groupOptions=null;groupOptions=await adapter.listGroups(course.courseCode);return groupOptions;});
        return json(200,{...result,course,loadedAt:new Date().toISOString()});
      }
      if(req.url==='/api/target'){
        const data=await body(req);
        if(operationBusy||monitor.busy||monitor.state.running)throw Error('请先停止监听，等待当前操作结束');
        if(monitor.state.needsReview)throw Error('请先核实上次注册结果并解除暂停，再切换目标');
        if(!groupOptions||groupOptions.courseCode!==data.courseCode)throw Error('请先加载该课程的教学班');
        const course=courses.find(c=>c.courseCode===data.courseCode);
        const lecture=groupOptions.lectures.find(g=>g.lectureGroup===String(data.lectureGroup));
        if(!course||!lecture)throw Error('请选择已加载列表中的教学班');
        const lab=groupOptions.labs.find(g=>g.labGroup===String(data.labGroup));
        if(groupOptions.labs.length&&!lab)throw Error('该课程有 Lab，请同时选择实验班');
        if(!groupOptions.labs.length&&data.labGroup)throw Error('该课程没有已加载的 Lab 班级');
        const next=validateConfig({...config,pollIntervalSeconds:data.pollIntervalSeconds??config.pollIntervalSeconds,target:{courseCode:course.courseCode,courseName:course.courseName,lectureGroup:lecture.lectureGroup,lectureTime:lecture.lectureTime,category:data.category,labGroup:lab?.labGroup||'',labTime:lab?.labTime||''}});
        const configPath=path.join(root,'config.json');fs.writeFileSync(configPath+'.tmp',JSON.stringify(next,null,2)+'\n');fs.renameSync(configPath+'.tmp',configPath);
        Object.assign(config,next);monitor.generation++;monitor.failures=0;
        monitor.update({autoEnroll:false,status:'目标已保存，待启动',lastCheck:null,seats:null,error:null});
        return json(200,{ok:true,target:config.target});
      }
      if(req.url==='/api/login'){
        if(operationBusy||monitor.busy||monitor.state.running)throw Error('请先停止监听并等待当前查询结束');
        operationBusy=true;try{await adapter.launch();courses=[];groupOptions=null;}finally{operationBusy=false;}return json(200,{ok:true});
      }
      if(req.url==='/api/start'||req.url==='/api/start-auto'){
        if(operationBusy)throw Error('请等待课程选择操作结束');
        if(req.url==='/api/start-auto'&&config.target.labGroup)throw Error('带 Lab 的自动注册尚未适配，请使用仅监听模式');
        if(!adapter.page||adapter.page.isClosed())throw Error('请先打开独立 Edge 并登录');
        await adapter.frame();monitor.start(req.url==='/api/start-auto');return json(200,{ok:true});
      }
      if(req.url==='/api/stop'){monitor.stop();return json(200,{ok:true});}
      if(req.url==='/api/shutdown'){
        json(200,{ok:true});monitor.stop();setImmediate(async()=>{await adapter.close();server.close();});return;
      }
      if(req.url==='/api/review-clear'){monitor.clearReview();return json(200,{ok:true});}
      return json(404,{error:'未找到'});
    }catch(e){return json(400,{error:e.message});}
  });
  return {server,monitor,adapter,config};
}
if(require.main===module){
  const root=path.resolve(__dirname,'..');const app=createApp(root);
  app.server.listen(app.config.port,'127.0.0.1',()=>console.log(`UPM 本地管理 http://127.0.0.1:${app.config.port}`));
  app.server.on('error',e=>{console.error(e.message);process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{app.monitor.stop();await app.adapter.close();app.server.close();});
}
module.exports={createApp};
