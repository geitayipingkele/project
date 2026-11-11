/* V0.16 interaction layer. All data remains local demo data. */
const v10BaseFresh = fresh;
const v10BaseModal = modal;
const v10BaseSettings = settings;
const v10BaseDevices = devices;
const v10BaseHeader = header;

function v10Upgrade(s) {
  // Remove records created by the withdrawn ordinary-inclusion flow, including saved V0.10 states.
  const ordinaryIds=new Set(['add','includeUnused','excludeUnused']);
  for (const key of ['oldTree','newTree','currentTree']) if (Array.isArray(s[key])) s[key]=s[key].filter(n=>n.id!==UNUSED);
  if (Array.isArray(s.checked4a)) s.checked4a=s.checked4a.filter(id=>id!==UNUSED);
  s.selectedChanges=[];s.batchMessage='';s.batchBlocked=false;
  if (s.page==='plan'&&s.confirmed?.replace) s.page='compare';
  if (s.confirmed) for (const id of ordinaryIds) delete s.confirmed[id];
  if (s.config) delete s.config[UNUSED];
  if (Array.isArray(s.records)) s.records=s.records.filter(r=>!ordinaryIds.has(r.changeId)&&r.type!=='系统首次纳入'&&r.type!=='普通移出');
  if (Array.isArray(s.events)) s.events=s.events.filter(e=>!/(系统首次纳入确认|普通纳入调整|普通移出|新增确认)/.test(e.what||''));
  if (['exception','item','selected-review'].includes(s.modal?.type)) s.modal=null;
  for (const i of s.items||[]) i.demoFailure ??= !!(scenarios[s.scenario]?.fail&&i.id==='D-1002');
  const sourceChild=pick(s.newTree||[],CHILD),sourceParent=pick(s.newTree||[],sourceChild?.parent);
  if (sourceChild&&sourceParent&&s.confirmed?.replace) {
    const savedTarget=s.v10?.selectedTarget||s.candidate;
    for (const r of s.records||[]) if (r.changeId==='child'&&r.taskId) {
      r.next=`${sourceChild.name} / ${sourceParent.name}`;
      if (savedTarget) r.method=savedTarget===sourceParent.id?'随上级调整':'按最新 4A 调整';
    }
    const currentChild=pick(s.currentTree||[],CHILD);
    if (currentChild) currentChild.parent=sourceParent.id;
    if (currentChild&&!pick(s.currentTree,sourceParent.id)) s.currentTree.push({...sourceParent});
  }
  if (s.schema === 11) {
    s.v10 ||= {};
    s.v10.permissionInput ||= {name:'',kind:'',status:''};
    s.v10.permissionFilter ||= {name:'',kind:'',status:''};
    s.v10.candidateTouched ??= false;
    if (!['compare','tasks'].includes(s.v10.resultSource)) s.v10.resultSource='tasks';
    s.v10.retryIds ||= [];
    s.v10.retryPending ??= false;
    s.v10.retryEventIndex ??= null;
    s.v10.impactStatus ??= '';
    s.v10.impactStatusInput ??= '';
    s.v10.historyInput ??= '';
    s.v10.historyFilter ??= '';
    if (s.v10.selectedRecordId && !s.records?.some(r=>r.id===s.v10.selectedRecordId)) s.v10.selectedRecordId=null;
    for (const f of [s.v10.filter,s.v10.filterInput]) if (f?.type==='系统首次纳入') f.type='';
    s.v10.recordMessage='';
    s.permissionPage ||= 1;s.historyPage ||= 1;s.taskPage ||= 1;
    return s;
  }
  const now = new Date().toLocaleString('zh-CN', {hour12:false});
  const c=scenarios[s.scenario], target=(pick(s.newTree,s.candidate)||pick(s.newTree,NEW))?.name||c.next;
  const oldRecords={
    replace:['替代 / 删除',c.old,target,`替代为 ${target}`],child:['上级调整',`新陂供电所 / ${c.old}`,`新陂供电所 / ${sourceParent?.name||c.next}`,!s.candidate||s.candidate===sourceParent?.id?'随上级调整':'按最新 4A 调整'],
    rename:['名称修改','潮州供电局','潮州供电局有限公司','按源更新'],info:['信息修改','平远局','平远供电','按源更新']
  };
  s.records=Object.entries(oldRecords).filter(([id])=>s.confirmed?.[id]).map(([id,fields],i)=>({
    id:`DEMO-REC-${String(i+1).padStart(3,'0')}`,changeId:id,type:fields[0],old:fields[1],next:fields[2],method:fields[3],
    at:(s.events||[]).find(e=>id==='replace'||id==='child'?/替代及下级调整确认/.test(e.what):e.what.includes(`${fields[0]}确认`))?.at||now,
    by:'运营人员',taskId:['replace','child'].includes(id)?'DEMO-TASK-01':null,result:'已保存'
  }));
  s.v10 = {filterInput:{name:'', type:'', system:'', status:''}, filter:{name:'', type:'', system:'', status:''},
    choice:{}, proposed:{}, selectedRecordId:null, resultSource:'tasks', selectedTarget:s.confirmed?.replace ? (s.candidate || NEW) : '', candidateTouched:false,
    submitPending:false, draftVersion:0, settingsDraft:{}, recordMessage:'',
    permissionInput:{name:'',kind:'',status:''},permissionFilter:{name:'',kind:'',status:''},
    historyInput:'',historyFilter:'',retryIds:[],retryPending:false,retryEventIndex:null,impactStatus:'',impactStatusInput:''};
  s.taskPage=1;
  s.permissionPage=1;s.historyPage=1;
  s.schema = 11;
  return s;
}
fresh = function(key='normal') { return v10Upgrade(v10BaseFresh(key)); };
state = v10Upgrade(state);
const v10 = () => state.v10;
const targetId = () => state.confirmed.replace ? (v10().selectedTarget || state.candidate || (state.v17?.exitWithoutTarget?'':NEW)) : state.candidate;
const targetNode = () => pick(state.newTree, targetId());
const targetName = () => targetNode()?.name || '';
const targetConfig = () => state.config[targetId()] || null;
const hasTarget = () => !!targetNode();
const targetPath = () => hasTarget() ? `中国南方电网 / 广东电网 / 梅州供电局 / ${targetName()}` : '待选择';
function defaultTargetId() {
  const sourceParent=pick(state.newTree,CHILD)?.parent;
  return v10Options().some(n=>n.id===sourceParent) ? sourceParent : '';
}
function openReplaceDetail() {
  if (!state.confirmed.replace && !state.candidate && !v10().candidateTouched) state.candidate=defaultTargetId();
  v10().compareScroll=window.scrollY;
  navigate('plan');
}
function openResult(id,source) {
  if (!state.records.some(r=>r.id===id)) return;
  v10().resultSource=source;
  if (state.page===source) v10()[source==='compare'?'compareScroll':'tasksScroll']=window.scrollY;
  v10().selectedRecordId=id;
  navigate('detail');
}
header = function() {return v10BaseHeader().replace('<button class="head-btn">工作台</button><button class="head-btn">个性化配置</button>','<span class="head-btn" aria-disabled="true">工作台</span><span class="head-btn" aria-disabled="true">个性化配置</span>');};

