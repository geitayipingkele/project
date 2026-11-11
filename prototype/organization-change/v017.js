/* V0.17: current PRD interaction rules; all processing remains a local simulation. */
const v17SourceTrees=sourceTrees;
sourceTrees=function(c) {
  const trees=v17SourceTrees(c);
  if(c.leaf) {trees.old=trees.old.filter(n=>n.id!==CHILD);trees.next=trees.next.filter(n=>n.id!==CHILD);}
  if(c.move) trees.next.push({id:'MOVE',name:'同 ID 调整示例所',parent:NEW,code:'DEMO-MOVE'});
  if(c.move) trees.old.push({id:'MOVE',name:'同 ID 调整示例所',parent:PEER,code:'DEMO-MOVE'});
  if(c.branch){
    trees.old.push({id:'REMOVED-CHILD',name:'城东供电所',parent:OLD,code:'DEMO-REMOVED'});
    trees.next=trees.next.filter(n=>n.id!==CHILD);
    trees.next.push({id:'C1',name:'新陂供电所',parent:NEW,code:'DEMO-C1'},{id:'NEW-CHILD',name:'城南供电所',parent:NEW,code:'DEMO-NC'});
  }
  if(c.deep){
    trees.old.push({id:'OLD-GRANDCHILD',name:'新陂运维班',parent:CHILD,code:'DEMO-OLD-TEAM'});
    trees.next.push({id:'NEW-GRANDCHILD',name:'新陂运维班',parent:'C1',code:'DEMO-NEW-TEAM'});
  }
  return trees;
};
const v17Fresh=fresh;
function v17Upgrade(s) {
  if(s.modal?.type==='ghost')s.modal=null;
  for(const config of Object.values(s.config)){
    if(!ORG_TYPES.includes(config.type))config.type='全部';
  }
  if(s.configApplied&&!ORG_TYPES.includes(s.configApplied.type))s.configApplied.type='全部';
  if(s.v17) return s;
  s.v17={jobs:{},oldVersion:'平台留存全量旧数据',newVersion:'本次接收全量数据',compareSize:5,taskSize:5};
  s.v17.branchChoices={};s.v17.mappings={};
  if(scenarios[s.scenario].noData){s.items=[];s.history=[];}
  if(scenarios[s.scenario].branch)s.history.push({id:'EV-CHILD',name:'城东供电所历史告警',actual:'REMOVED-CHILD'});
  if(scenarios[s.scenario].deep)s.history.push({id:'EV-TEAM',name:'新陂运维班历史告警',actual:'OLD-GRANDCHILD'});
  const diffs=orgCompare.differences(s.oldTree,s.newTree);
  for(const diff of diffs.changed.filter(d=>d.next.id!==CHILD)) {
    const id=diff.next.id===OTHER?'rename':diff.next.id===PEER?'info':`auto:${diff.next.id}`;
    const previous=s.records.find(r=>r.changeId===id);
    const at=new Date().toLocaleString('zh-CN',{hour12:false});
    const fields=diff.fields;
    const items=diff.next.id===OTHER?[
      {id:'AUTO-D01',name:'潮州当前设备',kind:'当前设备',field:'所属机构名称'},
      {id:'AUTO-H01',name:'潮州设备关联档案',kind:'关联档案',field:'所属机构名称'}
    ]:diff.next.id==='MOVE'?[
      {id:'MOVE-ORG',name:'系统父子关系',kind:'系统组织',field:'父级'},
      {id:'MOVE-Q01',name:'用户李工 · 已有节点权限',kind:'查询权限',field:'保留已有授权',existing:true},
      {id:'MOVE-Q02',name:'用户陈工 · 新上级已配置自动授权',kind:'查询权限',field:'自动授予调入节点',grant:true},
      {id:'MOVE-Q03',name:'用户赵工 · 新上级未配置自动授权',kind:'查询权限',field:'不增加节点权限',grant:false}
    ]:[];
    const show=(node,key)=>key==='parent'?(s.oldTree.find(n=>n.id===node[key])||s.newTree.find(n=>n.id===node[key]))?.name||node[key]:node[key];
    for(const item of items) Object.assign(item,{old:item.field==='父级'?show(diff.old,'parent'):item.kind==='查询权限'?(item.existing?'拥有节点权限':'无节点权限'):diff.old.name,
      next:item.field==='父级'?show(diff.next,'parent'):item.kind==='查询权限'?(item.existing||item.grant?'拥有节点权限':'无节点权限'):diff.next.name,
      status:previous?'成功':'等待处理',reason:''});
    const job={id,node:diff.next.id,fields,old:diff.old,next:diff.next,items,status:previous||!items.length?'已完成':'等待处理',at:previous?.at||at,
      due:Date.now()+5500,step:0,history:[{at,what:'系统自动处理',result:'已接收来源变化，自动保存处理方案'}],retry:false};
    if(!previous) {
      const number=Math.max(0,...s.records.map(r=>Number(r.id.match(/\d+$/)?.[0])||0))+1;
      s.records.push({id:`DEMO-REC-${String(number).padStart(3,'0')}`,changeId:id,type:fields.includes('parent')?'上级调整':fields.includes('name')?'名称修改':'信息变更',
        old:fields.map(f=>show(diff.old,f)).join('；'),next:fields.map(f=>show(diff.next,f)).join('；'),method:'系统自动处理',by:'系统自动处理',at,result:job.status,taskId:null,auto:true});
    }
    s.v17.jobs[id]=job;
    if(job.status==='已完成') {const n=pick(s.currentTree,job.node);if(n)Object.assign(n,job.next);if(job.fields.includes('short')&&s.config[job.node])s.config[job.node].short=job.next.short;s.confirmed[id]=true;}
  }
  for(const record of s.records.filter(r=>r.changeId==='child')) record.method='随上级替代调整';
  if(s.v10.filter.status==='pending')s.v10.filter.status='待确认';
  if(s.v10.filter.status==='done')s.v10.filter.status='已完成';
  return s;
}
fresh=function(key='normal'){return v17Upgrade(v17Fresh(key));};
state=v17Upgrade(state);
function v17HasData(id){
  return (id===CHILD && cfg().branch) ||
    state.items.some(item=>!item.deleted&&(item.original||item.actual)===id) ||
    state.history.some(item=>item.actual===id);
}
function v17CanExit(){return !v17HasData(OLD);}

