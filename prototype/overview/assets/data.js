window.LinkMonitor = window.LinkMonitor || {};
(function (LM) {
  const provinces = [
    {id:'gd',name:'广东',code:'GD',cities:[['gz','广州'],['sz','深圳'],['zh','珠海'],['fs','佛山'],['dg','东莞'],['hz','惠州']]},
    {id:'gx',name:'广西',code:'GX',cities:[['nn','南宁'],['lz','柳州'],['gl','桂林']]},
    {id:'yn',name:'云南',code:'YN',cities:[['km','昆明'],['qj','曲靖'],['dl','大理']]}
  ];
  const units = provinces.flatMap(p => [
    {id:p.id,name:p.name,code:p.code,level:'province',provinceId:p.id},
    ...p.cities.map(([id,name]) => ({id,name,code:id.toUpperCase(),level:'city',provinceId:p.id}))
  ]);
  const nodes = [], edges = [], paths = [], updated = '2026-09-16 10:24:36';
  const putNode = (id,name,unitId,zone,kind,status='normal',orientation='horizontal') => nodes.push({
    id,stableId:'RES-'+id.toUpperCase(),name,unitId,zone,kind,
    type:kind==='device'?'安全装置':'应用服务',status,orientation,
    source:status==='unknown'?'外部探针数据已过期':'外部探针',
    statusReason:status==='unknown'?'探针数据已过期':status==='abnormal'?'探针检测到关联服务异常':'探针检测正常',updated
  });
  const putEdge = (id,source,target,action,direction,status='normal') => {
    if (!edges.some(e => e.id===id)) edges.push({
      id,source,target,action,direction,status,sourceName:'链路探针',updated,
      businessEffect:action,impactScope:'引用该 Edge 的相关业务链路',
      statusReason:status==='unknown'?'探针数据已过期':status==='abnormal'?'关联节点检测异常':'探针检测正常'
    });
    return id;
  };
  const putPath = (unit,key,name,businessId,type,direction,route) => {
    const edgeIds = [];
    for (let i=0;i<route.length-1;i++) {
      const a=route[i], b=route[i+1], id='e-'+a+'__'+b;
      const status = nodes.find(n=>n.id===a)?.status==='abnormal'||nodes.find(n=>n.id===b)?.status==='abnormal'?'abnormal':
        nodes.find(n=>n.id===a)?.status==='unknown'||nodes.find(n=>n.id===b)?.status==='unknown'?'unknown':'normal';
      edgeIds.push(putEdge(id,a,b,direction==='上行'?'状态上送':'业务下发',direction,status));
    }
    paths.push({
      id:'PATH-'+unit.id.toUpperCase()+'-'+key,name:unit.name+' · '+name,unitId:unit.id,businessId,type,direction,
      businessTarget:name,businessScope:unit.name+'边缘节点',published:true,enabled:true,publishedAt:updated,enabledAt:updated,
      statusSource:'Path 状态聚合',updated,nodes:route,edges:edgeIds,
      roles:Object.fromEntries(route.map((id,index)=>{
        const node=nodes.find(item=>item.id===id);
        const role=index===0?'业务发起':index===route.length-1?'业务接收':node?.kind==='device'?'安全转发':'数据交换';
        return [id,role];
      }))
    });
  };

  putNode('net-iv','网级业务平台','net',4,'service');
  putNode('net-iii','网级数据交换服务','net',3,'service');
  // 同一安全分区边界只有一台双向隔离装置；上下行 Path 共用该资源。
  putNode('net-34','双向隔离装置','net','3↔4','device','normal','vertical');
  // 网级与所有边缘单位之间共用的跨层安全交换带设备；不按单位重复绘制。
  putNode('cross-3','三区双向隔离装置','shared','网级↔边缘三区','device');
  putNode('cross-4','四区跨层防火墙','shared','网级↔边缘四区','device');

  units.forEach((unit,index) => {
    const k=unit.id;
    putNode(k+'-iv',unit.name+'四区业务服务',k,4,'service');
    putNode(k+'-iii',unit.name+'三区交换服务',k,3,'service',k==='gx'?'unknown':'normal');
    putNode(k+'-ii',unit.name+'二区业务服务',k,2,'service');
    putNode(k+'-i',unit.name+'一区业务服务',k,1,'service',k==='gd'?'abnormal':'normal');
    putNode(k+'-32','双向隔离装置',k,'3↔2','device','normal','vertical');
    putNode(k+'-21','双向隔离装置',k,'2↔1','device','normal','vertical');

    putPath(unit,'IV','四区文件下发','file','文件链路','下行',['net-iv','cross-4',k+'-iv']);
    putPath(unit,'II','二区指令下行','command2','指令链路','下行',['net-iv','net-34','net-iii','cross-3',k+'-iii',k+'-32',k+'-ii']);
    putPath(unit,'I','一区指令下行','command1','指令链路','下行',['net-iv','net-34','net-iii','cross-3',k+'-iii',k+'-32',k+'-ii',k+'-21',k+'-i']);
    putPath(unit,'UP','状态上行','command1','状态链路','上行',[k+'-i',k+'-21',k+'-ii',k+'-32',k+'-iii','cross-3','net-iii','net-34','net-iv']);
  });

  // 近 30 天状态片段：末段始终是当前状态，供总览右侧详情直接使用。
  const statusText = {normal:'探针检测正常',abnormal:'探针检测到关联服务异常',unknown:'探针数据已过期',partialAbnormal:'部分成员异常',partialUnknown:'部分成员状态未知'};
  const makeHistory = (current, source, seed, states) => {
    const previous = states[seed % states.length], earlier = states[(seed + 1) % states.length];
    return [
      {status:earlier,start:'2026-08-18 08:00:00',end:'2026-08-29 09:20:00',duration:'11天1小时20分',source,reason:statusText[earlier]},
      {status:previous,start:'2026-08-29 09:20:00',end:'2026-09-10 00:00:00',duration:'11天14小时40分',source,reason:statusText[previous]},
      {status:current,start:'2026-09-10 00:00:00',end:null,duration:'6天10小时24分',source,reason:statusText[current]}
    ];
  };
  const aggregatePathStatus = path => {
    const members=[...path.nodes.map(id=>nodes.find(item=>item.id===id)),...path.edges.map(id=>edges.find(item=>item.id===id))];
    const states=members.map(item=>item?.status);
    if(states.every(status=>status==='normal'))return 'normal';
    if(states.every(status=>status==='abnormal'))return 'abnormal';
    if(states.every(status=>status==='unknown'))return 'unknown';
    return states.includes('abnormal')?'partialAbnormal':'partialUnknown';
  };
  nodes.forEach((node,index)=>node.history=makeHistory(node.status,node.source,index,['normal','abnormal','unknown']));
  edges.forEach((edge,index)=>edge.history=makeHistory(edge.status,edge.sourceName,index,['normal','abnormal','unknown']));
  paths.forEach((path,index)=>{
    path.status=aggregatePathStatus(path);
    path.history=makeHistory(path.status,path.statusSource,index,['normal','abnormal','unknown','partialAbnormal','partialUnknown']);
  });

  LM.data = {
    provinces,units,nodes,edges,paths,updated,
    businessObjects:[
      {id:'command1',name:'一区指令交互',code:'CMD-L1'},
      {id:'command2',name:'二区指令下发',code:'CMD-L2'},
      {id:'file',name:'四区文件分发',code:'FILE-L4'}
    ],
    defaultUnits:['gd','gx']
  };
}(window.LinkMonitor));