function v10Changes() {
  return changes().map(x => {
    if (x.id === 'replace') return {...x, next:targetName() || '待选择', method:targetName() ? `替代为 ${targetName()}` : '待选组织节点'};
    if (x.id === 'child') {const parent=pick(state.newTree,CHILD)?.parent;return {...x, next:`新陂供电所 / ${nodeName(parent)}`,method:parent===targetId()?'随上级调整':'按最新 4A 调整'};}
    return x;
  });
}
function v10ResultSummary(r, job) {
  const raw=job?.status||(r.taskId?taskStatus():'已完成');
  const status=['已完成','需处理'].includes(raw)?raw:'处理中';
  const end=job?job.history.find(e=>e.what==='更新及核验完成')?.at||(!job.items.length?job.at:null):r.taskId?state.events.filter(e=>e.what==='自动核验与操作限制'&&e.result==='核验通过，限制已解除').at(-1)?.at:r.at;
  return `<div class="detail-grid"><b>处理方式</b><span>${job?'系统自动处理':'用户手动确认'}</span><b>处理人</b><span>${safe(job?'系统':r.by||'—')}</span><b>处理开始时间</b><span>${safe(job?.startedAt||job?.at||r.at)}</span><b>处理状态</b><span>${pill(status)}</span>${status==='已完成'?'<b>处理结束时间</b><span>'+safe(end||'—')+'</span>':''}<b>来源版本</b><span>平台留存全量旧数据 → 本次接收全量数据</span></div>`;
}
function v10ResultConfigCells(r) {
  const replaced=r.confirmedConfig!==undefined?!!r.confirmedConfig:
    r.changeId==='replace'&&r.method?.startsWith('替代为 ')||
    r.changeId?.startsWith('branch:')&&r.next!=='无替代退出'&&r.method==='随组替代';
  return ['type','region'].map(key=>`<td>${safe(replaced?r.confirmedConfig?.[key]||'未记录':'未变更')}</td>`).join('');
}
function v10Record(id, taskId=null) {
  const x=v10Changes().find(c=>c.id===id);
  if (!x || state.records.some(r=>r.changeId===id)) return;
  const target=id==='replace'?targetId():id.startsWith('branch:')?state.v17?.mappings?.[id.slice(7)]:null;
  const config=target?state.config[target]:null;
  const confirmedConfig=target?{type:config?.type??null,region:config?.region??null}:null;
  const nextId=Math.max(0,...state.records.map(r=>Number(String(r.id).match(/\d+$/)?.[0])||0))+1;
  state.records.push({id:`DEMO-REC-${String(nextId).padStart(3,'0')}`,changeId:id,
    type:x.type,old:x.old,next:x.next,method:x.method,at:new Date().toLocaleString('zh-CN',{hour12:false}),
    by:'运营人员',result:'已保存',taskId,confirmedConfig});
}
function v10Options() {
  return state.newTree.filter(n => n.parent === MZ && n.id !== OLD && n.id !== EXTRA && n.id !== CHILD);
}
function v10ConfigValue(field) {
  if (!hasTarget()) return null;
  const a=state.config[OLD], b=targetConfig(), option=v10().choice[field];
  if (field === 'type') return option==='old'?a.type:option==='new'&&b?b.type:ORG_TYPES.includes(v10().proposed.type)?v10().proposed.type:'全部';
  if (!b || b[field] == null || b[field] === '') return a[field];
  if (a[field] === b[field]) return a[field];
  if (option === 'old') return a[field];
  if (option === 'new') return b[field];
  if (option === 'custom') return v10().proposed[field];
  return null;
}
chosenConfig = function() {
  const original=state.config[OLD];
  return {type:v10ConfigValue('type'), division:original.division,
    region:v10ConfigValue('region'), terminal:original.terminal};
};
changeReason = function(x) {
  if (x.id === 'replace') {
    if (!hasTarget() || !v10Options().some(n=>n.id===targetId())) return '请选择有效的组织节点';
    const c=chosenConfig();
    for (const field of ['type','division','region','terminal']) if (c[field] === null || c[field] === undefined || c[field] === '') return '请确定机构配置差异的拟使用值';
    if (!c.region) return '请确定关联行政区域';
  }
  if (x.id === 'child' && !state.confirmed.replace) return '上级调整请在详情中处理';
  return '';
};
applyChange = function(id) {
  if (id === 'replace') {
    const dest=targetId();
    const sourceParent=pick(state.newTree,CHILD).parent;
    state.currentTree=state.currentTree.filter(n=>n.id!==OLD).map(n=>n.id===CHILD?{...n,parent:sourceParent}:n);
    for (const nodeId of [dest,sourceParent]) {
      if (!pick(state.currentTree,nodeId)) state.currentTree.push({...pick(state.newTree,nodeId)});
    }
    state.checked4a=[...new Set([...state.checked4a,dest,sourceParent])];
    state.confirmed.child=true;
    state.configApplied={...chosenConfig()};
    state.config[dest]={...state.config[dest],...state.configApplied};
    state.scan={status:'checking',started:Date.now(),countsAt:0};
    state.stage='migrating';
    state.nextStepAt=Date.now()+1600;
    v10().selectedTarget=dest;
    return;
  }
  if (id==='rename') Object.assign(pick(state.currentTree,OTHER),pick(state.newTree,OTHER));
  if (id==='info') {Object.assign(pick(state.currentTree,PEER),pick(state.newTree,PEER));state.config[PEER].short=pick(state.newTree,PEER).short;}
};
confirmChange = function(id) {
  const x=v10Changes().find(c=>c.id===id);
  if (!x || id==='add' || state.confirmed[id] || changeReason(x)) return 0;
  state.confirmed[id]=true;
  applyChange(id);
  if (id==='replace') {
    v10Record('replace','DEMO-TASK-01');v10Record('child','DEMO-TASK-01');
    eventLog(`${cfg().old} → ${targetName()} 替代及下级调整确认`,'已保存并生效，关联迁移任务已创建','运营人员');
    return 1;
  }
  v10Record(id);
  eventLog(`${x.type}确认`,'已保存；无需关联迁移','运营人员');
  return 1;
};
function v10FailureReason(i) {
  if (i.id==='D-1002') return '台区智能网关 02 的设备档案写入超时，当前实际归属仍为原机构';
  if (i.kind==='query') return `${i.name} 的查询授权写入冲突，当前实际授权仍指向原机构`;
  if (i.id==='D-1106') return `${i.name} 的设备档案写入超时，源机构关联尚未完成；请核对终端档案同步、所属台区映射及重新处理前的写入条件，当前实际归属仍为原机构。`;
  return `${i.name} 的设备档案写入超时，当前实际归属仍为原机构`;
}
function v10Retry(kind=null) {
  const record=state.records.find(r=>r.id===v10().selectedRecordId);
  if (!record?.taskId || state.stage!=='needsAction' || v10().retryPending) return;
  const failed=state.items.filter(i=>i.status==='失败'&&(!kind||i.kind===kind));
  if (!failed.length) return;
  v10().retryIds=failed.map(i=>i.id);v10().retryPending=true;
  v10().retryEventIndex=state.events.length;
  eventLog(kind?`${labels[kind]}分类重新处理`:'全任务批量重试',`已提交 ${failed.length} 项原失败记录，处理中`,'运营人员');
  state.events[v10().retryEventIndex].taskId=record.taskId;
  for (const i of failed) {i.lastReason=i.reason;i.reason='';i.status='处理中';}
  state.stage='retrying';state.nextStepAt=Date.now()+450;
  render();
}
automaticStep = function() {
  if (state.stage==='migrating') {
    const i=state.items.find(x=>x.status==='等待处理');
    if (i) {
      i.tries++;
      if (i.demoFailure&&!state.recoveryReady) {i.status='失败';i.reason=v10FailureReason(i);eventLog(`${labels[i.kind]}关联处理异常`,i.reason);}
      else {i.status='成功';i.actual=i.targetOverride||targetId();i.reason='';}
      state.nextStepAt+=cfg().multi?300:1400;return;
    }
    if (state.items.some(x=>x.status==='失败')) {state.stage='needsAction';state.nextStepAt=0;eventLog('关联处理',`${stats().failed} 项异常需处理`);}
    else {state.stage='verifying';state.nextStepAt+=1500;eventLog('关联处理','已完成，自动核验中');}
    return;
  }
  if (state.stage==='retrying') {
    const i=state.items.find(x=>v10().retryIds.includes(x.id)&&x.status==='处理中');
    if (i) {
      i.tries++;
      if (i.demoFailure&&!state.recoveryReady) {i.status='失败';i.reason=v10FailureReason(i);}
      else {i.status='成功';i.actual=i.targetOverride||targetId();i.reason='';i.lastReason='';}
      state.nextStepAt+=700;return;
    }
    const scope=new Set(v10().retryIds),success=state.items.filter(i=>scope.has(i.id)&&i.status==='成功').length;
    const failed=state.items.filter(i=>scope.has(i.id)&&i.status==='失败').length;
    const entry=Number.isInteger(v10().retryEventIndex)?state.events[v10().retryEventIndex]:null;
    if (entry?.who==='运营人员') entry.result=`本次 ${scope.size} 项：成功 ${success} 项，失败 ${failed} 项${failed?'，仍需处理':'，处理完成'}`;
    v10().retryIds=[];v10().retryPending=false;v10().retryEventIndex=null;
    if (state.items.some(x=>x.status==='失败')) {state.stage='needsAction';state.nextStepAt=0;eventLog('重新处理',`仍有 ${stats().failed} 项异常`);}
    else {state.stage='verifying';state.nextStepAt+=900;eventLog('重新处理','原失败项已处理，自动核验中');}
    return;
  }
  if (state.stage==='verifying') {
    if (state.items.some(i=>i.actual!==(i.targetOverride||targetId())||i.status!=='成功')) {state.stage='needsAction';eventLog('自动核验','未通过，需处理异常');}
    else {state.stage='done';state.verified=true;eventLog('自动核验与操作限制','核验通过，限制已解除');}
    state.nextStepAt=0;
  }
};

