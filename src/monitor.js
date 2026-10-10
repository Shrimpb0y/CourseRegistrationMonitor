'use strict';
class Monitor {
  constructor(adapter,config,{persist=()=>{},notify=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),initial={}}={}) {
    this.adapter=adapter;this.config=config;this.persist=persist;this.notify=notify;this.schedule=schedule;this.cancel=cancel;
    this.state={running:false,autoEnroll:false,status:'未启动',lastCheck:null,seats:null,error:null,needsReview:false,...initial,running:false};
    this.busy=false;this.timer=null;this.failures=0;this.generation=0;
  }
  update(fields){Object.assign(this.state,fields);this.persist(this.state);}
  start(autoEnroll=false){
    if(this.state.needsReview)throw Error('上次注册结果需要人工检查，核实后才能恢复');
    if(this.state.running){this.update({autoEnroll});return;}
    if(this.busy)throw Error('请等待当前查询结束后再启动');
    this.generation++;this.update({running:true,autoEnroll,status:'监听中',error:null});
    void this.tick(this.generation);
  }
  stop(){this.generation++;this.cancel(this.timer);this.timer=null;this.update({running:false,status:'已停止'});}
  clearReview(){if(this.busy||this.state.running)throw Error('请先停止任务');this.update({needsReview:false,status:'待启动',error:null});}
  async tick(g=this.generation){
    if(!this.state.running||this.busy||g!==this.generation)return;
    this.busy=true;
    try {
      if(await this.adapter.registered(this.config.target)){
        if(g!==this.generation)return;
        this.update({running:false,status:'已注册',needsReview:false,error:null});this.notify('已确认目标课程注册成功');return;
      }
      const seats=await this.adapter.query(this.config.target);
      if(g!==this.generation)return;
      this.failures=0;this.update({seats,lastCheck:new Date().toISOString(),status:seats.open?'发现空位':'监听中',error:null});
      if(seats.open){
        this.notify('目标班级发现空位');
        if(this.state.autoEnroll){
          this.update({status:'准备注册',needsReview:true});
          await this.adapter.enroll(this.config.target,{beforeSubmit:()=>this.update({status:'注册处理中',needsReview:true}),canContinue:()=>this.state.running&&g===this.generation});
          this.update({running:false,status:'已注册',needsReview:false,error:null});this.notify('已确认目标课程注册成功');
        }
      }
    }catch(e){
      if(g!==this.generation)return;
      this.failures++;
      this.update({error:e.message,status:this.state.needsReview?'需要人工检查':(/登录|Edge/.test(e.message)?'需要登录':'查询异常'),running:this.state.needsReview?false:this.state.running});
    }finally{
      this.busy=false;
      if(this.state.running&&g===this.generation)this.timer=this.schedule(()=>void this.tick(g),Math.min(this.config.pollIntervalSeconds*1000*2**Math.min(this.failures,4),600000));
    }
  }
}
module.exports={Monitor};