function v17ParentName(nodes,id) {return pick(nodes,id)?.name||id||'—';}
function v17Path(nodes,id) {
  const parts=[],seen=new Set();let node=pick(nodes,id);
  while(node&&!seen.has(node.id)){seen.add(node.id);parts.unshift(node.name);node=pick(nodes,node.parent);}
  return parts.join(' / ');
}
defaultTargetId=function(){return orgCompare.recommend(state.oldTree,state.newTree,OLD);};
v10Options=function(){return orgCompare.candidates(state.oldTree,state.newTree,OLD);};
v10Changes=function(){
  const diffs=orgCompare.differences(state.oldTree,state.newTree),rows=[];
  if(diffs.removed.some(n=>n.id===OLD))rows.push({id:'replace',node:OLD,type:'删除',old:cfg().old,next:targetName()||(v17CanExit()?'无替代退出':'待选择'),system:true,method:targetName()?`替代为 ${targetName()}`:v17CanExit()?'无替代退出':'待选替代节点'});
  const oldChild=pick(state.oldTree,CHILD),newChild=pick(state.newTree,CHILD);
  if(oldChild&&newChild&&oldChild.parent!==newChild.parent)rows.push({id:'child',node:CHILD,type:'上级调整',old:`${oldChild.name} / ${v17ParentName(state.oldTree,oldChild.parent)}`,next:`${newChild.name} / ${v17ParentName(state.newTree,newChild.parent)}`,system:!!pick(state.currentTree,CHILD),method:'随上级替代调整'});
  for(const old of v17RemovedChildren()){
    const chosen=state.v17.branchChoices?.[old.id];
    rows.push({id:`branch:${old.id}`,node:old.id,type:'删除',old:old.name,next:pick(state.newTree,chosen)?.name||(v17HasData(old.id)?'待选择':'无替代退出'),system:true,method:chosen?'随组替代':'待选替代节点'});
  }
  for(const [id,job]of Object.entries(state.v17.jobs)){
    const record=state.records.find(r=>r.changeId===id);
    rows.push({id,node:job.node,type:record.type,old:record.old,next:record.next,system:!!pick(state.currentTree,job.node),method:'系统自动处理'});
  }
  for(const n of diffs.added) {
    if(state.confirmed.replace&&[targetId(),pick(state.newTree,CHILD)?.parent,...Object.values(state.v17.mappings||{})].includes(n.id))continue;
    rows.push({id:`add:${n.id}`,node:n.id,type:'新增',old:'—',next:n.name,system:!!pick(state.currentTree,n.id),method:'沿用组织管理保存'});
  }
  return rows;
};
function v17Status(x) {
  if(x.id.startsWith('add:'))return '来源新增';
  if(state.v17.jobs[x.id])return state.v17.jobs[x.id].status;
  if(x.id==='child'&&!state.confirmed.replace)return '等待上级确认';
  if(x.id==='child')return state.v17.childStatus||(state.stage==='done'?'已完成':'处理中');
  if(x.id.startsWith('branch:')&&!state.confirmed.replace)return '待确认';
  if(!state.confirmed.replace)return '待确认';
  return ({draft:'已保存',migrating:'处理中',retrying:'处理中',verifying:'核验中',needsAction:'需处理',done:'已完成'})[state.stage];
}
changedBadge=function(id) {
  if(orgCompare.differences(state.oldTree,state.newTree).removed.some(n=>n.id===id))return state.confirmed.replace?'':'4A已删除 · 待处理';
  const change=v10Changes().find(x=>x.node===id);
  if(!change)return '';
  if(change.type==='新增')return '新增';
  const status=v17Status(change);
  if(status==='已完成')return '';
  const type=change.type==='名称修改'?'名称变更':change.type==='信息变更'?'属性变更':change.type;
  return `${type}·${status==='等待上级确认'?status:status==='需处理'?'更新异常':'更新中'}`;
};
sourceTree=function(nodes,key,checkboxes=false) {
  const query=(state.search[key]||'').trim(),expanded=new Set(state.expanded[key]||[]);
  const all=checkboxes&&!state.confirmed.replace?[...nodes,...orgCompare.differences(state.oldTree,state.newTree).removed.map(n=>({...n,ghost:true}))]:nodes;
  const descendants=id=>all.flatMap(n=>n.parent===id?[n,...descendants(n.id)]:[]);
  const matches=n=>n.name.includes(query)||descendants(n.id).some(x=>x.name.includes(query));
  const pending=id=>{const ids=new Set(descendants(id).map(n=>n.id));return v10Changes().filter(x=>ids.has(x.node)&&!['已完成','来源新增'].includes(v17Status(x))).length;};
  function row(n,depth) {
    const kids=all.filter(x=>x.parent===n.id),open=query?true:expanded.has(n.id),badge=checkboxes?changedBadge(n.id):'',count=checkboxes?pending(n.id):0;
    return `<div class="tree-row ${state.selectedNode===n.id?'selected':''} ${n.ghost?'ghost':''}" style="padding-left:${depth*19}px" data-action="tree-node" data-key="${key}" data-id="${n.id}"><span class="tree-caret">${kids.length?open?'▾':'▸':''}</span>${checkboxes?`<input type="checkbox" data-action="tree-check" data-id="${n.id}" ${n.ghost||![EXTRA].includes(n.id)?'disabled':''} ${state.checked4a.includes(n.id)?'checked':''}>`:''}<span>${safe(n.name)}</span>${badge?`<button class="tree-badge ${n.ghost?'deleted':''}" data-v17-action="tree-change" data-id="${n.id}">${safe(badge)}</button>`:''}${!open&&count?`<button class="tree-hint link" data-page="compare">下级有变更 ${count} 项</button>`:''}</div>${open?kids.filter(n=>!query||matches(n)).map(n=>row(n,depth+1)).join(''):''}`;
  }
  return all.filter(n=>!n.parent&&(!query||matches(n))).map(n=>row(n,0)).join('')||'<div class="muted">无匹配机构</div>';
};
const v17Manage=manage;
manage=function(){return v17Manage().replace(/已确认 \d+ \/ \d+ 项/,`未完成 ${v10Changes().filter(x=>!['已完成','来源新增'].includes(v17Status(x))).length} 项`);};
v10FilteredChanges=function(){const f=v10().filter;return v10Changes().filter(x=>(!f.name||`${x.old}${x.next}${x.type}`.includes(f.name))&&(!f.type||x.type===f.type)&&(!f.system||(f.system==='yes')===x.system)&&(!f.status||v17Status(x)===f.status));};
compare=function(){
  const all=v10FilteredChanges(),f=v10().filterInput;
  state.changePage=Math.min(state.changePage,Math.max(1,Math.ceil(all.length/state.pageSize)));
  const page=all.slice((state.changePage-1)*state.pageSize,state.changePage*state.pageSize);
  const option=(key,label,values)=>`<select class="field" data-v10-filter="${key}"><option value="">${label}</option>${values.map(([v,t])=>`<option value="${safe(v)}" ${f[key]===v?'selected':''}>${safe(t)}</option>`).join('')}</select>`;
  const operation=x=>x.id.startsWith('add:')?'<button class="link" data-page="manage">查看组织管理</button>':x.id==='child'&&!state.confirmed.replace?'<button class="link" data-v10-action="change-detail" data-id="child" title="随上级替代方案一起处理，无须单独确认">查看上级变更</button>':(x.id==='replace'||x.id.startsWith('branch:'))&&!state.confirmed.replace?'<button class="link" data-v10-action="change-detail" data-id="replace">处理</button>':`<button class="link" data-v17-action="result" data-id="${safe(x.id)}">查看处理结果</button>`;
  return `<section class="card list-card"><div class="section-head"><div class="section-title">处理变更</div><button class="btn" data-page="manage">返回组织机构管理</button></div><div class="toolbar"><input class="field" data-v10-filter="name" value="${safe(f.name)}" placeholder="请输入机构名称或变更类型">${option('type','全部变更类型',[...new Set(v10Changes().map(x=>x.type))].map(t=>[t,t]))}${option('system','全部系统使用状态',[['yes','已纳入'],['no','未纳入']])}${option('status','全部处理状态',['待确认','等待上级确认','等待处理','处理中','核验中','需处理','已完成','来源新增'].map(t=>[t,t]))}<button class="btn primary" data-v10-action="query-change">查询</button><button class="btn" data-v10-action="reset-change">重置</button></div>
    <div class="table-wrap list-table"><table><thead><tr><th>变更类型</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>原系统使用</th><th>处理方式</th><th>状态</th><th>操作</th></tr></thead><tbody>${page.map(x=>`<tr><td>${safe(x.type)}</td><td>${safe(x.old)}</td><td>${safe(x.next)}</td><td>${x.system?'已纳入':'未纳入'}</td><td>${safe(x.method)}</td><td>${pill(v17Status(x))}${x.id==='child'&&!state.confirmed.replace?'<div class="subtle dependency-note">随上级替代方案一起处理，无须单独确认</div>':''}</td><td>${operation(x)}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">暂无匹配结果，可重置筛选</td></tr>'}</tbody></table></div>${pagination(all.length,state.changePage,'changePage')}</section>`;
};
function v17Descendants(parent, depth=1){
  return state.oldTree.filter(node=>node.parent===parent)
    .flatMap(node=>[{...node,depth},...v17Descendants(node.id,depth+1)]);
}
function v17RemovedChildren(){
  return v17Descendants(OLD).filter(node=>!pick(state.newTree,node.id));
}
function v17DraftMappings(){
  return {...state.v17.branchChoices,[OLD]:targetId()};
}
function v17PrepareChildren(){
  state.v17.branchChoices||={};
  for(const old of v17RemovedChildren()){
    if(!(old.id in state.v17.branchChoices)){
      const suggested=orgCompare.recommend(state.oldTree,state.newTree,old.id,v17DraftMappings());
      if(suggested)state.v17.branchChoices[old.id]=suggested;
    }
  }
}
function v17ChildConfig(old, target){
  const original=state.config[old]||{};
  const existing=pick(state.currentTree,target)?state.config[target]:null;
  const draft=state.v17.childConfig?.[old]||{};
  return {...original,...existing,division:original.division,terminal:original.terminal,type:draft.type||existing?.type||original.type||'全部',
    region:draft.region??existing?.region??original.region??''};
}
function v17ChildRow(old, expandable=false){
  const isRoot=old.id===OLD;
  const chosen=isRoot?targetId():state.v17.branchChoices[old.id]||'';
  const candidates=isRoot?v10Options():orgCompare.candidates(state.oldTree,state.newTree,old.id,v17DraftMappings());
  const config=isRoot?chosenConfig():v17ChildConfig(old.id,chosen);
  const targetControl=isRoot?'id="candidate-select"':`data-v17-child="${safe(old.id)}"`;
  const required=v17HasData(old.id);
  const regions=[...new Set([config.region,state.config[old.id]?.region,state.config[chosen]?.region,'广东省 / 梅州市','广东省 / 潮州市'].filter(Boolean))];
  const field=(key,label,values)=>`<select class="field" aria-label="${safe(old.name)} ${label}" ${isRoot?`data-v10-custom="${key}"`:`data-v17-config="${key}" data-node="${safe(old.id)}"`}>${values.map(value=>`<option value="${safe(value)}" ${value===config[key]?'selected':''}>${safe(value||'请选择行政区')}</option>`).join('')}</select>`;
  const collapsed=state.v17.collapsedBranches?.includes(old.id);
  const toggle=expandable
    ? `<button type="button" class="branch-toggle" data-v17-action="toggle-branch" data-id="${safe(old.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed?'展开':'折叠'}${safe(old.name)}的下级">${collapsed?'▸':'▾'}</button>`
    : '<span class="branch-toggle-space" aria-hidden="true"></span>';
  return `<tr><td><div class="branch-name" style="padding-left:${old.depth*20}px" title="${safe(v17Path(state.oldTree,old.id))}">${toggle}<span>${safe(old.name)} · ${safe(old.id)}</span></div></td>
    <td>${required?'存在':'不存在'}</td>
    <td><select class="field" aria-label="${safe(old.name)} 替代节点" ${targetControl}>
    <option value="">${required?'请选择机构':'不选择替代节点'}</option>
    ${candidates.map(node=>`<option value="${safe(node.id)}" ${chosen===node.id?'selected':''}>${safe(node.name)} · ${safe(node.code)}</option>`).join('')}</select></td>
    <td>${chosen?field('type','机构类型',ORG_TYPES):'—'}</td>
    <td>${chosen?field('region','关联行政区',['',...regions]):'—'}</td>
    <td>${required&&!candidates.length?'等待上级确定替代节点':required?'需选择替代节点':chosen?'可不选择替代节点':'无替代退出'}</td></tr>`;
}
function v17ReplacementRows(original, descendants){
  const rows=[{...original,depth:0},...descendants];
  const rowIds=new Set(rows.map(node=>node.id));
  const oldNodes=new Map(state.oldTree.map(node=>[node.id,node]));
  const parents=new Map();
  const expandable=new Set();
  for(const node of descendants){
    let parent=node.parent;
    while(parent&&!rowIds.has(parent))parent=oldNodes.get(parent)?.parent;
    parents.set(node.id,parent);
    if(parent)expandable.add(parent);
  }
  const collapsed=new Set(state.v17.collapsedBranches||[]);
  return rows.filter(node=>{
    for(let parent=parents.get(node.id);parent;parent=parents.get(parent)){
      if(collapsed.has(parent))return false;
    }
    return true;
  }).map(node=>v17ChildRow(node,expandable.has(node.id))).join('');
}
plan=function(){
  v17PrepareChildren();
  const original=pick(state.oldTree,OLD);
  const target=targetNode();
  const child=pick(state.newTree,CHILD);
  const descendants=v17RemovedChildren();
  const association=v17HasData(OLD)?'存在，需选择替代节点':'不存在，可不选择替代节点';
  const adjustment=descendants.length?'按下表逐级设置':child?`${child.name}随组调整至${nodeName(child.parent)}`:'无待调整下级';
  const locked=v10().submitPending;
  const html=`<section class="card list-card">
  <div class="section-head"><div class="section-title">变更详情 · ${safe(original.name)}</div><button class="btn" data-page="compare">返回处理变更</button></div>
  <div class="detail-grid"><b>原机构</b><span>${safe(original.name)} · ${safe(original.code)}</span><b>源侧状态</b><span>最新 4A 中已删除</span>
  <b>原路径</b><span>${safe(v17Path(state.oldTree,OLD))}</span><b>系统使用</b><span>当前仍已纳入</span></div>
  <div class="section-head v10-gap"><div class="section-title">机构变更</div></div>
  <div class="detail-grid">
    <b>关联数据</b><span>${association}</span><b>当前所选</b><span>${safe(target?.name||'—')}</span>
    <b>机构编码</b><span>${safe(target?.code||'—')}</span><b>系统使用</b><span>${target?(pick(state.currentTree,target.id)?'已纳入':'待纳入'):'—'}</span>
    <b>所属路径</b><span>${target?safe(v17Path(state.newTree,target.id)):'—'}</span><b>下级调整</b><span>${safe(adjustment)}</span>
  </div>
  <div class="section-head v10-gap"><div class="section-title">机构替代与退出</div></div>
  <p class="subtle">先确定上级，再按原组织层级选择下级替代节点，全部设置后整组确认。</p>
  <div class="table-wrap list-table"><table><thead><tr><th>原机构</th><th>关联数据</th><th>替代节点</th><th>机构类型</th><th>关联行政区</th><th>处理要求</th></tr></thead>
  <tbody>${v17ReplacementRows(original,descendants)}</tbody></table></div>
  <div class="flex v10-gap" style="justify-content:flex-end"><button class="btn primary" data-v10-action="confirm-replace" ${locked?'disabled':''}>${locked?'确认中…':'确认'}</button></div></section>`;
  return locked?html.replaceAll('<select ','<select disabled '):html;
};
const v17Reason=changeReason;
changeReason=function(x){
  const reason=x.id==='replace'&&!hasTarget()&&v17CanExit()?'':v17Reason(x);if(reason||x.id!=='replace')return reason;
  const used=new Set();
  for(const old of v17RemovedChildren()){
    const chosen=state.v17.branchChoices?.[old.id];
    if(!chosen){
      if(v17HasData(old.id))return `${old.name}仍有关联数据，请指定替代节点`;
      continue;
    }
    if(!v17ChildConfig(old.id,chosen).region)return `请选择${old.name}替代节点的关联行政区`;
    if(!orgCompare.candidates(state.oldTree,state.newTree,old.id,v17DraftMappings()).some(n=>n.id===chosen))return `${old.name}的替代节点不在对应父级范围，请重新选择`;
    if(used.has(chosen))return '同一目标不能承接多个原机构，请调整下级替代关系';
    used.add(chosen);
  }
  return '';
};
applyChange=function(id){
  if(id!=='replace')return;
  const dest=targetId(),sourceChild=pick(state.newTree,CHILD);
  const retained=new Set(v17Descendants(OLD).map(node=>node.id));
  function includeSourceNode(nodeId){
    if(!nodeId||pick(state.currentTree,nodeId))return;
    const node=pick(state.newTree,nodeId);
    if(!node)return;
    includeSourceNode(node.parent);
    state.currentTree.push({...node});
    if(!state.checked4a.includes(nodeId))state.checked4a.push(nodeId);
  }
  state.currentTree=state.currentTree.filter(node=>node.id!==OLD);
  includeSourceNode(dest);
  for(const current of [...state.currentTree]){
    const source=retained.has(current.id)&&pick(state.newTree,current.id);
    if(source&&current.parent!==source.parent){
      includeSourceNode(source.parent);
      current.parent=source.parent;
    }
  }
  for(const old of v17RemovedChildren()){
    const replacement=pick(state.newTree,state.v17.branchChoices[old.id]);
    state.currentTree=state.currentTree.filter(n=>n.id!==old.id);
    if(!replacement)continue;
    state.config[replacement.id]={...state.config[replacement.id],...v17ChildConfig(old.id,replacement.id)};
    includeSourceNode(replacement.id);
    state.v17.mappings[old.id]=replacement.id;
    state.checked4a=[...new Set([...state.checked4a,replacement.id,replacement.parent])];
    if(old.id===CHILD)state.items.push({id:'BRANCH-D01',kind:'device',name:'新陂供电所直接关联终端',actual:old.id,original:old.id,targetOverride:replacement.id,status:'等待处理',reason:'',tries:0});
  }
  state.checked4a=[...new Set([...state.checked4a,dest,sourceChild?.parent].filter(Boolean))];
  if(sourceChild)state.confirmed.child=true;
  if(sourceChild){state.v17.childStatus='等待处理';state.v17.childDue=Date.now()+1000;}
  if(dest){state.configApplied={...chosenConfig()};state.config[dest]={...state.config[dest],...state.configApplied};}
  state.scan={status:'checking',started:Date.now(),countsAt:0};state.stage='migrating';state.nextStepAt=Date.now()+1600;v10().selectedTarget=dest;
};
const v17Confirm=confirmChange;
confirmChange=function(id){
  if(id!=='replace')return 0;
  if(v17CanExit()&&!hasTarget()){
    if(state.confirmed.replace||changeReason({id:'replace'}))return 0;
    state.v17.exitWithoutTarget=true;state.confirmed.replace=true;applyChange('replace');
    const taskId=state.items.some(item=>!item.deleted)?'DEMO-TASK-01':null;
    v10Record('replace',taskId);
    if(!taskId){
      state.records.find(r=>r.changeId==='replace').result='已完成';
      state.stage='done';state.verified=true;state.nextStepAt=0;
    }
    for(const old of v17RemovedChildren())v10Record(`branch:${old.id}`,taskId);
    eventLog('无替代退出确认','原机构已退出当前系统组织树','运营人员');return 1;
  }
  const noAssociations=v17CanExit();
  const result=v17Confirm(id);
  if(result&&noAssociations&&!v17RemovedChildren().some(old=>v17HasData(old.id))){
    const record=state.records.find(r=>r.changeId==='replace');record.taskId=null;record.result='已完成';
    state.stage='done';state.verified=true;state.nextStepAt=0;
  }
  if(result)for(const old of v17RemovedChildren()){state.confirmed[`branch:${old.id}`]=true;v10Record(`branch:${old.id}`,state.records.find(r=>r.changeId==='replace').taskId);}
  return result;
};
v10DisplayRecords=function(){const seen=new Set();return state.records.filter(r=>{if(!r.taskId)return true;if(seen.has(r.taskId))return false;seen.add(r.taskId);return true;});};

