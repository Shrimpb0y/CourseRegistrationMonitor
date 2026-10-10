const {test}=require('node:test');const assert=require('node:assert/strict');const {UpmAdapter}=require('../src/upm-adapter');
test('text click waits until fading popup overlay no longer intercepts button',async()=>{
 const calls=[];const button={getBoundingClientRect:()=>({x:10,y:10,width:100,height:30}),contains:hit=>hit===button};
 const h={evaluate:async(fn)=>{calls.push('evaluate');return true;},click:async()=>{assert.ok(calls.includes('uncovered'),'must wait for overlay before clicking');calls.push('click');}};
 const f={$$:async()=>[h],waitForFunction:async(fn,opts,handle)=>{
  assert.equal(handle,h);const old=global.document;
  try{global.document={elementFromPoint:()=>({id:'facebox_overlay'})};assert.equal(!!fn(button),false);
   global.document={elementFromPoint:()=>button};assert.equal(!!fn(button),true);calls.push('uncovered');
  }finally{if(old===undefined)delete global.document;else global.document=old;}
 }};
 await new UpmAdapter('.').clickText(f,'button','Search');assert.equal(calls.at(-1),'click');
});
test('complete timetable selection matches option values with different slot ordering',async()=>{
 const a=new UpmAdapter('.');let chosen;
 const frame={$eval:async()=>['','S08-10,K08'],select:async(_,value)=>{chosen=value;}};
 await a.selectTime(frame,'K08,S08-10');assert.equal(chosen,'S08-10,K08');
 await assert.rejects(a.selectTime(frame,'I10-12'),/完整上课时间/);
 frame.$eval=async()=>['S08-10,K08','K08,S08-10'];await assert.rejects(a.selectTime(frame,'K08,S08-10'),/重复/);
});