function v10FilteredChanges() {
  const f=v10().filter;
  return v10Changes().filter(x =>
    (!f.name || `${x.old}${x.next}${x.type}`.includes(f.name)) &&
    (!f.type || x.type===f.type) &&
    (!f.system || (f.system==='yes')===!!x.system) &&
    (!f.status || (x.id!=='add' && (f.status==='done')===!!state.confirmed[x.id])));
}
const requiresDetail=id=>id==='replace'||id==='child';
compare = function() {
  const all=v10FilteredChanges(), start=(state.changePage-1)*state.pageSize;
  const page=all.slice(start,start+state.pageSize);
  const f=v10().filterInput;
  return `<section class="card list-card"><div class="section-head"><div class="section-title">处理变更</div><button class="btn" data-page="manage">返回组织机构管理</button></div>
    <div class="toolbar"><input class="field" data-v10-filter="name" value="${safe(f.name)}" placeholder="请输入机构名称或变更类型">
    <select class="field" data-v10-filter="type"><option value="">全部变更类型</option>${[...new Set(v10Changes().map(x=>x.type))].map(t=>`<option value="${safe(t)}" ${f.type===t?'selected':''}>${safe(t)}</option>`).join('')}</select>
    <select class="field" data-v10-filter="system"><option value="">全部系统使用状态</option><option value="yes" ${f.system==='yes'?'selected':''}>已纳入</option><option value="no" ${f.system==='no'?'selected':''}>未纳入</option></select>
    <select class="field" data-v10-filter="status"><option value="">全部处理状态</option><option value="pending" ${f.status==='pending'?'selected':''}>待确认</option><option value="done" ${f.status==='done'?'selected':''}>已确认</option></select>
    <button class="btn primary" data-v10-action="query-change">查询</button><button class="btn" data-v10-action="reset-change">重置</button></div>
    <div class="table-wrap list-table"><table><thead><tr><th>变更类型</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>原系统使用</th><th>处理方式</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${page.map(x=>`<tr><td>${safe(x.type)}</td><td>${safe(x.old)}</td><td>${safe(x.next)}</td><td>${x.system?'已纳入':'未纳入'}</td><td>${safe(x.method)}</td><td>${pill(x.id==='add'?'源新增':state.confirmed[x.id]?'已确认':requiresDetail(x.id)?'需处理':changeReason(x)?'需处理':'待确认')}</td><td>${x.id==='add'?`<button class="link" data-page="manage">查看组织管理</button>`:state.confirmed[x.id]?`<button class="link" data-v10-action="change-detail" data-id="${x.id}">查看处理结果</button>`:requiresDetail(x.id)?`<button class="link" data-v10-action="change-detail" data-id="${x.id}">处理</button>`:`<button class="link" data-v10-action="confirm-one" data-id="${x.id}" ${v10().submitPending?'disabled':''}>确认</button>`}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">${v10Changes().length?'暂无匹配结果，可重置筛选':'暂无变更记录'}</td></tr>`}</tbody></table></div>
    ${pagination(all.length,state.changePage,'changePage')}</section>`;
};

function v10ChoiceControl(field, a, b) {
  const choice=v10().choice[field]||'';
  const shown=value=>field==='terminal'?(value?'启用':'停用'):String(value);
  if (!hasTarget()) return '<span class="muted">待选择组织节点</span>';
  if (field==='type') return `<select class="field" aria-label="机构类型" data-v10-custom="type">${ORG_TYPES.map(type=>`<option ${v10ConfigValue('type')===type?'selected':''}>${type}</option>`).join('')}</select>`;
  if (!b || b === '') return `<span>沿用原机构：${safe(shown(a))}</span>`;
  if (a===b && !choice) return `<span>${safe(shown(a))}</span>`;
  let extra='';
  if (choice==='custom' && field==='region') extra=`<select class="field" data-v10-custom="region"><option value="">请选择行政区域</option>${[a,b,'广东省 / 梅州市','广东省 / 潮州市'].filter((x,i,arr)=>arr.indexOf(x)===i).map(x=>`<option ${v10().proposed.region===x?'selected':''}>${safe(x)}</option>`).join('')}</select>`;
  return `<select class="field" data-v10-choice="${field}"><option value="">请选择处理方式</option><option value="old" ${choice==='old'?'selected':''}>沿用原机构</option><option value="new" ${choice==='new'?'selected':''}>保留所选机构</option>${['type','region'].includes(field)?`<option value="custom" ${choice==='custom'?'selected':''}>自定义</option>`:''}</select>${extra}`;
}
plan = function() {
  const a=state.config[OLD],b=targetConfig(),c=chosenConfig(),locked=v10().submitPending;
  const fields=[['type','机构类型','用户组织机构、项目/设备单位'],['division','部门/单位','单位'],['region','关联行政区域','广东省 / 梅州市'],['terminal','终端挂靠权限','启用']];
  return `<section class="card list-card"><div class="section-head"><div class="section-title">变更详情 · ${safe(cfg().old)}</div><button class="btn" data-page="compare">返回处理变更</button></div>
  <div class="detail-grid"><b>原机构</b><span>${safe(cfg().old)} · DEMO-OLD</span><b>源侧状态</b><span>最新 4A 中已删除</span><b>原路径</b><span>中国南方电网 / 广东电网 / 梅州供电局 / ${safe(cfg().old)}</span><b>系统使用</b><span>当前仍已纳入</span></div>
  <div class="section-head v10-gap"><div class="section-title">机构变更</div></div>
  <div class="toolbar"><select id="candidate-select" class="field" aria-label="组织节点" ${locked?'disabled':''}><option value="">请选择机构</option>${v10Options().map(n=>`<option value="${n.id}" ${targetId()===n.id?'selected':''}>${safe(n.name)} · ${safe(n.code)}</option>`).join('')}</select><span class="subtle">系统自行判断的替代节点，可依据实际业务调整</span></div>
  <div class="detail-grid"><b>当前所选</b><span>${hasTarget()?safe(targetName()):'待选择'}</span><b>机构编码</b><span>${hasTarget()?safe(targetNode().code):'待选择'}</span><b>所属路径</b><span>${safe(targetPath())}</span><b>系统使用</b><span>${hasTarget()?(pick(state.currentTree,targetId())?'已纳入':'待纳入'):'待选择'}</span><b>下级调整</b><span>新陂供电所按最新 4A 归属 ${safe(nodeName(pick(state.newTree,CHILD)?.parent))}</span></div>
  <div class="section-head v10-gap"><div class="section-title">机构配置差异 · ${hasTarget()?safe(targetName()):'待选择机构'}</div></div>
  <div class="table-wrap list-table"><table><thead><tr><th>配置项</th><th>原机构配置</th><th>所选机构现配置</th><th>调整后配置</th></tr></thead><tbody>
  ${fields.map(([field,label])=>{const original=a[field],actual=b?.[field],proposed=c[field];const display=x=>x===null||x===undefined?'待确定':field==='terminal'?(x?'启用':'停用'):String(x);return `<tr><td>${label}</td><td>${safe(display(original))}</td><td>${b?safe(display(actual)):'未配置'}</td><td>${v10ChoiceControl(field,original,actual)}<div class="proposed">拟使用：${safe(display(proposed))}</div></td></tr>`}).join('')}</tbody></table></div>
  <div class="flex v10-gap" style="justify-content:flex-end"><button class="btn primary" data-v10-action="confirm-replace" ${v10().submitPending?'disabled':''}>${v10().submitPending?'确认中…':'确认'}</button></div></section>`;
};

manage = function() {
  const all=v10Changes().filter(x=>x.id!=='add'),done=all.filter(x=>state.confirmed[x.id]).length;
  return `<div class="card manage-card"><div class="intro-line"><span class="minor">系统管理 / 组织机构管理　${pill(`已确认 ${done} / ${all.length} 项`)}</span><div class="flex"><button class="btn" data-page="compare">处理变更</button></div></div>
  <div class="tree-grid"><section class="tree-panel"><div class="panel-heading"><span>4A组织机构树</span><button class="btn primary" data-v10-action="save-org">保存</button></div><input class="field search" data-search="manage4a" value="${safe(state.search.manage4a)}" placeholder="请输入搜索条件"><div class="tree-scroll">${sourceTree(state.newTree,'manage4a',true)}</div></section><section class="tree-panel"><div class="panel-heading"><span>系统组织机构树</span></div><input class="field search" data-search="manageSystem" value="${safe(state.search.manageSystem)}" placeholder="请输入搜索条件"><div class="tree-scroll">${sourceTree(state.currentTree,'manageSystem')}</div></section></div></div>`;
};

function v10DisplayRecords() {
  const records=state.records||[];
  return records.filter(r=>r.changeId!=='child'||!r.taskId||!records.some(p=>p.changeId==='replace'&&p.taskId===r.taskId));
}
function v10GroupRecords(r) {
  return r.taskId ? state.records.filter(x=>x.taskId===r.taskId) : [r];
}
tasks = function() {
  const q=state.search.task.trim(),all=v10DisplayRecords();
  const records=all.filter(r=>!q||v10GroupRecords(r).some(x=>`${x.type}${x.old}${x.next}${x.id}${x.taskId||''}`.includes(q)));
  const start=(state.taskPage-1)*state.pageSize,page=records.slice(start,start+state.pageSize);
  const counts=stats();
  return `<section class="card list-card"><div class="section-head"><div class="section-title">迁移记录</div></div>
  <div class="toolbar"><input class="field" data-search="task" value="${safe(q)}" placeholder="请输入机构名称或记录号"><button class="btn primary" data-action="query-task">查询</button><button class="btn" data-action="reset-task-search">重置</button><span class="subtle">共 ${records.length} 条</span></div>
  <div class="table-wrap list-table"><table><thead><tr><th>记录号</th><th>变更事项</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>确认人</th><th>确认时间</th><th>组织结果</th><th>关联迁移</th><th>操作</th></tr></thead><tbody>
  ${page.map(r=>`<tr><td>${safe(r.id)}</td><td>${safe(v10GroupRecords(r).map(x=>x.type).join('、'))}</td><td>${safe(r.old)}</td><td>${safe(r.next)}</td><td>${safe(r.by||'运营人员')}</td><td>${safe(r.at)}</td><td>${pill(r.result)}</td><td>${r.taskId?`${pill(taskStatus())}${state.scan.countsAt?`<span class="subtle"> 成功 ${counts.success} 异常 ${counts.failed} 等待 ${counts.pending+counts.processing}</span>`:''}`:'无需关联迁移'}</td><td><button class="link" data-v10-action="view-record" data-id="${r.id}">查看处理结果</button></td></tr>`).join('')||`<tr><td colspan="9" class="muted">${all.length?'暂无匹配结果':'暂无变更记录'}</td></tr>`}</tbody></table></div>
  ${pagination(records.length,state.taskPage,'taskPage')}</section>`;
};

detail = function() {
  const selected=state.records.find(x=>x.id===v10().selectedRecordId);
  const r=selected?.changeId==='child'&&selected.taskId?state.records.find(x=>x.changeId==='replace'&&x.taskId===selected.taskId)||selected:selected;
  const source=v10().resultSource==='compare'?'compare':'tasks',back=source==='compare'?'返回处理变更':'返回迁移记录';
  if (!r) return `<section class="card list-card"><div class="section-head"><div class="section-title">处理结果</div><button class="btn" data-v10-action="return-result">${back}</button></div><div class="callout">未找到这条处理记录，请返回列表重新选择。</div></section>`;
  const group=v10GroupRecords(r);
  const common=`<section class="card list-card"><div class="section-head"><div class="section-title">处理结果 · ${safe(r.id)}</div><button class="btn" data-v10-action="return-result">${back}</button></div>
  ${v10ResultSummary(r)}
  <div class="section-head v10-gap"><div class="section-title">变更内容</div></div><div class="table-wrap list-table"><table><thead><tr><th>变更类型</th><th>原值</th><th>调整后值</th><th>处理方式</th><th>确认的机构类型</th><th>确认的关联行政区</th></tr></thead><tbody>${group.map(x=>`<tr><td>${safe(x.type)}</td><td>${safe(x.old)}</td><td>${safe(x.next)}</td><td>${safe(x.method)}</td>${v10ResultConfigCells(x)}</tr>`).join('')}</tbody></table></div>
  `;
  const events=r.taskId?state.events:state.events.filter(e=>e.what.includes(`${r.type}确认`)||r.changeId==='replace'&&e.what==='无替代退出确认');
  const history=events.length?`<details class="event-box"><summary>处理记录</summary><div class="table-wrap list-table"><table><thead><tr><th>时间</th><th>操作人</th><th>事项</th><th>结果</th></tr></thead><tbody>${events.map(e=>`<tr><td>${safe(e.at)}</td><td>${safe(e.who)}</td><td>${safe(e.what)}</td><td>${safe(e.result)}</td></tr>`).join('')}</tbody></table></div></details>`:'';
  if (!r.taskId) return `${common}${history}</section>`;
  const counts=stats(),known=!!state.scan.countsAt,pct=known&&counts.all?Math.round(counts.success/counts.all*100):null;
  const summary=`已完成${counts.success}项，异常${counts.failed}项`,waiting=`等待/处理中${counts.pending+counts.processing}项`;
  const message=state.stage==='retrying'?`数据迁移异常项重新处理中，${summary}，${waiting}。`:
    ['needsAction','done'].includes(state.stage)?`数据迁移结束，${summary}。${counts.failed?'可点击【查看详情】或异常列查看异常记录，并进行重试。':''}`:
    `数据迁移中，${known?`${summary}，${waiting}`:'数量统计中'}。迁移中的数据禁止变更。`;
  return `${common}
  <div class="mini-cards v10-gap"><div class="mini-card">受影响存量<strong>${known?counts.all:'统计中'}</strong></div><div class="mini-card">已完成<strong>${known?counts.success:'统计中'}</strong></div><div class="mini-card">异常<strong>${known?counts.failed:'统计中'}</strong></div><div class="mini-card">等待/处理中<strong>${known?counts.pending+counts.processing:'统计中'}</strong></div></div>
  ${pct!==null?`<div class="status-track"><i style="width:${pct}%"></i></div>`:'<div class="callout warn">关联数量统计中，暂不显示完成率。</div>'}
  ${counts.failed||v10().retryPending?`<div class="toolbar v10-gap"><button class="btn primary" data-v10-action="retry-task" title="重新处理本任务各类别的全部原失败项，包含其他分页" ${state.stage!=='needsAction'||v10().retryPending?'disabled':''}>${v10().retryPending?`批量重试中（${v10().retryIds.length} 项）`:`批量重试（${counts.failed} 项）`}</button></div>`:''}
  <div class="callout ${state.stage==='done'?'':'warn'}">${message}</div>
  <div class="section-head"><div class="section-title">分类结果</div></div><div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>总数</th><th>完成</th><th>异常</th><th>等待</th><th>处理中</th><th>操作</th></tr></thead><tbody>
  ${Object.entries(labels).map(([k,label])=>{const a=state.items.filter(i=>i.kind===k),failed=a.filter(i=>i.status==='失败').length,processing=a.filter(i=>i.status==='处理中').length;return `<tr><td>${label}</td><td>${known?a.length:'统计中'}</td><td>${known?a.filter(i=>i.status==='成功').length:'统计中'}</td><td>${known?failed?`<button class="link" data-v10-action="impact-failed" data-kind="${k}">${failed}</button>`:'0':'统计中'}</td><td>${known?a.filter(i=>i.status==='等待处理').length:'统计中'}</td><td>${known?processing:'统计中'}</td><td><button class="link" data-v10-action="impact-open" data-kind="${k}" ${!known?'disabled':''}>查看详情</button>${failed||processing?`<button class="link" data-v10-action="retry-category" data-kind="${k}" title="重新处理本任务${label}类别的全部原失败项，当前 ${failed} 项，包含其他分页" ${state.stage!=='needsAction'||v10().retryPending?'disabled':''}>${processing?'处理中':'重新处理'}</button>`:''}</td></tr>`}).join('')}</tbody></table></div>
  ${history}</section>`;
};

permissions = function() {
  const f=v10().permissionFilter,input=v10().permissionInput;
  const all=state.items.filter(i=>['user','query','action'].includes(i.kind));
  const rows=all.filter(i=>(!f.name||`${i.name}${i.id}`.includes(f.name))&&(!f.kind||i.kind===f.kind)&&(!f.status||i.status===f.status));
  const start=(state.permissionPage-1)*state.pageSize;
  return `<section class="card list-card"><div class="section-head"><div class="section-title">用户权限明细</div><button class="btn" data-page="tasks">返回迁移记录</button></div>
  <div class="toolbar"><input class="field" data-v10-permission="name" value="${safe(input.name)}" placeholder="请输入用户或标识"><select class="field" data-v10-permission="kind"><option value="">全部关联</option>${['user','query','action'].map(k=>`<option value="${k}" ${input.kind===k?'selected':''}>${labels[k]}</option>`).join('')}</select><select class="field" data-v10-permission="status"><option value="">全部结果</option>${['等待处理','成功','失败'].map(s=>`<option ${input.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn primary" data-v10-action="query-permission">查询</button><button class="btn" data-v10-action="reset-permission">重置</button></div>
  <div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>用户 / 对象</th><th>所属机构</th><th>原授权或所属</th><th>调整后应有值</th><th>当前实际值</th><th>保留条件</th><th>检查结果</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(i=>`<tr><td>${labels[i.kind]}</td><td>${safe(i.name)}<br><span class="subtle">${safe(i.id)}</span></td><td>${i.id.includes('3002')||i.id.includes('3004')?'梅州供电局':safe(nodeName(i.kind==='user'?i.actual:OLD))}</td><td>${safe(cfg().old)}</td><td>${state.confirmed.replace||hasTarget()?safe(targetName()):'待选择组织节点'}</td><td>${safe(nodeName(i.actual))}</td><td>${i.kind==='user'?'—':'生产域 ∩ 梅州分区；未变下级保留'}</td><td>${pill(i.status)}</td></tr>`).join('')||`<tr><td colspan="8" class="muted">${all.length?'暂无匹配结果':'暂无关联记录'}</td></tr>`}</tbody></table></div>${pagination(rows.length,state.permissionPage,'permissionPage')}<div class="footer-note">用户所属、查询权限与操作权限分别核对；其他机构所属但获授原机构权限的用户也在相应授权明细中。</div></section>`;
};
devices = function() {
  const html=v10BaseDevices();
  return html.replaceAll(safe(cfg().next),safe(targetName()||cfg().old));
};
historyPage = function() {
  const unit=state.confirmed.replace?targetName():cfg().old;
  const q=v10().historyFilter,rows=state.history.filter(i=>!q||`${i.name}${i.id}`.includes(q));
  const start=(state.historyPage-1)*state.pageSize;
  return `<section class="card list-card"><div class="section-head"><div class="section-title">历史事件与报表</div><button class="btn" data-page="devices">返回设备列表</button></div>
  <div class="toolbar"><input class="field" value="${safe(unit)}" disabled><input class="field" data-v10-history="name" value="${safe(v10().historyInput)}" placeholder="请输入记录名称或编号"><button class="btn primary" data-v10-action="query-history">查询</button><button class="btn" data-v10-action="reset-history">重置</button></div>
  <div class="table-wrap list-table"><table><thead><tr><th>记录 ID</th><th>记录名称</th><th>当前查询入口</th><th>发生时单位</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(i=>`<tr><td>${safe(i.id)}</td><td>${safe(i.name)}</td><td>${safe(unit)}</td><td>${safe(nodeName(i.actual))}</td></tr>`).join('')||`<tr><td colspan="4" class="muted">${state.history.length?'暂无匹配结果':'暂无历史记录'}</td></tr>`}</tbody></table></div>${pagination(rows.length,state.historyPage,'historyPage')}<div class="footer-note">历史记录保留发生时单位；从当前机构入口可查询相关历史。</div></section>`;
};

settings = function() {
  const actual=state.config;
  state.config={...actual,...v10().settingsDraft};
  const html=v10BaseSettings();
  state.config=actual;
  return html.replace('保存</button>','保存</button>') + (state.settingsDirty?'<div class="callout warn settings-hint">配置修改尚未保存。切换机构或页码后草稿仍会保留。</div>':'');
};
function v10OpenImpact(kind,status='') {
  if (!labels[kind]||!state.records.some(r=>r.id===v10().selectedRecordId&&r.taskId)) return;
  state.impactKind=kind;state.impactPage=1;
  v10().impactStatusInput=status;v10().impactStatus=status;
  state.modal={type:'impact',kind};render();
}
function v10ImpactValue(i,id) {
  const prefix={device:'设备归属',historicalArchive:'关联设备归属',terminalArchive:'关联设备归属',user:'所属机构',query:'查询授权',action:'操作授权',base:'基础数据归属'}[i.kind];
  const scope=['query','action'].includes(i.kind)?'（生产域 / 梅州分区）':'';
  return `${prefix}：${nodeName(id)}${scope}`;
}
modal = function() {
  if (state.modal?.type==='switch-scenario') return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-header">切换演示场景<button class="link" data-action="close-modal">×</button></div><div class="modal-body">切换场景将清除当前演示进度及草稿。</div><div class="modal-footer"><button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-v10-action="confirm-scenario">确认切换</button></div></div></div>`;
  if (state.modal?.type==='impact') {
    const kind=state.modal.kind,all=state.items.filter(i=>i.kind===kind),filter=v10().impactStatus;
    const rows=all.filter(i=>!filter||i.status===filter),pages=Math.max(1,Math.ceil(rows.length/state.pageSize));
    state.impactPage=Math.min(state.impactPage,pages);
    const start=(state.impactPage-1)*state.pageSize;
    return `<div class="modal-backdrop"><div class="modal impact-modal" role="dialog" aria-modal="true"><div class="modal-header">${safe(labels[kind])} · 关联详情<button class="link" aria-label="关闭弹窗" data-action="close-modal">×</button></div><div class="modal-body"><div class="toolbar impact-filter"><span>处理结果</span><select class="field" data-v10-impact-status><option value="">全部</option>${['成功','失败','等待处理','处理中'].map(s=>`<option value="${s}" ${v10().impactStatusInput===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn primary" data-v10-action="impact-query">查询</button><button class="btn" data-v10-action="impact-reset">重置</button></div><div class="table-wrap list-table"><table><thead><tr><th>对象名称 / 编号</th><th>原值</th><th>调整后应有值</th><th>当前实际值</th><th>处理结果</th><th>失败原因</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(i=>`<tr><td>${safe(i.name)}<br><span class="subtle">${safe(i.id)}</span></td><td>${safe(v10ImpactValue(i,OLD))}</td><td>${safe(v10ImpactValue(i,targetId()))}</td><td>${safe(v10ImpactValue(i,i.actual))}</td><td>${pill(i.status)}</td><td class="impact-reason">${safe(i.status==='处理中'&&i.lastReason?`上次失败：${i.lastReason}`:i.reason||'—')}</td></tr>`).join('')||`<tr><td colspan="6" class="muted">${all.length?'暂无匹配结果':'暂无关联记录'}</td></tr>`}</tbody></table></div>${pagination(rows.length,state.impactPage,'impactPage')}</div><div class="modal-footer"><button class="btn" data-action="close-modal">关闭</button></div></div></div>`;
  }
  const actual=state.config;
  if (state.modal?.type==='region') state.config={...actual,...v10().settingsDraft};
  let html=v10BaseModal();
  state.config=actual;
  if (state.modal?.type==='new-device') html=html.replaceAll(safe(cfg().next),safe(targetName()||'待选择'));
  if (state.modal?.type==='region') html=html.replace('data-action="save-region">保存','data-action="save-region">确定');
  return html;
};

function v10Submit(id,fromDetail=false) {
  if (v10().submitPending || !['replace','rename','info'].includes(id) || state.confirmed[id]) return;
  if (id==='replace' ? !fromDetail||state.page!=='plan' : state.page!=='compare') return;
  const x=v10Changes().find(c=>c.id===id),reason=x&&changeReason(x);
  if (!x || reason) {if(reason)notify(reason);return;}
  v10().submitPending=true;render();
  const version=v10().draftVersion;
  const submittingState=state;
  setTimeout(()=>{
    if(state!==submittingState)return;
    if(version!==v10().draftVersion){v10().submitPending=false;notify('当前选择已变化，请按最新内容重新确认。');return;}
    const saved=confirmChange(id);v10().submitPending=false;
    if(saved&&fromDetail){navigate('compare');window.scrollTo(0,v10().compareScroll||0);}
    else render();
  },450);
}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-v10-action]');
  if (!el) {
    const old=e.target.closest('[data-action]'),action=old?.dataset.action;
    if(action==='save-settings') {
      e.stopImmediatePropagation();
      const draft=v10().settingsDraft,invalid=Object.entries(draft).find(([,c])=>!c.type||!c.region||!c.division);
      if(invalid)return notify(`机构 ${nodeName(invalid[0])} 的类型、部门/单位和行政区域均需填写`);
      if(state.stage!=='draft'&&state.stage!=='done'&&Object.keys(draft).some(id=>id===OLD||id===targetId()))return notify('当前任务进行中，相关机构配置暂不可修改');
      for(const [id,c] of Object.entries(draft))state.config[id]={...c};
      v10().settingsDraft={};state.settingsDirty=false;
      if(Object.keys(draft).some(id=>id===OLD||id===targetId())){v10().choice={};v10().proposed={};v10().draftVersion++;v10().recordMessage='机构配置已更新，请重新核对替代方案。';}
      notify('机构配置已保存');return;
    }
    if(action==='toggle-terminal') {e.stopImmediatePropagation();const id=old.dataset.id,c={...(v10().settingsDraft[id]||state.config[id])};c.terminal=!c.terminal;v10().settingsDraft[id]=c;state.settingsDirty=true;render();return;}
    if(action==='save-region') {e.stopImmediatePropagation();const id=state.modal.id,c={...(v10().settingsDraft[id]||state.config[id])};c.region=byId('region-input').value.trim();v10().settingsDraft[id]=c;state.settingsDirty=true;state.modal=null;render();return;}
    if(action==='save-device') {e.stopImmediatePropagation();const name=byId('new-name').value.trim(),code=byId('new-id').value.trim();if(!name||!code)return notify('请填写终端名称和标识码');if([...state.items,...state.newBusiness].some(i=>i.id===code))return notify('标识码已存在');state.newBusiness.push({id:code,kind:'device',name,actual:targetId(),created:'新增业务'});state.modal=null;state.devicePage=1;notify('设备已新增');return;}
    const page=e.target.closest('[data-page]')?.dataset.page;
    if(page==='compare' && state.page==='plan') {e.stopImmediatePropagation();state.page='compare';render();window.scrollTo(0,v10().compareScroll||0);}
    return;
  }
  e.stopImmediatePropagation();
  const a=el.dataset.v10Action,id=el.dataset.id;
  if(a==='query-change'){v10().filter={...v10().filterInput};state.changePage=1;render();}
  if(a==='reset-change'){v10().filterInput={name:'',type:'',system:'',status:''};v10().filter={...v10().filterInput};state.changePage=1;render();}
  if(a==='confirm-scenario'){state=fresh(state.modal.key);render();}
  if(a==='repair-failure'&&cfg().fail&&state.stage==='needsAction'&&!state.recoveryReady){state.recoveryReady=true;render();}
  if(a==='impact-open') v10OpenImpact(el.dataset.kind);
  if(a==='impact-failed') v10OpenImpact(el.dataset.kind,'失败');
  if(a==='impact-query'){v10().impactStatus=v10().impactStatusInput;state.impactPage=1;render();}
  if(a==='impact-reset'){v10().impactStatusInput='';v10().impactStatus='';state.impactPage=1;render();}
  if(a==='retry-category') v10Retry(el.dataset.kind);
  if(a==='retry-task') v10Retry();
  if(a==='change-detail') {
    if(state.confirmed[id]) {const record=state.records.find(r=>r.changeId===id);if(record)openResult(record.id,'compare');}
    else if(requiresDetail(id)) openReplaceDetail();
  }
  if(a==='confirm-one') v10Submit(id);
  if(a==='confirm-replace') v10Submit('replace',true);
  if(a==='view-record'||a==='view-task') openResult(id,state.page==='plan'||state.page==='compare'?'compare':'tasks');
  if(a==='return-result') {const source=v10().resultSource==='compare'?'compare':'tasks';state.page=source;render();window.scrollTo(0,v10()[source==='compare'?'compareScroll':'tasksScroll']||0);}
  if(a==='query-permission'){v10().permissionFilter={...v10().permissionInput};state.permissionPage=1;render();}
  if(a==='reset-permission'){v10().permissionInput={name:'',kind:'',status:''};v10().permissionFilter={...v10().permissionInput};state.permissionPage=1;render();}
  if(a==='query-history'){v10().historyFilter=v10().historyInput.trim();state.historyPage=1;render();}
  if(a==='reset-history'){v10().historyInput='';v10().historyFilter='';state.historyPage=1;render();}
  if(a==='save-org') {
    const include=state.checked4a.includes(EXTRA),present=!!pick(state.currentTree,EXTRA);
    if(include&&!present) state.currentTree.push({...pick(state.newTree,EXTRA)});
    if(!include&&present) state.currentTree=state.currentTree.filter(n=>n.id!==EXTRA);
    notify('保存成功');
  }
},true);

