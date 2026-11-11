/* V0.9 本地交互数据。组织、设备和权限记录均为演示数据。 */
const ROOT='R', GD='GD', MZ='MZ', OLD='A', NEW='A1', CHILD='C', PEER='P', OTHER='O', EXTRA='X', UNUSED='U0';
const scenarios={
  normal:{label:'正常替代',old:'示例供电所',next:'新示例供电所',existing:false,conflict:false,fail:false},
  legacy:{label:'已有 A1 · 遗留补迁',old:'兴宁供电局',next:'梅州兴宁供电局',existing:true,conflict:true,fail:false},
  failure:{label:'部分失败 · 异常恢复',old:'兴宁供电局',next:'梅州兴宁供电局',existing:true,conflict:true,fail:true},
  multi:{label:'多类别失败 · 分类重试',old:'示例供电所',next:'新示例供电所',existing:true,conflict:false,fail:true,multi:true}
};
Object.assign(scenarios,{
  leaf:{...scenarios.normal,label:'叶子节点替代 · 无下级',leaf:true},
  manual:{...scenarios.normal,label:'无推荐 · 人工指定替代',next:'梅州综合业务中心'},
  autoFailure:{...scenarios.normal,label:'同 ID 自动更新 · 异常重试',autoFailure:true},
  move:{...scenarios.normal,label:'同 ID 独立上级调整',move:true},
  branch:{...scenarios.normal,label:'父子 ID 均变化 · 下级增减',old:'兴宁供电局',next:'兴宁供电服务中心',branch:true},
  multiLevel:{...scenarios.normal,label:'多级下级 · 逐级替代',old:'兴宁供电局',next:'兴宁供电服务中心',branch:true,deep:true},
  exit:{...scenarios.normal,label:'无关联叶子节点 · 直接退出',leaf:true,noData:true}
});
const ORG_TYPES=['全部','项目/设备单位','用户组织机构'];
const labels={device:'当前设备',historicalArchive:'历史档案管理',terminalArchive:'终端档案管理',user:'用户所属机构',query:'查询权限',action:'操作权限',base:'基础数据'};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=id=>document.getElementById(id);
const pick=(arr,id)=>arr.find(n=>n.id===id);
const saveLocal=()=>{try{localStorage.setItem('org-demo-v09',JSON.stringify(state))}catch{}};