const v17Detail=detail;
const v17ImpactValue=v10ImpactValue;
v10ImpactValue=function(item,id){
  if(item.targetOverride){if(id===OLD)id=item.original;if(id===targetId())id=item.targetOverride;}
  return v17ImpactValue(item,id);
};
tasks=function(){
  const q=state.search.task.trim(),all=v10DisplayRecords(),records=all.filter(r=>!q||v10GroupRecords(r).some(x=>`${x.old}${x.next}${x.type}${x.id}`.includes(q)));
  state.taskPage=Math.min(state.taskPage,Math.max(1,Math.ceil(records.length/state.pageSize)));
  const rows=records.slice((state.taskPage-1)*state.pageSize,state.taskPage*state.pageSize);
  const migration=r=>{const job=state.v17.jobs[r.changeId];if(job&&r.auto)return job.items.length?`${pill(job.status)}<div class="subtle">完成 ${job.items.filter(i=>i.status==='成功').length} 异常 ${job.items.filter(i=>i.status==='失败').length} 等待/处理中 ${job.items.filter(i=>['等待处理','处理中'].includes(i.status)).length}</div>`:'无需关联迁移';if(!r.taskId)return '无需关联迁移';const x=stats();return `${pill(taskStatus())}${state.scan.countsAt?`<div class="subtle">完成 ${x.success} 异常 ${x.failed} 等待/处理中 ${x.pending+x.processing}</div>`:''}`;};
  return `<section class="card list-card"><div class="section-head"><div class="section-title">迁移记录</div></div><div class="toolbar"><input class="field" data-search="task" value="${safe(q)}" placeholder="请输入机构名称或记录号"><button class="btn primary" data-action="query-task">查询</button><button class="btn" data-action="reset-task-search">重置</button></div><div class="table-wrap list-table"><table><thead><tr><th>记录号</th><th>变更事项</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>处理人 / 方式</th><th>处理时间</th><th>组织结果</th><th>关联迁移</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${safe(r.id)}</td><td>${safe(v10GroupRecords(r).map(x=>x.type).join('、'))}</td><td>${safe(r.old)}</td><td>${safe(r.next)}</td><td>${safe(r.auto?'系统自动处理':r.by||'运营人员')}</td><td>${safe(r.at)}</td><td>${pill(r.result)}</td><td>${migration(r)}</td><td><button class="link" data-v10-action="view-record" data-id="${safe(r.id)}">查看处理结果</button></td></tr>`).join('')||'<tr><td colspan="9" class="muted">暂无变更记录</td></tr>'}</tbody></table></div>${pagination(records.length,state.taskPage,'taskPage')}</section>`;
};
function v17AutoDetail(r,job){
  const source=v10().resultSource==='compare'?'返回处理变更':'返回迁移记录',done=job.items.filter(i=>i.status==='成功').length,fail=job.items.filter(i=>i.status==='失败').length,wait=job.items.length-done-fail;
  const summary=`已完成${done}项，异常${fail}项`;
  const message=job.retry?`数据迁移异常项重新处理中，${summary}，等待/处理中${wait}项。`:job.status==='已完成'||job.status==='需处理'?`数据迁移结束，${summary}。${fail?'可点击【查看详情】或异常列查看异常记录，并进行重试。':''}`:`数据迁移中，${summary}，等待/处理中${wait}项。迁移中的数据禁止变更。`;
  return `<section class="card list-card"><div class="section-head"><div class="section-title">处理结果 · ${safe(r.id)}</div><button class="btn" data-v10-action="return-result">${source}</button></div>${v10ResultSummary(r,job)}<div class="section-head v10-gap"><div class="section-title">变更内容</div></div><div class="table-wrap list-table"><table><thead><tr><th>机构</th><th>字段</th><th>原值</th><th>调整后值</th><th>当前实际值</th><th>确认的机构类型</th><th>确认的关联行政区</th></tr></thead><tbody>${job.fields.map(f=>`<tr><td>${safe(job.next.name)}</td><td>${safe({name:'机构名称',short:'机构简称',parent:'上级机构',code:'机构编码'}[f]||f)}</td><td>${safe(f==='parent'?v17ParentName(state.oldTree,job.old[f]):job.old[f])}</td><td>${safe(f==='parent'?v17ParentName(state.newTree,job.next[f]):job.next[f])}</td><td>${safe(f==='parent'?v17ParentName(state.currentTree,pick(state.currentTree,job.node)?.[f]):pick(state.currentTree,job.node)?.[f])}</td>${v10ResultConfigCells(r)}</tr>`).join('')}</tbody></table></div>
  ${job.items.length?`<div class="callout ${job.status==='已完成'?'':'warn'} v10-gap">${message}</div>${fail?`<button class="btn primary" data-v17-action="auto-retry" data-id="${safe(job.id)}" ${job.status!=='需处理'?'disabled':''}>批量重试（${fail} 项）</button>`:''}<div class="section-head v10-gap"><div class="section-title">分类结果</div></div><div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>总数</th><th>完成</th><th>异常</th><th>等待/处理中</th><th>操作</th></tr></thead><tbody>${[...new Set(job.items.map(i=>i.kind))].map(kind=>{const rows=job.items.filter(i=>i.kind===kind),failed=rows.filter(i=>i.status==='失败').length;return `<tr><td>${safe(kind)}</td><td>${rows.length}</td><td>${rows.filter(i=>i.status==='成功').length}</td><td>${failed?`<button class="link" data-v17-action="auto-impact" data-id="${safe(job.id)}" data-kind="${safe(kind)}" data-status="失败">${failed}</button>`:'0'}</td><td>${rows.filter(i=>['等待处理','处理中'].includes(i.status)).length}</td><td><button class="link" data-v17-action="auto-impact" data-id="${safe(job.id)}" data-kind="${safe(kind)}">查看详情</button>${failed?`<button class="link" data-v17-action="auto-retry" data-id="${safe(job.id)}" data-kind="${safe(kind)}" ${job.status!=='需处理'?'disabled':''}>重新处理</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="callout v10-gap">机构信息已更新，无需关联迁移。</div>'}
  <details class="event-box"><summary>处理记录</summary><div class="table-wrap list-table"><table><thead><tr><th>时间</th><th>处理人</th><th>事项</th><th>结果</th></tr></thead><tbody>${job.history.map(e=>`<tr><td>${safe(e.at)}</td><td>${e.user?'运营人员':'系统自动处理'}</td><td>${safe(e.what)}</td><td>${safe(e.result)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
}
detail=function(){
  const r=state.records.find(r=>r.id===v10().selectedRecordId),job=r&&state.v17.jobs[r.changeId];
  if(job&&r.auto)return v17AutoDetail(r,job);
  let html=v17Detail();
  if(r?.taskId)for(const entry of v10GroupRecords(r)){
    const oldId=entry.changeId==='replace'?OLD:entry.changeId.startsWith('branch:')?entry.changeId.slice(7):null;
    if(!oldId)continue;
    const nextId=oldId===OLD?targetId():state.v17.mappings?.[oldId];
    html=html.replace(`<td>${safe(entry.old)}</td><td>${safe(entry.next)}</td>`,`<td>${safe(entry.old)}<div class="subtle">ID：${safe(oldId)}</div></td><td>${safe(entry.next)}<div class="subtle">ID：${safe(nextId)}</div></td>`);
  }
  if(state.v17.childStatus)html=html.replace('随上级替代调整</td>',`随上级替代调整 · ${safe(state.v17.childStatus)}</td>`);
  return html;
};
const v17Modal=modal;
modal=function(){
  const m=state.modal;
  if(m?.type!=='auto-impact')return v17Modal();
  const job=state.v17.jobs[m.id],all=job.items.filter(i=>i.kind===m.kind),rows=all.filter(i=>!m.status||i.status===m.status),start=(state.impactPage-1)*state.pageSize;
  return `<div class="modal-backdrop"><div class="modal impact-modal" role="dialog" aria-modal="true"><div class="modal-header">${safe(m.kind)} · 关联详情<button class="link" data-action="close-modal" aria-label="关闭弹窗">×</button></div><div class="modal-body"><div class="toolbar"><span>处理结果</span><select class="field" data-v17-filter="autoStatus"><option value="">全部</option>${['成功','失败','等待处理','处理中'].map(s=>`<option ${m.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="table-wrap list-table"><table><thead><tr><th>对象名称 / 编号</th><th>原值</th><th>调整后应有值</th><th>当前实际值</th><th>处理结果</th><th>失败原因</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(i=>`<tr><td>${safe(i.name)}<br>${safe(i.id)}</td><td>${safe(i.old)}</td><td>${safe(i.next)}</td><td>${safe(i.status==='成功'?i.next:i.old)}</td><td>${pill(i.status)}</td><td class="impact-reason">${safe(i.reason||'—')}</td></tr>`).join('')||'<tr><td colspan="6">暂无匹配结果</td></tr>'}</tbody></table></div>${pagination(rows.length,state.impactPage,'impactPage')}</div><div class="modal-footer"><button class="btn" data-action="close-modal">关闭</button></div></div></div>`;
};
const v17Render=render;
const v17PageKey=()=>['impact','auto-impact'].includes(state.modal?.type)?'impact':state.page;
render=function(){
  state.v17.pageSizes||={};
  state.pageSize=state.v17.pageSizes[v17PageKey()]||5;
  v17Render();
};
function v17Tick(){
  let changed=false;const now=Date.now();
  if(state.v17.childDue&&now>=state.v17.childDue){
    state.v17.childStatus=state.v17.childStatus==='等待处理'?'处理中':'已完成';
    state.v17.childDue=state.v17.childStatus==='已完成'?0:now+1200;
    changed=true;
  }
  for(const job of Object.values(state.v17.jobs)){
    if(!['等待处理','处理中','核验中'].includes(job.status)||now<job.due)continue;
    const record=state.records.find(r=>r.changeId===job.id);
    const item=job.items.find(i=>['等待处理','处理中'].includes(i.status));
    if(item){
      job.startedAt ||= new Date(now).toLocaleString('zh-CN',{hour12:false});
      job.status='处理中';
      if(cfg().autoFailure&&job.id==='rename'&&item.id==='AUTO-H01'&&!job.retry){item.status='失败';item.reason='关联档案名称写入超时，请在原事项中重新处理。';}
      else item.status='成功';
      job.due+=5000;
      const current=pick(state.currentTree,job.node);if(current)Object.assign(current,job.next);
      if(current&&job.next.parent&&!pick(state.currentTree,job.next.parent)){
        const parent=pick(state.newTree,job.next.parent);if(parent)state.currentTree.push({...parent});
      }
    }else if(job.items.some(i=>i.status==='失败'))job.status='需处理';
    else if(job.status!=='核验中'){job.status='核验中';job.due=now+1200;}
    else {job.status='已完成';state.confirmed[job.id]=true;job.history.push({at:new Date().toLocaleString('zh-CN',{hour12:false}),what:'更新及核验完成',result:'必要更新全部完成，本次树标识已取消'});}
    if(job.status==='需处理'||job.status==='已完成'){
      if(job.retry){const entry=job.history[job.retryEvent];entry.result=`本次 ${job.retryIds.length} 项：成功 ${job.retryIds.filter(id=>job.items.find(i=>i.id===id)?.status==='成功').length} 项，失败 ${job.retryIds.filter(id=>job.items.find(i=>i.id===id)?.status==='失败').length} 项`;job.retry=false;}
    }
    record.result=job.status;changed=true;
  }
  if(changed)render();
}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-v17-action]');if(!el)return;e.stopImmediatePropagation();
  const action=el.dataset.v17Action,id=el.dataset.id;
  if(action==='toggle-branch'){
    const collapsed=new Set(state.v17.collapsedBranches||[]);
    if(collapsed.has(id))collapsed.delete(id);
    else collapsed.add(id);
    state.v17.collapsedBranches=[...collapsed];
    render();
    const toggles=document.querySelectorAll('[data-v17-action="toggle-branch"]');
    [...toggles].find(button=>button.dataset.id===id)?.focus({preventScroll:true});
    return;
  }
  if(action==='result'){const record=state.records.find(r=>r.changeId===id);if(record)openResult(record.id,'compare');}
  if(action==='tree-change'){
    const x=v10Changes().find(x=>x.node===id);if(!x)return;
    if(x.id==='child'||x.id==='replace'){
      if(state.confirmed.replace){const record=state.records.find(r=>r.changeId==='replace');if(record)openResult(record.id,'compare');}
      else openReplaceDetail();
    }
    else if(x.id.startsWith('add:'))navigate('compare');
    else {const r=state.records.find(r=>r.changeId===x.id);if(r)openResult(r.id,'compare');}
  }
  if(action==='auto-impact'){state.impactPage=1;state.modal={type:'auto-impact',id,kind:el.dataset.kind,status:el.dataset.status||''};render();}
  if(action==='auto-retry'){
    const job=state.v17.jobs[id];if(!job||job.status!=='需处理')return;
    const rows=job.items.filter(i=>i.status==='失败'&&(!el.dataset.kind||i.kind===el.dataset.kind));if(!rows.length)return;
    job.retryIds=rows.map(i=>i.id);job.retryEvent=job.history.length;
    job.history.push({at:new Date().toLocaleString('zh-CN',{hour12:false}),what:el.dataset.kind?`${el.dataset.kind}分类重新处理`:'全任务批量重试',result:`已提交 ${rows.length} 项原失败记录，处理中`,user:true});
    for(const row of rows){row.status='处理中';row.reason='';}
    job.retry=true;job.status='处理中';job.due=Date.now()+2000;render();
  }
},true);
document.addEventListener('change',e=>{
  if(e.target.dataset.v17Filter==='autoStatus'){e.stopImmediatePropagation();state.modal.status=e.target.value;state.impactPage=1;render();}
  if(e.target.dataset.v17Child){
    e.stopImmediatePropagation();
    if(v10().submitPending)return;
    const id=e.target.dataset.v17Child;
    state.v17.childConfig||={};
    for(const node of [{id},...v17Descendants(id)]){
      delete state.v17.childConfig[node.id];
      if(node.id!==id)delete state.v17.branchChoices[node.id];
    }
    state.v17.branchChoices[id]=e.target.value;v10().draftVersion++;render();
  }
  if(e.target.dataset.v17Config){
    e.stopImmediatePropagation();
    if(v10().submitPending)return;
    state.v17.childConfig||={};
    const draft=state.v17.childConfig[e.target.dataset.node]||={};
    draft[e.target.dataset.v17Config]=e.target.value;
    v10().draftVersion++;render();
  }
},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.v10Filter){v10().filter={...v10().filterInput};state.changePage=1;render();}},true);
window.addEventListener('change',e=>{
  if(e.target.dataset.action==='page-size'){
    e.stopImmediatePropagation();state.v17.pageSizes||={};
    state.v17.pageSizes[v17PageKey()]=Number(e.target.value);
    const pager={compare:'changePage',tasks:'taskPage',settings:'settingPage',devices:'devicePage',permissions:'permissionPage',history:'historyPage',impact:'impactPage'}[v17PageKey()];
    if(pager)state[pager]=1;render();return;
  }
  if(e.target.id==='candidate-select'&&!state.confirmed.replace&&e.target.value!==state.candidate&&!v10().submitPending){state.v17.branchChoices={};state.v17.childConfig={};}
},true);
setInterval(v17Tick,350);
v17Tick();render();