document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='scenario-select'){e.stopImmediatePropagation();if(el.value===state.scenario)return;state.modal={type:'switch-scenario',key:el.value};render();return;}
  if(el.dataset.action==='page-size'){e.stopImmediatePropagation();state.pageSize=Number(el.value);for(const key of ['settingPage','changePage','devicePage','itemPage','impactPage','taskPage','permissionPage','historyPage'])state[key]=1;render();return;}
  if(el.id==='candidate-select') {e.stopImmediatePropagation();if(state.confirmed.replace||v10().submitPending)return;state.candidate=el.value;v10().candidateTouched=true;v10().choice={};v10().proposed={};v10().draftVersion++;v10().recordMessage='目标已更新，请确认配置。';render();return;}
  if(el.dataset.v10Filter) {v10().filterInput[el.dataset.v10Filter]=el.value;return;}
  if(el.dataset.v10ImpactStatus!==undefined){v10().impactStatusInput=el.value;return;}
  if(el.dataset.v10Permission){v10().permissionInput[el.dataset.v10Permission]=el.value;return;}
  if(el.dataset.v10Choice) {v10().choice[el.dataset.v10Choice]=el.value;v10().proposed[el.dataset.v10Choice]=el.dataset.v10Choice==='type'?'':null;v10().draftVersion++;render();return;}
  if(el.dataset.v10Type) {const parts=new Set(String(v10().proposed.type||'').split('、').filter(Boolean));el.checked?parts.add(el.dataset.v10Type):parts.delete(el.dataset.v10Type);v10().proposed.type=['用户组织机构','项目/设备单位'].filter(t=>parts.has(t)).join('、');v10().draftVersion++;render();return;}
  if(el.dataset.v10Custom) {v10().choice[el.dataset.v10Custom]='custom';v10().proposed[el.dataset.v10Custom]=el.value;v10().draftVersion++;render();return;}
  if(el.dataset.setting) {e.stopImmediatePropagation();const id=el.dataset.id,field=el.dataset.setting,c={...(v10().settingsDraft[id]||state.config[id])};if(field==='type-user'||field==='type-device'){const parts=new Set(c.type.split('、').filter(Boolean)),part=field==='type-user'?'用户组织机构':'项目/设备单位';el.checked?parts.add(part):parts.delete(part);c.type=[...parts].join('、');}else c[field]=el.value;v10().settingsDraft[id]=c;state.settingsDirty=true;render();return;}
},true);

document.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.search){
    e.stopImmediatePropagation();
    const key=el.dataset.search,pos=el.selectionStart;
    state.search[key]=el.value;
    if(key==='settingName')state.settingPage=1;
    if(key==='device')state.devicePage=1;
    if(key==='task')state.taskPage=1;
    render();
    const next=document.querySelector(`[data-search="${key}"]`);next?.focus();if(pos!==null)next?.setSelectionRange(pos,pos);
    return;
  }
  if(el.dataset.v10Filter==='name')v10().filterInput.name=el.value;
  if(el.dataset.v10Permission==='name')v10().permissionInput.name=el.value;
  if(el.dataset.v10History==='name')v10().historyInput=el.value;
  if(el.dataset.setting && ['short','sort'].includes(el.dataset.setting)) {
    const id=el.dataset.id,field=el.dataset.setting;
    v10().settingsDraft[id]={...(v10().settingsDraft[id]||state.config[id]),[field]:el.value};
    state.settingsDirty=true;
    const save=document.querySelector('[data-action="save-settings"]');if(save)save.disabled=false;
  }
},true);
tick();render();