function sourceTrees(c){
  const shared=[
    {id:ROOT,name:'网级',parent:null,code:'DEMO-ROOT'},
    {id:GD,name:'省级',parent:ROOT,code:'DEMO-GD'},
    {id:MZ,name:'梅州供电局',parent:GD,code:'DEMO-MZ'},
    {id:PEER,name:'平远供电局',parent:MZ,code:'DEMO-PEER',short:'平远局'},
    {id:OTHER,name:'潮州供电局',parent:GD,code:'DEMO-OTHER'}
  ];
  const old=[...shared.map(n=>({...n})),
    {id:OLD,name:c.old,parent:MZ,code:'DEMO-OLD'},
    {id:CHILD,name:'新陂供电所',parent:OLD,code:'DEMO-CHILD'}];
  if(c.existing)old.push({id:NEW,name:c.next,parent:MZ,code:'DEMO-NEW'});
  const next=[...shared.map(n=>({...n,
    name:n.id===OTHER?'潮州供电局有限公司':n.name,
    short:n.id===PEER?'平远供电':n.short})),
    {id:NEW,name:c.next,parent:MZ,code:'DEMO-NEW'},
    {id:CHILD,name:'新陂供电所',parent:NEW,code:'DEMO-CHILD'},
    {id:EXTRA,name:'梅州新设服务中心',parent:MZ,code:'DEMO-EXTRA'}];
  return {old,next};
}
function makeItems(c){
  const specs=[['D-1001','device','配电监测终端 01'],['D-1002','device','台区智能网关 02'],['D-1003','device','低压开关终端 03'],
    ['H-2001','historicalArchive','终端历史档案 01'],['T-2101','terminalArchive','终端档案 01'],
    ['U-3001','user','用户 李工'],['Q-3002','query','用户 王工 · 查询授权'],['Q-3003','query','用户 李工 · 查询授权'],
    ['A-3004','action','用户 王工 · 操作授权'],['B-4001','base','站点基础数据 01']];
  if(c.multi) for(let n=1;n<=7;n++)specs.push([`D-11${String(n).padStart(2,'0')}`,'device',`模拟终端 ${String(n).padStart(2,'0')}`]);
  return specs.map(([id,kind,name])=>({id,kind,name,actual:OLD,status:'等待处理',reason:'',tries:0,deleted:false,
    demoFailure:c.fail&&(id==='D-1002'||c.multi&&(/^D-110[1-6]$/.test(id)||['Q-3002','Q-3003'].includes(id)))}));
}
function fresh(key='normal'){
  const c=scenarios[key],t=sourceTrees(c),config={};
  [...t.old,...t.next].forEach(n=>{if(!config[n.id])config[n.id]={type:n.id===NEW&&c.conflict?'项目/设备单位':'全部',division:'单位',short:n.short||n.name,sort:'0',terminal:true,region:n.id===NEW&&c.conflict?'广东省 / 广州市':'广东省 / 梅州市'}});
  const selected=t.old.map(n=>n.id);
  return {schema:10,scenario:key,page:'manage',modal:null,toast:'',menu:false,stage:'draft',oldTree:t.old,newTree:t.next,
    currentTree:t.old.filter(n=>selected.includes(n.id)).map(n=>({...n})),checked4a:selected.filter(id=>id!==OLD),
    config,settingsDirty:false,choices:{type:'',region:''},candidate:'',confirmed:{},selectedChanges:[],
    scan:{status:'idle',started:0,countsAt:0},expanded:{manage4a:[ROOT,GD,MZ],manageSystem:[ROOT,GD,MZ],settings:[ROOT,GD]},
    search:{manage4a:'',manageSystem:'',settings:'',settingName:'',change:'',device:'',task:'',item:''},
    selectedNode:null,selectedSettingNode:null,includeChildren:true,settingPage:1,changePage:1,devicePage:1,itemPage:1,pageSize:5,
    items:makeItems(c),newBusiness:c.existing?[{id:'D-EXIST',kind:'device',name:'A1 既有台区终端',actual:NEW,created:'原有业务'}]:[],
    history:[{id:'EV-01',name:'历史告警 01',actual:OLD},{id:'EV-02',name:'归档报表 01',actual:OLD}],
    events:[],nextStepAt:0,recoveryReady:false,verified:false,configApplied:null,impactKind:'device',impactPage:1};
}
let state;try{state=JSON.parse(localStorage.getItem('org-demo-v09'))||fresh()}catch{state=fresh()}
if(![9,10,11].includes(state.schema)||!scenarios[state.scenario])state=fresh();
for(const tree of [state.oldTree,state.newTree,state.systemTree]){
  for(const node of tree||[]){
    if(node.id===ROOT)node.name='网级';
    if(node.id===GD)node.name='省级';
  }
}
const upgradeFromDraft=state.schema===9&&state.stage==='draft';
if(state.stage!=='draft'&&state.config?.[PEER])state.config[PEER].short=pick(state.newTree,PEER).short;
const cfg=()=>scenarios[state.scenario];
function nodeName(id){return id===OLD?cfg().old:id===NEW?cfg().next:(pick(state.newTree,id)||pick(state.oldTree,id))?.name||id}
function notify(msg){state.toast=msg;render();setTimeout(()=>{if(state.toast===msg){state.toast='';render()}},3000)}
function navigate(page){state.page=page;state.menu=false;state.modal=null;render();window.scrollTo(0,0)}
function eventLog(what,result,who='系统'){state.events.push({at:new Date().toLocaleString('zh-CN',{hour12:false}),who,what,result})}
function pill(text){let color=/完成|通过|成功|已确认|已生效|已保存/.test(text)?'green':/失败|异常|需处理/.test(text)?'red':/待|中|统计/.test(text)?'orange':'gray';return `<span class="pill ${color}">${safe(text)}</span>`}
function title(){return {manage:'组织机构管理',settings:'组织机构设置',compare:'处理变更',plan:'变更详情',tasks:'迁移记录',detail:'处理结果',devices:'设备列表',permissions:'用户权限明细',history:'历史事件与报表'}[state.page]}
function header(){const tabs=[['manage','组织机构管理'],['settings','组织机构设置'],['compare','处理变更'],['tasks','迁移记录'],['devices','设备列表'],['permissions','用户权限明细']];return `<header class="header"><span class="grid-icon" data-action="menu">▦</span><span class="logo">☰</span><span class="header-spacer"></span><button class="head-btn">工作台</button><button class="head-btn">个性化配置</button><input class="field header-search" placeholder="搜索" disabled><span class="head-pill">●　34112</span><span>任务中心 ⌃</span></header><nav class="tabs"><div class="tab" data-page="manage">首页</div>${tabs.map(([p,t])=>`<div class="tab ${state.page===p?'active':''}" data-page="${p}">${t}</div>`).join('')}${!tabs.some(x=>x[0]===state.page)?`<div class="tab active">${title()}</div>`:''}</nav>`}
function scenarioBar(){return `<div class="scenario-bar"><strong>本地交互 Demo</strong><span>演示场景</span><select class="field" id="scenario-select">${Object.entries(scenarios).map(([k,v])=>`<option value="${k}" ${state.scenario===k?'selected':''}>${v.label}</option>`).join('')}</select><span class="muted">模拟数据，不连接真实平台</span>${cfg().fail&&state.stage==='needsAction'?`<button class="btn" data-v10-action="repair-failure" ${state.recoveryReady?'disabled':''}>${state.recoveryReady?'模拟故障已修正':'修正模拟故障'}</button>`:''}<span class="right"></span><button class="btn" data-action="reset">重置当前场景</button></div>`}
function pagination(total,page,key){const pages=Math.max(1,Math.ceil(total/state.pageSize));return `<div class="pagination"><span>共 ${total} 条</span><select class="field" data-action="page-size"><option value="5" ${state.pageSize===5?'selected':''}>5条/页</option><option value="10" ${state.pageSize===10?'selected':''}>10条/页</option><option value="20" ${state.pageSize===20?'selected':''}>20条/页</option></select><span class="right"></span><button data-pager="${key}" data-to="${Math.max(1,page-1)}" ${page===1?'disabled':''}>‹</button>${Array.from({length:Math.min(pages,6)},(_,i)=>`<button class="${page===i+1?'active':''}" data-pager="${key}" data-to="${i+1}">${i+1}</button>`).join('')}${pages>6?`<span>…</span><button data-pager="${key}" data-to="${pages}">${pages}</button>`:''}<button data-pager="${key}" data-to="${Math.min(pages,page+1)}" ${page===pages?'disabled':''}>›</button></div>`}

