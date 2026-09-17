(function () {
  const LM=window.LinkMonitor, D=LM.data, U=LM.util;
  const $=id=>document.getElementById(id), byId=(xs,id)=>xs.find(x=>x.id===id);
  const state={
    units:new Set(D.defaultUnits),draft:new Set(D.defaultUnits),expanded:D.provinces[0].id,
    page:0,perPage:2,filters:{business:'',path:'',type:''},focusPath:null,selected:null,
    pathPanel:false,scale:1,drag:null,refreshed:U.time(),fullscreen:false
  };

  function activePaths(){
    return D.paths.filter(p=>p.published&&p.enabled&&state.units.has(p.unitId))
      .filter(p=>!state.filters.business||p.businessId===state.filters.business)
      .filter(p=>!state.filters.type||p.type===state.filters.type)
      .filter(p=>!state.filters.path||(`${p.name} ${p.id}`).toLowerCase().includes(state.filters.path.toLowerCase()));
  }
  function selectedUnitList(){return D.units.filter(u=>state.units.has(u.id));}
  function visibleUnits(){return selectedUnitList().slice(state.page*state.perPage,state.page*state.perPage+state.perPage);}
  function statusFor(path){return LM.model.pathStatus(path,D.nodes,D.edges);}
  function metricBadge(status){return `<span class="metric-badge ${status}">${LM.metrics.statusText(status)}</span>`;}
  function latencyText(metric){return metric?.endToEndLatencyMs==null?'— 未知':`${metric.endToEndLatencyMs.toFixed(1)} ms`;}
  function contextPath(kind,id){
    const paths=activePaths(),focused=state.focusPath&&byId(D.paths,state.focusPath),field=kind==='edge'?'edges':'nodes';
    if(focused&&focused[field]?.includes(id))return focused;
    return paths.find(path=>path[field]?.includes(id))||null;
  }
  function selectionPath(paths,selection=state.selected){
    if(!selection)return null;
    if(selection.kind==='path')return paths.find(path=>path.id===selection.id)||null;
    const field=selection.kind==='edge'?'edges':'nodes';
    return paths.find(path=>path[field].includes(selection.id))||null;
  }
  function reconcileSelection(message){
    const paths=activePaths(),selectedPath=selectionPath(paths);
    if(state.focusPath&&!paths.some(path=>path.id===state.focusPath))state.focusPath=null;
    const cleared=!!state.selected&&!selectedPath;
    if(cleared)state.selected=null;
    const contextPath=selectedPath||paths[0];
    if(contextPath){
      const index=selectedUnitList().findIndex(unit=>unit.id===contextPath.unitId);
      if(index>=0)state.page=Math.floor(index/state.perPage);
    }else state.page=0;
    if(cleared)toast(message);
    return !cleared;
  }

  function renderSelects(){
    const business=$('businessFilter'),type=$('typeFilter'),businessValue=state.filters.business,typeValue=state.filters.type;
    business.innerHTML='<option value="">全部业务对象</option>'+D.businessObjects.map(x=>`<option value="${x.id}">${U.escape(x.name)} · ${U.escape(x.code)}</option>`).join('');
    type.innerHTML='<option value="">全部类型</option>'+[...new Set(D.paths.map(p=>p.type))].map(x=>`<option value="${U.escape(x)}">${U.escape(x)}</option>`).join('');
    business.value=businessValue;type.value=typeValue;$('pathFilter').value=state.filters.path;
  }

  function renderUnitPicker(){
    const keyword=$('unitSearch').value.trim().toLowerCase();
    const provinces=D.provinces.filter(p=>!keyword||p.name.includes(keyword)||p.code.toLowerCase().includes(keyword)||p.cities.some(c=>c[1].includes(keyword)));
    $('provinceList').innerHTML=provinces.map(p=>`<div class="unit-option province-option ${state.expanded===p.id?'active':''}" data-province="${p.id}">
      <input type="checkbox" data-unit="${p.id}" ${state.draft.has(p.id)?'checked':''} aria-label="选择${U.escape(p.name)}省级节点">
      <span>${U.escape(p.name)}省级节点</span><button class="expand" data-expand="${p.id}" aria-label="展开${U.escape(p.name)}">›</button>
    </div>`).join('');
    const province=byId(D.provinces,state.expanded)||provinces[0];
    if(province&&state.expanded!==province.id)state.expanded=province.id;
    $('cityTitle').textContent=province?`${province.name} · 地市节点`:'地市节点';
    $('cityList').innerHTML=province?province.cities.filter(c=>!keyword||c[1].includes(keyword)||c[0].includes(keyword)).map(([id,name])=>`<label class="unit-option">
      <input type="checkbox" data-unit="${id}" ${state.draft.has(id)?'checked':''}><span>${U.escape(name)}地市节点</span>
    </label>`).join(''):'<div class="column-label">没有匹配单位</div>';
    $('draftCount').textContent=`已选 ${state.draft.size} 个`;
    document.querySelectorAll('#unitPopover [data-unit]').forEach(input=>input.onchange=e=>{e.stopPropagation();input.checked?state.draft.add(input.dataset.unit):state.draft.delete(input.dataset.unit);renderUnitPicker();});
    document.querySelectorAll('#unitPopover [data-expand]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();state.expanded=btn.dataset.expand;renderUnitPicker();});
    document.querySelectorAll('#unitPopover [data-province]').forEach(row=>row.onclick=e=>{e.stopPropagation();if(e.target.closest('input,button'))return;state.expanded=row.dataset.province;renderUnitPicker();});
  }

  function renderSelectedUnits(){
    const list=selectedUnitList();
    $('selectedUnits').innerHTML=list.map(u=>`<span class="unit-chip">${U.escape(u.name)}${u.level==='province'?'省级':'地市'}<button data-remove-unit="${u.id}" aria-label="移除${U.escape(u.name)}">×</button></span>`).join('')||'<span class="column-label">暂未选择单位</span>';
    $('selectionTotal').textContent=list.length?`共 ${list.length} 个边缘单位`:'';
    $('unitText').textContent=list.length===0?'选择单位':list.length===1?list[0].name:`已选择 ${list.length} 个单位`;
    document.querySelectorAll('[data-remove-unit]').forEach(btn=>btn.onclick=()=>{state.units.delete(btn.dataset.removeUnit);state.draft=new Set(state.units);state.page=0;reconcileSelection('所选对象不在当前单位范围内，已清除选择');render();});
  }

  function renderPathList(){
    const paths=activePaths(),list=$('pathList');
    $('pathCount').textContent=paths.length;$('visiblePathCount').textContent=paths.length;
    list.innerHTML=paths.map(p=>`<article class="path-item ${state.focusPath===p.id?'active':''}"><button class="path-select" data-path="${p.id}">
      <div class="path-name"><span>${U.escape(p.name)}</span>${U.badge(statusFor(p))}</div>
      <div class="path-code">${U.escape(p.id)}</div><div class="path-tags"><span class="mini-tag">${p.direction}</span><span class="mini-tag">${U.escape(p.type)}</span></div></button>
      <div class="path-metric-line"><span>整链时延 <strong>${latencyText(p.metrics)}</strong> ${metricBadge(p.metrics.status)}</span><button class="path-trend-link" data-path-trend="${p.id}">指标趋势</button></div></article>`).join('')||'<div class="empty-canvas" style="position:static;padding:40px 10px"><p>没有符合条件的业务链路</p></div>';
    list.querySelectorAll('[data-path]').forEach(btn=>btn.onclick=()=>{state.focusPath=btn.dataset.path;state.selected={kind:'path',id:btn.dataset.path};render();});
    list.querySelectorAll('[data-path-trend]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();LM.metricsUI.open(btn.dataset.pathTrend,'path');});
  }

  function roundedPolyline(points,radius=11){
    if(points.length<2)return'';let d=`M ${points[0].x} ${points[0].y}`;
    for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(radius,ab/2,bc/2);
      const p1={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab},p2={x:b.x+(c.x-b.x)*r/bc,y:b.y+(c.y-b.y)*r/bc};
      d+=` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
    }
    const z=points[points.length-1];return d+` L ${z.x} ${z.y}`;
  }
  function layoutFor(units){
    // 为节点与隔离装置之间的 Edge 作用标签预留完整空隙；多单位时允许横向滚动。
    const count=Math.max(1,units.length),gap=count===1?0:56,width=count===1?1560:1400;
    return {start:60,gap,width,zone:width/4,total:120+count*width+(count-1)*gap};
  }
  function unitPositions(unit,index,layout){
    const x=layout.start+index*(layout.width+layout.gap),z=layout.zone,k=unit.id;
    return {
      // 服务与分区隔离装置共用水平基线；同向链路只通过端口的微小上下偏移分离。
      [k+'-i']:{x:x+z*.5,y:740},[k+'-ii']:{x:x+z*1.5,y:740},[k+'-iii']:{x:x+z*2.5,y:740},[k+'-iv']:{x:x+z*3.5,y:740},
      [k+'-21']:{x:x+z,y:740},[k+'-32']:{x:x+z*2,y:740}
    };
  }
  function box(node){if(node.kind!=='device')return{w:140,h:52};return node.orientation==='vertical'?{w:56,h:92}:{w:142,h:46};}
  function port(p,node,side){const size=box(node);return side==='left'?{x:p.x-size.w/2,y:p.y}:side==='right'?{x:p.x+size.w/2,y:p.y}:side==='top'?{x:p.x,y:p.y-size.h/2}:{x:p.x,y:p.y+size.h/2};}
  function sidePort(p,node,side,offset=0){const point=port(p,node,side);if(side==='left'||side==='right')point.y+=offset;return point;}
  function verticalPort(p,node,side,offset=0){const point=port(p,node,side);point.x+=offset;return point;}
  function horizontalSide(from,to){return to.x>=from.x?'right':'left';}
  function orthogonal(points){return roundedPolyline(points.filter((p,i,all)=>!i||p.x!==all[i-1].x||p.y!==all[i-1].y),8);}
  function edgeGeometry(edge,pos,unitIndex){
    const source=byId(D.nodes,edge.source),target=byId(D.nodes,edge.target),a=pos[edge.source],b=pos[edge.target];if(!a||!b)return'';
    const isUp=edge.direction==='上行',offset=isUp?-11:11;
    // 网级服务、网级隔离装置及单位内节点均采用同一基线；上下行是两条平行直线，箭头贴在目标边框。
    if((source.unitId===target.unitId&&source.unitId!=='shared')||(source.unitId==='net'&&target.unitId==='net')){
      const fromSide=horizontalSide(a,b),toSide=horizontalSide(b,a);
      return orthogonal([sidePort(a,source,fromSide,offset),sidePort(b,target,toSide,offset)]);
    }
    // 网级与跨层装置：端点固定在上下边缘，路径严格为一条垂线；绝不横移再折返。
    if((edge.source==='net-iii'&&edge.target==='cross-3')||(edge.source==='cross-3'&&edge.target==='net-iii')){
      const offset=isUp?12:-10,sourceNet=source.unitId==='net';
      return orthogonal([verticalPort(a,source,sourceNet?'bottom':'top',offset),verticalPort(b,target,sourceNet?'top':'bottom',offset)]);
    }
    if((edge.source==='net-iv'&&edge.target==='cross-4')||(edge.source==='cross-4'&&edge.target==='net-iv')){
      const offset=isUp?12:-10,sourceNet=source.unitId==='net';
      return orthogonal([verticalPort(a,source,sourceNet?'bottom':'top',offset),verticalPort(b,target,sourceNet?'top':'bottom',offset)]);
    }
    // 共享设备至各单位服务：在单位框上方的专属支路走廊横向通行，再垂直落至业务节点顶部。
    // 每个单位及上下行各占一个 y 通道，任何跨单位分支都不会互相覆盖。
    const unit=visibleUnits()[unitIndex];
    if(unit&&((edge.source==='cross-4'&&edge.target===unit.id+'-iv')||(edge.source===unit.id+'-iv'&&edge.target==='cross-4')||(edge.source==='cross-3'&&edge.target===unit.id+'-iii')||(edge.source===unit.id+'-iii'&&edge.target==='cross-3'))){
      // 单位与方向各占一个独立端口，避免多条线在共享装置下方叠成一条。
      const sourceShared=source.unitId==='shared',targetShared=target.unitId==='shared',unitCount=visibleUnits().length,branchOffset=(unitIndex-(unitCount-1)/2)*44+(isUp?10:-10),unitOffset=isUp?10:-10;
      const from=verticalPort(a,source,sourceShared?'bottom':'top',sourceShared?branchOffset:unitOffset),to=verticalPort(b,target,targetShared?'bottom':'top',targetShared?branchOffset:unitOffset),cross4=edge.source==='cross-4'||edge.target==='cross-4',lane=386+unitIndex*48+(cross4?24:0)+(isUp?12:0);
      return orthogonal([from,{x:from.x,y:lane},{x:to.x,y:lane},to]);
    }
    return orthogonal([sidePort(a,source,horizontalSide(a,b),offset),sidePort(b,target,horizontalSide(b,a),offset)]);
  }

  function renderFrame(unit,index,layout){
    const x=layout.start+index*(layout.width+layout.gap),z=layout.zone,zones=[['一区',x],['二区',x+z],['三区',x+z*2],['四区',x+z*3]];
    return `<g><rect class="unit-frame" x="${x}" y="530" width="${layout.width}" height="320" rx="10"/><rect class="unit-header" x="${x}" y="530" width="${layout.width}" height="36" rx="10"/>
      <text class="tier-label" x="${x+18}" y="554">${U.escape(unit.name)} · ${unit.level==='province'?'省级边缘节点':'地市边缘节点'}</text>
      ${zones.map(([name,zoneX])=>`<rect class="zone-band" x="${zoneX}" y="566" width="${z}" height="284"/><text class="zone-label" x="${zoneX+14}" y="590">${name}</text>`).join('')}</g>`;
  }
  function renderNode(node,p){
    const size=box(node),status=node.status||'unknown',device=node.kind==='device',vertical=device&&node.orientation==='vertical';
    const title=vertical?U.escape(node.name).replace('双向隔离装置','双向&#10;隔离&#10;装置'):U.escape(node.name);
    return `<g class="${device?'device-node':''} ${vertical?'vertical-device':'service-node'} node-group ${state.selected?.kind==='node'&&state.selected.id===node.id?'is-active':''}" data-kind="node" data-id="${node.id}" tabindex="0" role="button">
      <rect x="${p.x-size.w/2}" y="${p.y-size.h/2}" width="${size.w}" height="${size.h}" rx="${device?8:7}"/>
      <circle class="node-state" fill="${status==='normal'?'#16a085':status==='abnormal'?'#f04438':'#98a2b3'}" cx="${p.x-size.w/2+14}" cy="${p.y-size.h/2+14}" r="5"/>
      ${node.metricStatus==='abnormal'?`<g class="metric-alert"><title>指标异常</title><circle cx="${p.x+size.w/2-7}" cy="${p.y-size.h/2+7}" r="8"/><text x="${p.x+size.w/2-7}" y="${p.y-size.h/2+10}" text-anchor="middle">!</text></g>`:''}
      <text class="node-title" x="${p.x}" y="${vertical?p.y-21:p.y-2}" text-anchor="middle">${vertical?title.split('&#10;').map((line,i)=>`<tspan x="${p.x}" dy="${i?15:0}">${line}</tspan>`).join(''):title}</text>
      <text class="node-sub" x="${p.x}" y="${vertical?p.y+31:p.y+17}" text-anchor="middle">${vertical?'安全边界':device?'安全边界设备':U.escape(node.stableId)}</text>
    </g>`;
  }

  function positionEdgeLabels(svg){
    svg.querySelectorAll('[data-edge-label-for]').forEach(label=>{
      const path=svg.querySelector(`#${label.dataset.edgeLabelFor}`),text=label.querySelector('text'),rect=label.querySelector('rect');if(!path||!text||!rect)return;
      const length=path.getTotalLength(),point=path.getPointAtLength(length/2),before=path.getPointAtLength(Math.max(0,length/2-3)),after=path.getPointAtLength(Math.min(length,length/2+3)),vertical=Math.abs(after.y-before.y)>Math.abs(after.x-before.x),up=label.dataset.direction==='up';
      // 纵向双线分别位于中心线两侧：上行线在右侧，标签同样向右；下行反之。
      const dx=vertical?(up?42:-42):0,dy=vertical?4:(up?-22:26);
      label.setAttribute('transform',`translate(${point.x+dx} ${point.y+dy})`);
      const bounds=text.getBBox(),padX=6,padY=3;
      rect.setAttribute('x',bounds.x-padX);rect.setAttribute('y',bounds.y-padY);rect.setAttribute('width',bounds.width+padX*2);rect.setAttribute('height',bounds.height+padY*2);
    });
  }

  function renderTopology(){
    const svg=$('topologySvg'),units=visibleUnits(),all=activePaths(),pageIds=new Set(units.map(u=>u.id)),paths=all.filter(p=>pageIds.has(p.unitId));
    const layout=layoutFor(units),height=900,naturalWidth=Math.max(1800,layout.total);svg.setAttribute('viewBox',`0 0 ${naturalWidth} ${height}`);svg.setAttribute('width',naturalWidth);svg.setAttribute('height',height);
    $('emptyCanvas').hidden=paths.length>0&&units.length>0;
    if(!units.length){$('emptyTitle').textContent='请选择查看单位';$('emptyText').textContent='可在上方单位条件中选择省级或地市节点。';svg.innerHTML='';return;}
    if(!paths.length){$('emptyTitle').textContent='没有符合条件的业务链路';$('emptyText').textContent='请调整业务对象、Path 名称或链路类型。';svg.innerHTML='';return;}
    const pos={'net-iii':{x:960,y:150},'net-iv':{x:1400,y:150},'net-34':{x:1180,y:150},'cross-3':{x:960,y:274},'cross-4':{x:1400,y:274}};
    units.forEach((u,i)=>Object.assign(pos,unitPositions(u,i,layout)));
    const nodeIds=new Set(),edgeIds=new Set();paths.forEach(p=>{p.nodes.forEach(id=>nodeIds.add(id));p.edges.forEach(id=>edgeIds.add(id));});
    const focus=state.focusPath?byId(D.paths,state.focusPath):null,focusEdges=new Set(focus?.edges||[]),focusNodes=new Set(focus?.nodes||[]);
    const marker=(id,color)=>`<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7.2" refY="4" orient="auto"><path d="M0.8,0.8 L7.2,4 L0.8,7.2 z" fill="${color}"/></marker>`;
    const defs=`<defs>${marker('arrow-down-normal','#1596b8')}${marker('arrow-up-normal','#7969ba')}${marker('arrow-down-abnormal','#f04438')}${marker('arrow-up-abnormal','#f04438')}${marker('arrow-down-unknown','#7f8b9d')}${marker('arrow-up-unknown','#7f8b9d')}</defs>`;
    const net=`<rect class="tier-frame" x="40" y="20" width="1520" height="190" rx="12"/><rect class="tier-header" x="40" y="20" width="1520" height="38" rx="12"/><text class="tier-label" x="62" y="45">网级</text>
      ${[['一区',40],['二区',420],['三区',800],['四区',1180]].map(([name,x])=>`<rect class="zone-band" x="${x}" y="58" width="380" height="152"/><text class="zone-label" x="${x+16}" y="82">${name}</text>`).join('')}
      <text class="empty-zone" x="230" y="142" text-anchor="middle">当前链路未涉及</text><text class="empty-zone" x="610" y="142" text-anchor="middle">当前链路未涉及</text>`;
    let edgeHtml='',nodeHtml='';
    [...edgeIds].forEach((id,index)=>{const edge=byId(D.edges,id),unitIndex=units.findIndex(u=>id.includes(u.id+'-'));const d=edgeGeometry(edge,pos,Math.max(0,unitIndex));if(!d)return;const active=!focus||focusEdges.has(id),selected=state.selected?.kind==='edge'&&state.selected.id===id,pathId=`edge-visual-${index}`;
      const direction=edge.direction==='上行'?'up':'down',status=edge.status||'normal';
      edgeHtml+=`<g class="edge-group ${selected?'is-active':''}" data-kind="edge" data-id="${id}" style="opacity:${active?1:.16}"><title>${U.escape(edge.action)} · ${U.statusLabel(status)} · ${edge.direction}</title>${selected?`<path class="edge-focus" d="${d}"/>`:''}<path class="edge-hit" d="${d}"/><path class="edge-casing" d="${d}"/><path id="${pathId}" class="edge-line edge-${direction} ${status}" d="${d}" marker-end="url(#arrow-${direction}-${status})"/><g class="edge-label-group edge-${direction} ${status}" data-edge-label-for="${pathId}" data-direction="${direction}"><rect rx="4"/><text class="edge-action-label edge-${direction} ${status}" x="0" y="0" text-anchor="middle">${direction==='up'?'↑':'↓'} ${U.escape(edge.action)}</text></g></g>`;
    });
    [...nodeIds].forEach(id=>{const node=byId(D.nodes,id),p=pos[id];if(!node||!p)return;const active=!focus||focusNodes.has(id);nodeHtml+=`<g style="opacity:${active?1:.18}">${renderNode(node,p)}</g>`;});
    const exchange=`<rect class="exchange-band" x="40" y="226" width="${naturalWidth-80}" height="96" rx="10"/><text class="exchange-label" x="62" y="252">跨层数据交换</text>`;
    const edgeTier=`<rect class="tier-frame edge" x="40" y="340" width="${naturalWidth-80}" height="530" rx="12"/><rect class="tier-header" x="40" y="340" width="${naturalWidth-80}" height="38" rx="12"/><text class="tier-label" x="62" y="365">边缘节点</text><text class="tier-meta" x="150" y="365">单位框上方为跨层链路专属通道</text>`;
    svg.innerHTML=defs+net+exchange+edgeTier+units.map((unit,index)=>renderFrame(unit,index,layout)).join('')+edgeHtml+nodeHtml;
    positionEdgeLabels(svg);
    applyScale();
  }

  function locateObject(kind,id,label){
    state.selected={kind,id};render();
    requestAnimationFrame(()=>{
      const svg=$('topologySvg'),wrap=$('canvasWrap'),item=svg.querySelector(`[data-kind="${kind}"][data-id="${id}"]`);if(!item)return;
      const bounds=item.getBBox(),left=(bounds.x+bounds.width/2)*state.scale-wrap.clientWidth/2,top=(bounds.y+bounds.height/2)*state.scale-wrap.clientHeight/2;
      wrap.scrollTo({left:Math.max(0,left),top:Math.max(0,top),behavior:'smooth'});
    });
    toast(`已定位：${label}`);
  }

  function renderDetail(){
    const panel=$('detailPanel'),box=$('detailContent'),s=state.selected;
    panel.hidden=!s;$('workspace').classList.toggle('has-detail',!!s);if(!s)return;
    const obj=byId(s.kind==='path'?D.paths:s.kind==='edge'?D.edges:D.nodes,s.id);
    if(!obj){panel.hidden=true;return;}
    const row=(key,value)=>`<div class="detail-row"><span class="detail-key">${key}</span><span>${value}</span></div>`, refs=(items)=>items.length?items.map(x=>`<span class="route-node">${U.escape(x)}</span>`).join(''):'—';
    const trendAction=(path,kind,id)=>path?`<button class="button primary metric-trend-entry" data-open-metrics="${path.id}" data-metric-kind="${kind}" data-metric-id="${id||''}">查看指标趋势</button>`:'';
    const locators=(items)=>items.length?`<div class="locator-list">${items.map(item=>`<button type="button" class="route-node locator-chip ${U.statusClass(item.status)}" data-locate-kind="${item.kind}" data-locate-id="${item.id}" data-locate-label="${U.escape(item.label)}"><span>${U.escape(item.label)}</span><span class="locator-action">定位</span></button>`).join('')}</div>`:'—';
    const history=(items)=>`<div class="history-context"><span>统计范围：近30天</span><span>时区：Asia/Shanghai</span></div><div class="history-note">历史状态按当前拓扑对象关联展示，不恢复历史拓扑结构。</div>${(items||[]).length?`<div class="history-list">${items.slice().reverse().map(item=>`<div class="history-item"><span class="history-dot ${U.statusClass(item.status)}"></span><div class="history-main"><div><span class="history-status ${U.statusClass(item.status)}">${U.statusLabel(item.status)}</span><span class="history-period"><time>${U.escape(item.start)}</time> ～ <time>${U.escape(item.end||'当前')}</time></span></div><div class="history-meta">持续 ${U.escape(item.duration)} · 来源：${U.escape(item.source)} · 原因：${U.escape(item.reason||'无补充说明')}</div></div></div>`).join('')}</div>`:'<div class="history-empty"><strong>暂无历史状态记录</strong><span>当前对象在近30天内没有可用的状态片段。</span></div>'}`;
    if(s.kind==='path'){
      const unit=byId(D.units,obj.unitId),business=byId(D.businessObjects,obj.businessId),members=obj.nodes.map(id=>byId(D.nodes,id)),edgeMembers=obj.edges.map(id=>byId(D.edges,id));
      const problemObjects=[...members.map(node=>({kind:'node',id:node.id,label:`Node · ${node.name}`,status:node.status})),...edgeMembers.map(edge=>({kind:'edge',id:edge.id,label:`Edge · ${edge.action}（${byId(D.nodes,edge.source).name} → ${byId(D.nodes,edge.target).name}）`,status:edge.status}))];
      const abnormal=problemObjects.filter(item=>item.status==='abnormal'),unknown=problemObjects.filter(item=>item.status==='unknown');
      box.innerHTML=`<div class="detail-title">${U.escape(obj.name)}</div><div class="detail-id">${obj.id}</div><div class="current-metric-card"><span>当前整链时延</span><strong>${latencyText(obj.metrics)}</strong>${metricBadge(obj.metrics.status)}</div>${trendAction(obj,'path','')}<div class="detail-section"><h3>链路信息</h3>${row('系统标识',U.escape(obj.id))}${row('单位',U.escape(unit.name))}${row('业务对象',U.escape(business.name))}${row('业务目标',U.escape(obj.businessTarget))}${row('业务范围',U.escape(obj.businessScope))}${row('方向 / 类型',`${obj.direction} · ${U.escape(obj.type)}`)}${row('发布 / 启用',`${obj.published?'已发布':'未发布'} · ${obj.enabled?'已启用':'已停用'}`)}${row('发布时间',obj.publishedAt)}${row('当前状态',U.badge(statusFor(obj)))}${row('状态来源',U.escape(obj.statusSource))}${row('更新时间',obj.updated)}</div><div class="detail-section"><h3>近30天状态历史</h3>${history(obj.history)}</div><div class="detail-section"><h3>完整 Node 路径</h3><div class="detail-route">${members.map((node,i)=>`${i?'<span>→</span>':''}<span class="route-node">${U.escape(node.name)}</span>`).join('')}</div></div><div class="detail-section"><h3>完整 Edge 路径</h3><div class="detail-route">${refs(edgeMembers.map(edge=>`${edge.id}：${byId(D.nodes,edge.source).name} → ${byId(D.nodes,edge.target).name}`))}</div></div><div class="detail-section"><h3>异常对象定位</h3>${row('异常',locators(abnormal))}${row('未知',locators(unknown))}</div>`;
    } else if(s.kind==='node'){
      const layer=obj.unitId==='net'?'网级':obj.unitId==='shared'?'跨层数据交换':`边缘节点 · ${byId(D.units,obj.unitId)?.name||'—'}`,partition=typeof obj.zone==='number'?`${obj.zone}区`:String(obj.zone),pathRefs=D.paths.filter(path=>state.units.has(path.unitId)&&path.nodes.includes(obj.id)),roles=pathRefs.map(path=>`${path.name}：${path.roles?.[obj.id]||'—'}`),path=contextPath('node',obj.id);
      let metrics='';
      if(obj.metricKind==='service'){
        const ipTitle=obj.ipMetrics.length>1?`${obj.ipMetrics[0].ip} + ${obj.ipMetrics.length-1}`:obj.ipMetrics[0].ip,lat=obj.metrics.latency,loss=obj.metrics.loss;
        metrics=`${row('IP 地址',U.escape(ipTitle))}${row('最差时延',lat?`${lat.latencyMs.toFixed(1)} ms · ${lat.ip}`:'— 未知')}${row('最大丢包率',loss?`${loss.lossRate.toFixed(2)}% · ${loss.ip}`:'— 未知')}<div class="ip-metric-list">${obj.ipMetrics.map(item=>`<div><code>${item.ip}</code><span>${item.latencyMs==null?'— 未知':`${item.latencyMs.toFixed(1)} ms`}</span><span>${item.lossRate==null?'— 未知':`${item.lossRate.toFixed(2)}%`}</span>${metricBadge(item.status)}</div>`).join('')}</div>`;
      }else if(obj.metricKind==='isolation'){
        const current=path?.direction==='上行'?'reverse':'forward',metricRow=(key,label)=>`<div class="direction-metric ${current===key?'current':''}"><b>${label}${current===key?' · 当前Path':''}</b><span>吞吐量 ${LM.metrics.formatRate(obj.metrics[key].throughputMbps)}</span><span>丢包率 ${obj.metrics[key].lossRate==null?'— 未知':`${obj.metrics[key].lossRate.toFixed(2)}%`}</span>${metricBadge(obj.metrics[key].status)}</div>`;
        metrics=metricRow('forward','正向')+metricRow('reverse','反向');
      }else{
        const flow=path?.direction==='上行'?'入向':'出向';metrics=`<div class="direction-metric current"><b>${flow} · 当前Path</b><span>入向吞吐量 ${LM.metrics.formatRate(obj.metrics.inMbps)}</span><span>出向吞吐量 ${LM.metrics.formatRate(obj.metrics.outMbps)}</span><span>当前总连接数 ${obj.metrics.connections==null?'— 未知':`${obj.metrics.connections} 个`}</span>${metricBadge(obj.metricStatus)}</div>`;
      }
      box.innerHTML=`<div class="detail-title">${U.escape(obj.name)}</div><div class="detail-id">${obj.stableId}</div><div class="detail-section metric-detail-section"><h3>当前指标</h3>${metrics}</div>${trendAction(path,'node',obj.id)}<div class="detail-section"><h3>对象信息</h3>${row('稳定标识',U.escape(obj.stableId))}${row('对象类型',U.escape(obj.type))}${row('层级 / 分区',`${U.escape(layer)} · ${U.escape(partition)}`)}${row('当前状态',U.badge(obj.status))}${row('状态来源',U.escape(obj.source))}${row('状态说明',U.escape(obj.statusReason||'—'))}${row('更新时间',obj.updated)}</div><div class="detail-section"><h3>近30天状态历史</h3>${history(obj.history)}</div><div class="detail-section"><h3>引用 Path / Role</h3><div class="detail-route">${refs(roles)}</div></div>`;
    } else {
      const a=byId(D.nodes,obj.source),b=byId(D.nodes,obj.target),pathObjects=D.paths.filter(path=>state.units.has(path.unitId)&&path.edges.includes(obj.id)),pathRefs=pathObjects.map(path=>path.name),path=contextPath('edge',obj.id),metric=path&&obj.metricsByPath?.[path.id];
      box.innerHTML=`<div class="detail-title">${U.escape(obj.action)}</div><div class="detail-id">${obj.id}</div><div class="detail-section metric-detail-section"><h3>当前指标${path?` · ${U.escape(path.name)}`:''}</h3>${row('分段时延',metric?.segmentLatencyMs==null?'— 未知':`${metric.segmentLatencyMs.toFixed(1)} ms`)}${row('丢包率',metric?.lossRate==null?'— 未知':`${metric.lossRate.toFixed(2)}%`)}${row('指标状态',metricBadge(metric?.status||'unknown'))}</div>${trendAction(path,'edge',obj.id)}<div class="detail-section"><h3>连接信息</h3>${row('系统标识',U.escape(obj.id))}${row('源节点',U.escape(a.name))}${row('目标节点',U.escape(b.name))}${row('方向',obj.direction)}${row('业务作用',U.escape(obj.businessEffect||obj.action))}${row('影响范围',U.escape(obj.impactScope||'—'))}${row('当前状态',U.badge(obj.status))}${row('状态来源',U.escape(obj.sourceName))}${row('状态说明',U.escape(obj.statusReason||'—'))}${row('更新时间',obj.updated)}</div><div class="detail-section"><h3>近30天状态历史</h3>${history(obj.history)}</div><div class="detail-section"><h3>引用 Path</h3><div class="detail-route">${refs(pathRefs)}</div></div>`;
    }
    box.querySelectorAll('[data-locate-kind]').forEach(button=>button.onclick=()=>locateObject(button.dataset.locateKind,button.dataset.locateId,button.dataset.locateLabel));
    box.querySelectorAll('[data-open-metrics]').forEach(button=>button.onclick=()=>LM.metricsUI.open(button.dataset.openMetrics,button.dataset.metricKind,button.dataset.metricId||null));
  }

  function applyScale(){const svg=$('topologySvg'),width=Number(svg.getAttribute('width')||1600);svg.style.width=`${width*state.scale}px`;svg.style.height=`${Number(svg.getAttribute('height')||710)*state.scale}px`;$('zoomLabel').textContent=`${Math.round(state.scale*100)}%`;}
  function render(){
    renderSelects();renderSelectedUnits();renderPathList();renderTopology();renderDetail();
    const units=selectedUnitList(),pages=Math.max(1,Math.ceil(units.length/state.perPage));if(state.page>=pages)state.page=pages-1;
    $('pageSummary').textContent=units.length?`第 ${state.page+1} / ${pages} 组 · 本组 ${visibleUnits().map(u=>u.name).join('、')}`:'';
    $('prevPage').disabled=state.page<=0;$('nextPage').disabled=state.page>=pages-1;
    $('resultSummary').textContent=`已显示 ${activePaths().length} 条启用 Path · 已选 ${units.length} 个单位`;
    $('lastRefresh').textContent=`刷新时间 ${state.refreshed}`;
    const focused=state.focusPath&&byId(D.paths,state.focusPath);$('focusHint').innerHTML=focused?`已聚焦 ${U.escape(focused.name)} · 整链时延 <b>${latencyText(focused.metrics)}</b> ${metricBadge(focused.metrics.status)}`:'网级与所选边缘单位 · 一至四区';
    $('pathPanel').hidden=!state.pathPanel||state.fullscreen;$('workspace').classList.toggle('has-paths',state.pathPanel&&!state.fullscreen);$('pathsBtn').setAttribute('aria-expanded',String(state.pathPanel));
  }

  function bind(){
    $('unitTrigger').onclick=()=>{const pop=$('unitPopover'),opening=pop.hidden;if(opening){state.draft=new Set(state.units);renderUnitPicker();}pop.hidden=!opening;$('unitTrigger').setAttribute('aria-expanded',String(opening));};
    // 级联面板内部的重绘不能被外部点击收起逻辑误判为离开面板。
    $('unitPopover').addEventListener('click',e=>e.stopPropagation());
    $('unitPopover').addEventListener('pointerdown',e=>e.stopPropagation());
    $('unitSearch').oninput=renderUnitPicker;
    $('clearUnits').onclick=()=>{state.draft.clear();renderUnitPicker();};
    $('cancelUnits').onclick=()=>{$('unitPopover').hidden=true;$('unitTrigger').setAttribute('aria-expanded','false');};
    $('applyUnits').onclick=()=>{state.units=new Set(state.draft);state.page=0;$('unitPopover').hidden=true;reconcileSelection('所选对象不在当前单位范围内，已清除选择');render();};
    $('queryBtn').onclick=()=>{state.filters={business:$('businessFilter').value,path:$('pathFilter').value.trim(),type:$('typeFilter').value};reconcileSelection('所选对象不在查询结果中，已清除选择');render();};
    $('resetBtn').onclick=()=>{state.filters={business:'',path:'',type:''};state.units=new Set(D.defaultUnits);state.draft=new Set(state.units);state.page=0;reconcileSelection('所选对象不在重置后的默认范围内，已清除选择');render();};
    $('prevPage').onclick=()=>{if(state.page>0){state.page--;state.focusPath=null;render();}};
    $('nextPage').onclick=()=>{if((state.page+1)*state.perPage<selectedUnitList().length){state.page++;state.focusPath=null;render();}};
    $('pathsBtn').onclick=()=>{state.pathPanel=!state.pathPanel;render();};$('closePaths').onclick=()=>{state.pathPanel=false;render();};
    $('closeDetail').onclick=()=>{state.selected=null;render();};$('clearFocusBtn').onclick=()=>{state.focusPath=null;state.selected=null;render();};
    $('refreshBtn').onclick=()=>{state.refreshed=U.time();render();toast('拓扑已刷新');};
    $('zoomInBtn').onclick=()=>{state.scale=Math.min(1.6,state.scale+.1);applyScale();};$('zoomOutBtn').onclick=()=>{state.scale=Math.max(.55,state.scale-.1);applyScale();};
    $('fitBtn').onclick=()=>{const svg=$('topologySvg');state.scale=Math.max(.55,Math.min(1,$('canvasWrap').clientWidth/Number(svg.getAttribute('width')||1600)));applyScale();$('canvasWrap').scrollTo(0,0);};
    $('fullscreenBtn').onclick=()=>{const card=$('topologyCard');if(document.fullscreenElement){document.exitFullscreen();}else if(card.requestFullscreen){card.requestFullscreen();}};
    document.addEventListener('fullscreenchange',()=>{state.fullscreen=!!document.fullscreenElement;const btn=$('fullscreenBtn');btn.setAttribute('aria-pressed',String(state.fullscreen));btn.setAttribute('aria-label',state.fullscreen?'退出全屏':'全屏显示');btn.textContent=state.fullscreen?'退出全屏':'全屏';render();setTimeout(()=>$('fitBtn').click(),0);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.fullscreenElement)document.exitFullscreen();});
    $('topologySvg').onclick=e=>{const item=e.target.closest('[data-kind]');if(!item)return;state.selected={kind:item.dataset.kind,id:item.dataset.id};render();};
    $('emptyAction').onclick=()=>{$('resetBtn').click();};
    $('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
    const wrap=$('canvasWrap');wrap.onpointerdown=e=>{if(e.target.closest('[data-kind]'))return;state.drag={x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};wrap.classList.add('dragging');wrap.setPointerCapture(e.pointerId);};
    wrap.onpointermove=e=>{if(!state.drag)return;wrap.scrollLeft=state.drag.left-(e.clientX-state.drag.x);wrap.scrollTop=state.drag.top-(e.clientY-state.drag.y);};
    wrap.onpointerup=()=>{state.drag=null;wrap.classList.remove('dragging');};wrap.onkeydown=e=>{const n=50;if(e.key==='Escape'){state.focusPath=null;state.selected=null;render();}if(e.key==='ArrowLeft')wrap.scrollLeft-=n;if(e.key==='ArrowRight')wrap.scrollLeft+=n;if(e.key==='ArrowUp')wrap.scrollTop-=n;if(e.key==='ArrowDown')wrap.scrollTop+=n;};
    document.addEventListener('click',e=>{if(!$('unitPopover').hidden&&!e.target.closest('.unit-field')){$('unitPopover').hidden=true;$('unitTrigger').setAttribute('aria-expanded','false');}});
  }
  let toastTimer;function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800);}
  function init(){
    const errors=LM.model.validateData(D);if(errors.length){$('noticeBar').hidden=false;$('noticeBar').textContent='拓扑数据存在不完整引用，部分内容暂不可展示。';}
    bind();render();
  }
  LM.registerPage('overview',{mount:init,unmount(){}});
  LM.mountPage('overview');
}());