const changes=()=>[
  {id:'replace',type:'替代 / 删除',old:cfg().old,next:cfg().next,node:OLD,system:true,method:'替代为 A1'},
  {id:'child',type:'上级调整',old:`新陂供电所 / ${cfg().old}`,next:`新陂供电所 / ${cfg().next}`,node:CHILD,system:true,method:'随上级调整'},
  {id:'rename',type:'名称修改',old:'潮州供电局',next:'潮州供电局有限公司',node:OTHER,system:true,method:'按源更新'},
  {id:'info',type:'信息修改',old:'平远局',next:'平远供电',node:PEER,system:true,method:'按源更新'},
  {id:'add',type:'新增',old:'—',next:'梅州新设服务中心',node:EXTRA,system:!!pick(state.currentTree,EXTRA),method:'沿用组织管理保存'}
];
function changedBadge(id){return ({[OLD]:state.confirmed.replace?'4A已删除 · 已处理':'4A已删除 · 待处理',[NEW]:cfg().existing?'候选目标':'新增 · 候选目标',[CHILD]:'上级调整',[OTHER]:'名称修改',[PEER]:'信息修改',[EXTRA]:'新增'})[id]||''}
function sourceTree(nodes,key,checkboxes=false){
  const query=(state.search[key]||'').trim(),expanded=new Set(state.expanded[key]||[]),all=checkboxes&&state.stage==='draft'?[...nodes,{...pick(state.oldTree,OLD),ghost:true}]:nodes;
  const direct=new Set([OLD,NEW,CHILD,OTHER,PEER,EXTRA]);
  const descendants=id=>all.filter(n=>n.parent===id).some(n=>direct.has(n.id)||descendants(n.id));
  const matches=id=>{const n=pick(all,id);return n&&(n.name.includes(query)||all.some(x=>x.parent===id&&matches(x.id)))};
  function row(n,depth){const kids=all.filter(x=>x.parent===n.id),open=query?true:expanded.has(n.id),badge=checkboxes?changedBadge(n.id):'';
    const hint=checkboxes&&!badge&&descendants(n.id)?'<span class="tree-hint">下级有变更</span>':'';
    return `<div class="tree-row ${state.selectedNode===n.id?'selected':''} ${n.ghost?'ghost':''}" style="padding-left:${depth*19}px" data-action="tree-node" data-key="${key}" data-id="${n.id}"><span class="tree-caret">${kids.length?open?'▾':'▸':''}</span>${checkboxes?`<input type="checkbox" data-action="tree-check" data-id="${n.id}" ${n.ghost||n.id!==EXTRA?'disabled':''} ${state.checked4a.includes(n.id)?'checked':''}>`:''}<span>${safe(n.name)}</span>${badge?`<span class="tree-badge ${n.ghost?'deleted':''}">${safe(badge)}</span>`:''}${!open?hint:''}</div>${open?kids.filter(x=>!query||matches(x.id)).map(x=>row(x,depth+1)).join(''):''}`;
  }
  return all.filter(n=>!n.parent&&(!query||matches(n.id))).map(n=>row(n,0)).join('')||'<div class="muted">无匹配机构</div>';
}
function manage(){
  const total=changes().length,done=changes().filter(x=>state.confirmed[x.id]).length;
  return `<div class="card manage-card"><div class="intro-line"><span class="minor">系统管理 / 组织机构管理　 ${pill(`已确认 ${done} / ${total} 项`)}</span><div class="flex"><button class="btn" data-page="compare">处理变更</button><button class="btn" data-page="tasks">迁移记录</button></div></div><div class="tree-grid"><section class="tree-panel"><div class="panel-heading"><span>4A组织机构树</span></div><input class="field search" data-search="manage4a" value="${safe(state.search.manage4a)}" placeholder="请输入搜索条件"><div class="tree-scroll">${sourceTree(state.newTree,'manage4a',true)}</div></section><section class="tree-panel"><div class="panel-heading"><span>系统组织机构树</span></div><input class="field search" data-search="manageSystem" value="${safe(state.search.manageSystem)}" placeholder="请输入搜索条件"><div class="tree-scroll">${sourceTree(state.currentTree,'manageSystem')}</div></section></div><div class="footer-note">在“处理变更”确认即保存；已确认事项立即反映在系统组织机构树，并可在“迁移记录”查看。</div></div>`;
}
function settingsRows(){let nodes=state.currentTree.filter(n=>n.id!==ROOT);if(state.selectedSettingNode&&pick(state.currentTree,state.selectedSettingNode)){const selected=new Set([state.selectedSettingNode]);if(state.includeChildren){let changed=true;while(changed){changed=false;for(const n of state.currentTree)if(selected.has(n.parent)&&!selected.has(n.id)){selected.add(n.id);changed=true}}}nodes=nodes.filter(n=>selected.has(n.id))}const q=state.search.settingName.trim();return q?nodes.filter(n=>n.name.includes(q)||n.code.includes(q)):nodes}
function settings(){const rows=settingsRows(),start=(state.settingPage-1)*state.pageSize;return `<div class="split"><aside class="side-tree"><input class="field search" data-search="settings" value="${safe(state.search.settings)}" placeholder="请输入搜索条件"><div class="tree-scroll">${sourceTree(state.currentTree,'settings')}</div></aside><section><div class="toolbar"><input class="field" data-search="settingName" value="${safe(state.search.settingName)}" placeholder="请输入组织机构名称"><label><input type="checkbox" data-action="include-children" ${state.includeChildren?'checked':''}> 包含所有下级机构</label><span style="flex:1"></span><button class="btn primary" data-action="save-settings" ${!state.settingsDirty?'disabled':''}>保存</button></div><div class="table-wrap"><table class="setting-table"><thead><tr><th>组织机构名称</th><th>上级组织机构</th><th>机构编码</th><th>机构类型</th><th>部门/单位</th><th>机构简称</th><th>排序号</th><th>终端挂靠权限 ⓘ</th><th>操作</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(n=>{const c=state.config[n.id];return `<tr><td>${safe(n.name)}</td><td>${safe(nodeName(n.parent))}</td><td>${safe(n.code)}</td><td><select class="field" aria-label="机构类型" data-setting="type" data-id="${safe(n.id)}">${ORG_TYPES.map(type=>`<option ${c.type===type?'selected':''}>${type}</option>`).join('')}</select></td><td><select class="field" data-setting="division" data-id="${n.id}"><option ${c.division==='单位'?'selected':''}>单位</option><option ${c.division==='部门'?'selected':''}>部门</option></select></td><td><input class="field" data-setting="short" data-id="${n.id}" value="${safe(c.short)}"></td><td><input class="field mini" data-setting="sort" data-id="${n.id}" value="${safe(c.sort)}"></td><td><button class="switch ${c.terminal?'on':''}" data-action="toggle-terminal" data-id="${n.id}">${c.terminal?'启用':'停用'}</button></td><td><button class="link" data-action="region" data-id="${n.id}">关联行政区域</button></td></tr>`}).join('')||'<tr><td colspan="9" class="muted">暂无数据</td></tr>'}</tbody></table></div>${pagination(rows.length,state.settingPage,'settingPage')}</section></div>`}

function changeReason(x){if(x.id==='replace'){if(state.candidate!==NEW)return '请确认替代目标';const c=chosenConfig();if(!c.type||!c.region)return '请选择配置差异的拟生效值';if(!c.type.includes('用户组织机构')||!c.type.includes('项目/设备单位'))return '目标机构类型不能承接用户和设备'}if(x.id==='child'&&!state.confirmed.replace)return '请先确认上级替代关系';return ''}
function applyChange(id){
  if(id==='rename'){Object.assign(pick(state.currentTree,OTHER),pick(state.newTree,OTHER));return}
  if(id==='info'){Object.assign(pick(state.currentTree,PEER),pick(state.newTree,PEER));state.config[PEER].short=pick(state.newTree,PEER).short;return}
  if(id==='replace'){
    state.checked4a=[...new Set([...state.checked4a,NEW])];
    state.currentTree=state.currentTree.filter(n=>n.id!==OLD).map(n=>n.id===CHILD?{...n,parent:NEW}:n);
    if(!pick(state.currentTree,NEW))state.currentTree.push({...pick(state.newTree,NEW)});
    state.confirmed.child=true;
    state.configApplied=chosenConfig();
    state.config[NEW]={...state.config[NEW],...state.configApplied};
    state.scan={status:'checking',started:Date.now(),countsAt:0};
    state.stage='migrating';
    state.nextStepAt=Date.now()+1600;
  }
}
function confirmChange(id){
  const x=changes().find(y=>y.id===id);
  if(!x||id==='add'||state.confirmed[id]||changeReason(x))return 0;
  state.confirmed[id]=true;
  applyChange(id);
  state.selectedChanges=state.selectedChanges.filter(x=>x!==id&&!(id==='replace'&&x==='child'));
  if(id==='replace'){
    eventLog(`${cfg().old} → ${cfg().next} 替代及下级调整确认`,'已保存并生效，关联迁移任务已创建','运营人员');
    return 2;
  }
  eventLog(`${x.type}确认`,'已保存并生效','运营人员');
  return 1;
}
function compare(){const all=changes(),q=state.search.change.trim(),rows=all.filter(x=>!q||`${x.type}${x.old}${x.next}${x.method}`.includes(q)),start=(state.changePage-1)*state.pageSize,selected=new Set(state.selectedChanges);return `<section class="card list-card"><div class="section-head"><div class="section-title">处理变更</div><button class="btn" data-page="manage">返回组织机构管理</button></div><div class="toolbar"><input class="field" data-search="change" value="${safe(q)}" placeholder="请输入机构名称或变更类型"><button class="btn primary" data-action="query-change">查询</button><button class="btn" data-action="reset-change">重置</button><span class="toolbar-spacer"></span><button class="btn primary" data-action="confirm-selected" ${!selected.size?'disabled':''}>确认所选</button></div><div class="table-wrap list-table"><table><thead><tr><th><input type="checkbox" data-action="select-all-change" ${all.filter(x=>!state.confirmed[x.id]).every(x=>selected.has(x.id))?'checked':''} ${all.every(x=>state.confirmed[x.id])?'disabled':''}></th><th>变更类型</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>原系统使用</th><th>处理方式</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(x=>`<tr><td><input type="checkbox" data-change-check="${x.id}" ${selected.has(x.id)?'checked':''} ${state.confirmed[x.id]?'disabled':''}></td><td>${safe(x.type)}</td><td>${safe(x.old)}</td><td>${safe(x.next)}</td><td>${x.system?'已纳入':'未纳入'}</td><td>${safe(x.method)}</td><td>${pill(state.confirmed[x.id]?'已确认':changeReason(x)?'需处理':'待确认')}</td><td><button class="link" data-action="change-detail" data-id="${x.id}">查看详情</button>${!state.confirmed[x.id]?`<button class="link" data-action="confirm-one" data-id="${x.id}">确认</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="muted">暂无数据</td></tr>'}</tbody></table></div>${pagination(rows.length,state.changePage,'changePage')}${state.batchMessage?`<div class="callout ${state.batchBlocked?'warn':''}">${safe(state.batchMessage)}</div>`:''}${state.confirmed.replace?`<div class="scan-line">关联核对：${pill(state.scan.status==='ready'?'核对完成':'关联核对中')}　分类数量：${state.scan.countsAt?'已统计':'统计中'} <button class="link" data-page="plan">查看详情</button></div>`:''}<div class="footer-note">源变化以两版完整 4A 快照为准；一直未纳入的测试单位在两版中相同；若本次勾选纳入，单列为系统首次纳入，不视为源新增。确认即保存；已确认事项立即生效并进入迁移记录，替代关系确认后生成关联迁移任务。</div></section>`}
function chosenConfig(){const a=state.config[OLD],b=state.config[NEW]||{};return {type:!cfg().conflict?a.type:state.choices.type==='old'?a.type:state.choices.type==='new'?b.type:'',region:!cfg().conflict?a.region:state.choices.region==='old'?a.region:state.choices.region==='new'?b.region:'',division:a.division,terminal:a.terminal}}
function plan(){const a=state.config[OLD],b=state.config[NEW]||{type:'未配置',region:'未配置'},c=chosenConfig(),problem=changeReason({id:'replace'});return `<section class="card list-card"><div class="section-head"><div class="section-title">变更详情 · ${safe(cfg().old)}</div><button class="btn" data-page="compare">返回处理变更</button></div><div class="detail-grid"><b>原机构</b><span>${safe(cfg().old)} · DEMO-OLD</span><b>源侧状态</b><span>最新 4A 中已删除</span><b>原路径</b><span>中国南方电网 / 广东电网 / 梅州供电局 / ${safe(cfg().old)}</span><b>系统使用</b><span>${state.confirmed.replace?'已退出当前系统树':'当前仍已纳入'}</span><b>候选目标</b><span>${safe(cfg().next)} · ${cfg().existing?'已在当前系统树':'待纳入系统树'}</span><b>下级</b><span>新陂供电所 ID 未变，随父级调整</span></div><div class="toolbar" style="margin-top:18px"><select id="candidate-select" class="field"><option value="">请选择替代目标</option><option value="A1" ${state.candidate===NEW?'selected':''}>${safe(cfg().next)} · DEMO-NEW</option><option value="P" ${state.candidate===PEER?'selected':''}>平远供电局 · 其他候选</option></select></div><div class="section-head"><div class="section-title">机构配置差异</div></div><div class="table-wrap list-table"><table><thead><tr><th>配置项</th><th>A 原值</th><th>A1 现值</th><th>调整后配置</th></tr></thead><tbody><tr><td>机构类型 *</td><td>${safe(a.type)}</td><td>${safe(b.type)}</td><td>${cfg().conflict?`<select class="field" data-choice="type"><option value="">请选择</option><option value="old" ${state.choices.type==='old'?'selected':''}>沿用 A：${safe(a.type)}</option><option value="new" ${state.choices.type==='new'?'selected':''}>保留 A1：${safe(b.type)}</option></select>`:safe(a.type)}</td></tr><tr><td>关联行政区域 *</td><td>${safe(a.region)}</td><td>${safe(b.region)}</td><td>${cfg().conflict?`<select class="field" data-choice="region"><option value="">请选择</option><option value="old" ${state.choices.region==='old'?'selected':''}>沿用 A：${safe(a.region)}</option><option value="new" ${state.choices.region==='new'?'selected':''}>保留 A1：${safe(b.region)}</option></select>`:safe(a.region)}</td></tr><tr><td>终端挂靠权限</td><td>启用</td><td>${cfg().existing?'启用':'未配置'}</td><td>启用</td></tr></tbody></table></div>${problem?`<div class="callout warn" style="margin-top:16px">${safe(problem)}</div>`:''}<div class="flex space"><span>${state.confirmed.replace?pill('已确认'):pill('待确认')}</span><button class="btn primary" data-action="confirm-replace" ${state.confirmed.replace?'disabled':''}>确认</button></div>${state.confirmed.replace?impactSummary(true):''}</section>`}
function impactSummary(preview=false){const ready=state.scan.status==='ready',counted=!!state.scan.countsAt;return `<div class="section-head" style="margin-top:20px"><div class="section-title">关联核对</div>${pill(ready?'核对完成':'关联核对中')}</div><div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>关联数量</th><th>结果</th><th>操作</th></tr></thead><tbody>${Object.entries(labels).map(([k,v])=>`<tr><td>${v}</td><td>${counted?state.items.filter(i=>i.kind===k).length:'统计中'}</td><td>${ready?'范围、配置及权限已核对':'核对中'}</td><td><button class="link" data-action="impact" data-kind="${k}" ${!ready?'disabled':''}>查看详情</button></td></tr>`).join('')}</tbody></table></div>${preview?'<div class="footer-note">按需分页查看明细；关联详情按类别和当前页展示。</div>':''}`}

function stats(){return {all:state.items.length,success:state.items.filter(i=>i.status==='成功').length,failed:state.items.filter(i=>i.status==='失败').length,pending:state.items.filter(i=>i.status==='等待处理').length,processing:state.items.filter(i=>i.status==='处理中').length}}
function taskStatus(){return ({draft:'等待处理',migrating:'迁移中',retrying:'重新处理中',verifying:'核验中',needsAction:'需处理',done:'已完成'})[state.stage]}
function tasks(){
  const all=changes(),saved=all.filter(x=>state.confirmed[x.id]),q=state.search.task.trim();
  const rows=saved.filter(x=>!q||`${x.type}${x.old}${x.next}${x.method}${x.id==='replace'||x.id==='child'?'DEMO-TASK-01':''}`.includes(q));
  const hasTask=!!state.confirmed.replace,summary=hasTask?'替代关系确认后已保存并生效，关联迁移任务已创建。':saved.length?'已确认的变更已保存；当前尚无需要关联迁移的替代任务。':'尚无已确认的变更。点击“处理变更”中的确认后，记录会出现在这里。';
  const x=stats(),showTask=hasTask&&(!q||`${cfg().old}${cfg().next}DEMO-TASK-01`.includes(q));
  return `<section class="card list-card"><div class="section-head"><div class="section-title">迁移记录</div><button class="btn" data-page="compare">处理变更</button></div><div class="callout">${summary}</div><div class="toolbar"><input class="field" data-search="task" value="${safe(q)}" placeholder="请输入机构名称或任务号"><button class="btn primary" data-action="query-task">查询</button><button class="btn" data-action="reset-task-search">重置</button></div><div class="section-head"><div class="section-title">已确认变更</div><span class="subtle">共 ${saved.length} 项</span></div><div class="table-wrap list-table"><table><thead><tr><th>变更类型</th><th>原机构 / 原值</th><th>调整后机构 / 新值</th><th>处理方式</th><th>保存结果</th><th>关联迁移</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${safe(c.type)}</td><td>${safe(c.old)}</td><td>${safe(c.next)}</td><td>${safe(c.method)}</td><td>${pill(c.method==='暂不纳入'?'已保存':'已生效')}</td><td>${['replace','child'].includes(c.id)?'<button class="link" data-page="detail">DEMO-TASK-01</button>':'无需关联迁移'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">暂无已确认记录</td></tr>'}</tbody></table></div>${hasTask?`<div class="section-head"><div class="section-title">关联迁移任务</div></div><div class="table-wrap list-table"><table><thead><tr><th>任务号</th><th>原机构</th><th>调整后机构</th><th>系统组织</th><th>当前结果</th><th>关联处理</th><th>操作</th></tr></thead><tbody>${showTask?`<tr><td>DEMO-TASK-01</td><td>${safe(cfg().old)}</td><td>${safe(cfg().next)}</td><td>${pill('已生效')}</td><td>${pill(taskStatus())}</td><td>成功 ${x.success}　异常 ${x.failed}　等待 ${x.pending}</td><td><button class="link" data-page="detail">查看详情</button></td></tr>`:'<tr><td colspan="7" class="muted">暂无匹配任务</td></tr>'}</tbody></table></div>${pagination(showTask?1:0,1,'taskPage')}`:''}</section>`;
}
function detail(){if(state.stage==='draft')return tasks();const x=stats(),pct=Math.round(x.success/x.all*100);return `<section class="card list-card"><div class="section-head"><div class="section-title">处理详情 · DEMO-TASK-01</div><button class="btn" data-page="tasks">返回迁移记录</button></div><div class="detail-grid"><b>原机构</b><span>${safe(cfg().old)}</span><b>调整后机构</b><span>${safe(cfg().next)}</span><b>系统组织</b><span>${pill('已生效')}　${cfg().existing?'复用已有 A1':'纳入 A1'}</span><b>关联处理</b><span>${pill(taskStatus())}</span><b>存量操作</b><span>${state.stage==='done'?'已恢复':'受影响存量暂不可修改或删除'}</span><b>新增业务</b><span>A1 可正常新增</span></div><div class="mini-cards" style="margin-top:16px"><div class="mini-card">受影响存量<strong>${x.all}</strong></div><div class="mini-card">已完成<strong>${x.success}</strong></div><div class="mini-card">异常<strong>${x.failed}</strong></div><div class="mini-card">等待处理<strong>${x.pending}</strong></div></div><div class="status-track"><i style="width:${pct}%"></i></div><div class="toolbar" style="margin-top:16px"><button class="btn" data-page="devices">查看设备列表</button><button class="btn" data-page="permissions">查看权限明细</button>${state.stage==='needsAction'?'<button class="btn primary" data-action="fix-exception">处理异常</button>':''}</div>${state.stage==='needsAction'?`<div class="callout error">${safe(state.items.find(i=>i.status==='失败')?.reason||'关联处理异常')}。修正后仅重新处理异常项。</div>`:state.stage==='done'?'<div class="callout">关联处理与核验已完成，受影响存量的操作限制已解除。</div>':'<div class="callout warn">A1 已可使用。受影响存量仍可查询，处理完成前暂不可修改或删除。</div>'}<div class="section-head"><div class="section-title">分类结果</div><span class="subtle">查看详情可按类别分页浏览</span></div><div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>总数</th><th>完成</th><th>异常</th><th>等待</th><th>操作</th></tr></thead><tbody>${Object.entries(labels).map(([k,v])=>{const a=state.items.filter(i=>i.kind===k);return `<tr><td>${v}</td><td>${a.length}</td><td>${a.filter(i=>i.status==='成功').length}</td><td>${a.filter(i=>i.status==='失败').length}</td><td>${a.filter(i=>i.status==='等待处理').length}</td><td><button class="link" data-action="impact" data-kind="${k}">查看详情</button></td></tr>`}).join('')}</tbody></table></div><details class="event-box"><summary>处理记录</summary><div class="table-wrap list-table"><table><thead><tr><th>时间</th><th>操作人</th><th>事项</th><th>结果</th></tr></thead><tbody>${state.events.map(e=>`<tr><td>${safe(e.at)}</td><td>${safe(e.who)}</td><td>${safe(e.what)}</td><td>${safe(e.result)}</td></tr>`).join('')}</tbody></table></div></details></section>`}
function visibleDeviceRows(){const rows=[...state.items.filter(i=>['device','historicalArchive','terminalArchive'].includes(i.kind)&&!i.deleted),...state.newBusiness];return rows.filter(i=>!state.search.device||`${i.name}${i.id}`.includes(state.search.device))}
function devices(){const rows=visibleDeviceRows(),start=(state.devicePage-1)*state.pageSize;return `<section class="card list-card"><div class="section-head"><div class="section-title">设备列表</div><button class="btn" data-page="history">历史事件与报表</button></div><div class="domain-tabs"><span>全部</span><span>发电</span><span>输电</span><span>变电</span><span>配用电</span><span class="selected">基建</span><span>安监</span><span>供应链</span><span>IT信息</span><span>办公</span><span>其他</span></div><div class="toolbar"><input class="field" data-search="device" value="${safe(state.search.device)}" placeholder="请输入终端名称"><input class="field" value="${safe(state.stage==='draft'?cfg().old:cfg().next)}" disabled><label><input type="checkbox" checked disabled> 含下级单位</label><button class="btn primary" data-action="device-query">查询</button><button class="btn" data-action="device-reset">重置</button><span class="toolbar-spacer"></span><button class="btn primary" data-action="new-device" ${state.stage==='draft'?'disabled':''}>新增设备</button></div><div class="table-wrap list-table"><table><thead><tr><th>终端名称</th><th>物联标识码</th><th>终端大类</th><th>接入类型</th><th>所属单位</th><th>关联信息</th><th>操作</th></tr></thead><tbody>${rows.slice(start,start+state.pageSize).map(i=>`<tr><td>${safe(i.name)}</td><td>${safe(i.id)}</td><td>${i.kind==='device'?'物联终端':labels[i.kind]}</td><td>直连终端</td><td>${safe(nodeName(i.actual))}</td><td>${i.kind==='device'?'—':'关联设备当前归属'}</td><td><button class="link" data-action="view-device" data-id="${safe(i.id)}">查看</button><button class="link" data-action="edit-device" data-id="${safe(i.id)}">修改</button><button class="link" data-action="delete-device" data-id="${safe(i.id)}">删除</button></td></tr>`).join('')||'<tr><td colspan="7" class="muted">暂无数据</td></tr>'}</tbody></table></div>${pagination(rows.length,state.devicePage,'devicePage')}</section>`}
function permissions(){const rows=state.items.filter(i=>['user','query','action'].includes(i.kind));return `<section class="card list-card"><div class="section-head"><div class="section-title">用户权限明细</div><button class="btn" data-page="detail">返回处理详情</button></div><div class="table-wrap list-table"><table><thead><tr><th>类别</th><th>用户 / 对象</th><th>所属机构</th><th>原授权或所属</th><th>调整后</th><th>当前实际值</th><th>保留条件</th><th>结果</th></tr></thead><tbody>${rows.map(i=>`<tr><td>${labels[i.kind]}</td><td>${safe(i.name)}<br><span class="subtle">${safe(i.id)}</span></td><td>${i.id.includes('3002')||i.id.includes('3004')?'梅州供电局':safe(nodeName(i.kind==='user'?i.actual:OLD))}</td><td>${safe(cfg().old)}</td><td>${safe(cfg().next)}</td><td>${safe(nodeName(i.actual))}</td><td>${i.kind==='user'?'—':'生产域 ∩ 梅州分区；未变下级有效'}</td><td>${pill(i.status)}</td></tr>`).join('')}</tbody></table></div><div class="footer-note">用户所属机构、查询授权和操作授权分别核对。王工所属梅州供电局，仍有直接授予 A 的权限。</div></section>`}
function historyPage(){return `<section class="card list-card"><div class="section-head"><div class="section-title">历史事件与报表</div><button class="btn" data-page="devices">返回设备列表</button></div><div class="toolbar"><input class="field" value="${safe(state.stage==='draft'?cfg().old:cfg().next)}" disabled><button class="btn primary">查询</button></div><div class="table-wrap list-table"><table><thead><tr><th>记录 ID</th><th>记录名称</th><th>查询入口</th><th>发生时单位</th></tr></thead><tbody>${state.history.map(i=>`<tr><td>${i.id}</td><td>${i.name}</td><td>${safe(state.stage==='draft'?cfg().old:cfg().next)}</td><td>${safe(nodeName(i.actual))}</td></tr>`).join('')}</tbody></table></div></section>`}

function modal(){const m=state.modal;if(!m)return '';let heading='',body='',footer='<button class="btn" data-action="close-modal">关闭</button>';
  if(m.type==='change'){const x=changes().find(y=>y.id===m.id);heading=`${safe(x.type)} · 变更详情`;body=`<div class="detail-grid"><b>原值</b><span>${safe(x.old)}</span><b>新值</b><span>${safe(x.next)}</span><b>系统使用</b><span>${x.system?'已纳入':'未纳入'}</span><b>处理方式</b><span>${safe(x.method)}</span><b>状态</b><span>${pill(state.confirmed[x.id]?'已确认':changeReason(x)?'需处理':'待确认')}</span></div>`}
  else if(m.type==='region'){const n=pick(state.currentTree,m.id)||pick(state.newTree,m.id);heading='关联行政区域';body=`<div class="form-row"><b>机构名称：</b><input class="field" value="${safe(n?.name)}" disabled></div><div class="form-row"><b>行政区域：</b><input id="region-input" class="field" value="${safe(state.config[m.id]?.region)}"></div><div class="form-row"><b>组织编码：</b><input class="field" value="${safe(n?.code)}" disabled></div>`;footer='<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="save-region">保存</button>'}
  else if(m.type==='new-device'){heading='新增设备';body=`<div class="form-row"><b>所属单位：</b><input class="field" value="${safe(cfg().next)}" disabled></div><div class="form-row"><b>终端名称：</b><input id="new-name" class="field" placeholder="请输入终端名称"></div><div class="form-row"><b>物联标识码：</b><input id="new-id" class="field" placeholder="请输入物联标识码"></div>`;footer='<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="save-device">保存</button>'}
  else if(m.type==='view-device'||m.type==='edit-device'){const i=[...state.items,...state.newBusiness].find(x=>x.id===m.id),restricted=state.stage!=='draft'&&state.stage!=='done'&&state.items.some(x=>x.id===m.id);heading=m.type==='view-device'?'查看设备':'修改设备';body=`<div class="detail-grid"><b>终端名称</b><span>${safe(i.name)}</span><b>标识码</b><span>${safe(i.id)}</span><b>所属单位</b><span>${safe(nodeName(i.actual))}</span></div>${restricted?'<div class="callout warn" style="margin-top:14px">该数据正在进行机构调整，暂不可修改或删除。</div>':''}${m.type==='edit-device'&&!restricted?`<div class="form-row" style="margin-top:14px"><b>终端名称：</b><input id="edit-name" class="field" value="${safe(i.name)}"></div>`:''}`;footer=`<button class="btn" data-action="close-modal">关闭</button>${m.type==='edit-device'&&!restricted?'<button class="btn primary" data-action="save-edit-device">保存</button>':''}`}
  else if(m.type==='delete-device'){const i=[...state.items,...state.newBusiness].find(x=>x.id===m.id);heading='删除设备';body=`<p>确定删除“${safe(i.name)}”吗？</p>`;footer='<button class="btn" data-action="close-modal">取消</button><button class="btn danger" data-action="confirm-delete">删除</button>'}
  else if(m.type==='reset'){heading='重置演示场景';body='<p>重置后将清除当前场景的处理进度与新增演示数据。</p>';footer='<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="confirm-reset">重置</button>'}
  return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-header">${heading}<button class="link" aria-label="关闭弹窗" data-action="close-modal">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></div></div>`;
}
function menu(){return state.menu?`<div class="menu-overlay" data-action="close-menu"><div class="menu"><h4>系统管理</h4><button data-page="settings">组织机构设置</button><button data-page="manage">组织机构管理</button><button data-page="compare">处理变更</button><button data-page="tasks">迁移记录</button><h4>业务示例</h4><button data-page="devices">设备列表</button><button data-page="permissions">用户权限明细</button><button data-page="history">历史事件与报表</button></div></div>`:''}
function render(){const view={manage,settings,compare,plan,tasks,detail,devices,permissions,history:historyPage}[state.page]||manage;byId('app').innerHTML=header()+`<main class="workspace">${scenarioBar()}${view()}</main>`+menu()+modal()+(state.toast?`<div class="toast">${safe(state.toast)}</div>`:'');saveLocal()}

function automaticStep(){if(state.stage==='migrating'){const i=state.items.find(x=>x.status==='等待处理');if(i){i.tries++;if(cfg().fail&&i.id==='D-1002'&&i.tries===1){i.status='失败';i.reason='台区智能网关 02 的设备档案写入超时，当前实际归属仍为原机构';eventLog('设备关联处理异常',i.reason)}else{i.status='成功';i.actual=NEW;i.reason=''}state.nextStepAt+=1400;return}if(state.items.some(x=>x.status==='失败')){state.stage='needsAction';state.nextStepAt=0;eventLog('关联处理','有异常需处理')}else{state.stage='verifying';state.nextStepAt+=1500;eventLog('关联处理','已完成，自动核验中')}return}
  if(state.stage==='verifying'){if(state.items.some(i=>i.actual!==NEW||i.status!=='成功')){state.stage='needsAction';eventLog('自动核验','未通过，需处理异常')}else{state.stage='done';state.verified=true;eventLog('自动核验与操作限制','核验通过，限制已解除')}state.nextStepAt=0}}
function tick(){let changed=false,now=Date.now();if(state.scan.status==='checking'&&now-state.scan.started>=1700){state.scan.status='ready';eventLog('关联范围、配置及权限','核对完成');changed=true}if(state.scan.status==='ready'&&!state.scan.countsAt&&now-state.scan.started>=3800){state.scan.countsAt=now;changed=true}let steps=0;while(['migrating','retrying','verifying'].includes(state.stage)&&state.scan.status==='ready'&&state.nextStepAt&&now>=state.nextStepAt&&steps++<30){automaticStep();changed=true}if(changed)render()}
function onClick(e){const el=e.target.closest('[data-page],[data-action],[data-pager]');if(!el)return;if(el.dataset.page){navigate(el.dataset.page);return}if(el.dataset.pager){state[el.dataset.pager]=Number(el.dataset.to);render();return}const a=el.dataset.action,id=el.dataset.id;
  if(a==='menu'){state.menu=!state.menu;render()}
  else if(a==='close-menu'){if(e.target===el){state.menu=false;render()}}
  else if(a==='reset'){state.modal={type:'reset'};render()}
  else if(a==='confirm-reset'){state=fresh(state.scenario);render()}
  else if(a==='tree-node'){if(e.target.matches('input'))return;const key=el.dataset.key,list=state.expanded[key]||[];state.expanded[key]=list.includes(id)?list.filter(x=>x!==id):[...list,id];state.selectedNode=id;if(key==='settings'){state.selectedSettingNode=id;state.settingPage=1}render()}

  else if(a==='change-detail'){id==='replace'?navigate('plan'):(state.modal={type:'change',id},render())}
  else if(a==='confirm-one'){const reason=changeReason(changes().find(x=>x.id===id));if(reason){id==='replace'?navigate('plan'):notify(reason);return}const count=confirmChange(id);notify(count>1?'替代及下级调整已确认并保存；迁移任务已创建':'变更已确认并保存，可在迁移记录查看')}
  else if(a==='confirm-replace'){const reason=changeReason({id:'replace'});if(reason)return notify(reason);confirmChange('replace');notify('替代及下级调整已确认并保存；迁移任务已创建')}
  else if(a==='reset-change'){state.search.change='';state.changePage=1;render()}
  else if(a==='query-change'){state.changePage=1;render()}
  else if(a==='include-children'){state.includeChildren=el.checked;state.settingPage=1;render()}
  else if(a==='toggle-terminal'){state.config[id].terminal=!state.config[id].terminal;state.settingsDirty=true;render()}
  else if(a==='save-settings'){state.settingsDirty=false;notify('机构配置已保存')}
  else if(a==='region'){state.modal={type:'region',id};render()}
  else if(a==='save-region'){state.config[state.modal.id].region=byId('region-input').value.trim();state.settingsDirty=true;state.modal=null;render()}
  else if(a==='device-query'){state.devicePage=1;render()}
  else if(a==='device-reset'){state.search.device='';state.devicePage=1;render()}
  else if(a==='new-device'){state.modal={type:'new-device'};render()}
  else if(a==='save-device'){const name=byId('new-name').value.trim(),code=byId('new-id').value.trim();if(!name||!code)return notify('请填写终端名称和标识码');if([...state.items,...state.newBusiness].some(i=>i.id===code))return notify('标识码已存在');state.newBusiness.push({id:code,kind:'device',name,actual:NEW,created:'新增业务'});state.modal=null;state.devicePage=1;notify('设备已新增')}
  else if(a==='view-device'||a==='edit-device'){state.modal={type:a,id};render()}
  else if(a==='save-edit-device'){const i=[...state.items,...state.newBusiness].find(x=>x.id===state.modal.id);i.name=byId('edit-name').value.trim()||i.name;state.modal=null;notify('已保存')}
  else if(a==='delete-device'){if(state.stage!=='draft'&&state.stage!=='done'&&state.items.some(i=>i.id===id))return notify('该数据正在进行机构调整，暂不可修改或删除。');state.modal={type:'delete-device',id};render()}
  else if(a==='confirm-delete'){const did=state.modal.id;state.newBusiness=state.newBusiness.filter(i=>i.id!==did);const item=state.items.find(i=>i.id===did);if(item)item.deleted=true;state.modal=null;notify('已删除')}
  else if(a==='close-modal'){state.modal=null;render()}
  else if(a==='reset-task-search'){state.search.task='';render()}
  else if(a==='query-task')render();
}
function onChange(e){const el=e.target;
  if(el.id==='scenario-select'){state=fresh(el.value);render();return}
  if(el.id==='candidate-select'){if(state.stage!=='draft'){render();return}state.candidate=el.value;render();return}
  if(el.dataset.choice){if(state.stage!=='draft'){render();return}state.choices[el.dataset.choice]=el.value;render();return}
  if(el.dataset.action==='tree-check'){const id=el.dataset.id;if(el.disabled||id!==EXTRA)return;state.checked4a=el.checked?[...new Set([...state.checked4a,id])]:state.checked4a.filter(x=>x!==id);render();return}
  if(el.dataset.action==='include-children'){state.includeChildren=el.checked;state.settingPage=1;render();return}
  if(el.dataset.action==='page-size'){state.pageSize=Number(el.value);state.settingPage=state.changePage=state.devicePage=state.itemPage=state.impactPage=1;render();return}
  if(el.dataset.setting){const c=state.config[el.dataset.id],field=el.dataset.setting;if(field==='type-user'||field==='type-device'){const parts=new Set(c.type.split('、').filter(Boolean)),v=field==='type-user'?'用户组织机构':'项目/设备单位';el.checked?parts.add(v):parts.delete(v);c.type=[...parts].join('、')}else c[field]=el.value;state.settingsDirty=true;render()}
}
function onInput(e){const el=e.target;if(!el.dataset.search)return;state.search[el.dataset.search]=el.value;state.settingPage=state.changePage=state.devicePage=1;const pos=el.selectionStart;render();const next=document.querySelector(`[data-search="${el.dataset.search}"]`);next?.focus();next?.setSelectionRange(pos,pos)}
document.addEventListener('click',onClick);
document.addEventListener('change',onChange);
document.addEventListener('input',onInput);
setInterval(tick,350);
function upgradeConfirmedState(){
  if(state.schema!==9)return;
  if(upgradeFromDraft){
    for(const id of ['rename','info'])if(state.confirmed[id])applyChange(id);
    if(state.confirmed.replace)applyChange('replace');
  }
  state.schema=10;
}
upgradeConfirmedState();
