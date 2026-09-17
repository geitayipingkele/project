/* Pure monitoring-domain logic: usable by real data adapters and Node-based tests. */
window.LinkMonitor = window.LinkMonitor || {};
window.LinkMonitor.model = {
  validateData(data) {
    const seen = new Map(), errors = [];
    data.nodes.forEach(node => {
      if (seen.has(node.stableId) && seen.get(node.stableId) !== node.id) errors.push(`重复稳定资源标识：${node.stableId}`);
      seen.set(node.stableId, node.id);
    });
    const nodeIds = new Set(data.nodes.map(node => node.id)), edgeIds = new Set(data.edges.map(edge => edge.id));
    data.edges.forEach(edge => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`Edge 端点不存在：${edge.id}`);
      const source=data.nodes.find(n=>n.id===edge.source), target=data.nodes.find(n=>n.id===edge.target);
      if (source && target && (source.unitId!==target.unitId || source.zone!==target.zone) && source.kind!=='device' && target.kind!=='device') errors.push(`跨区或跨层链路未经过安全设备：${edge.id}`);
      if (source && target && source.unitId!==target.unitId && source.unitId!=='shared' && target.unitId!=='shared') errors.push(`跨层边未经过共享安全交换装置：${edge.id}`);
    });
    data.paths.forEach(path => {
      if (path.nodes.some(id => !nodeIds.has(id)) || path.edges.some(id => !edgeIds.has(id))) errors.push(`Path 引用不存在：${path.id}`);
      const spansNetAndEdge=path.nodes.some(id=>data.nodes.find(n=>n.id===id)?.unitId==='net')&&path.nodes.some(id=>data.nodes.find(n=>n.id===id)?.unitId===path.unitId);
      if(spansNetAndEdge&&!path.nodes.some(id=>data.nodes.find(n=>n.id===id)?.unitId==='shared')) errors.push(`跨层 Path 未经过共享安全交换装置：${path.id}`);
    });
    data.nodes.filter(node=>node.unitId==='shared'&&node.kind==='device').forEach(gateway=>{
      if(!data.paths.some(path=>path.nodes.includes(gateway.id))) errors.push(`共享安全交换装置未被 Path 引用：${gateway.id}`);
    });
    data.nodes.filter(node=>/-cross[34]$/.test(node.id)).forEach(node=>errors.push(`不应保留按单位绘制的跨层装置：${node.id}`));
    data.nodes.filter(node => node.kind==='device' && node.name==='双向隔离装置').forEach(device => {
      const directions=new Set(data.paths.filter(path => path.nodes.includes(device.id)).map(path => path.direction));
      if (!directions.has('下行') || !directions.has('上行')) errors.push(`双向隔离装置未被上下行 Path 共享：${device.id}`);
    });
    const historyCheck=(object,current,label)=>{
      const history=object.history;
      if(!Array.isArray(history)||!history.length){errors.push(`${label} 缺少状态历史：${object.id}`);return;}
      history.forEach((item,index)=>{
        if(!item.status||!item.start||!item.duration||!item.source||!item.reason)errors.push(`${label} 状态历史字段不完整：${object.id}#${index+1}`);
      });
      if(history[history.length-1].status!==current)errors.push(`${label} 当前状态与历史末段不一致：${object.id}`);
    };
    data.nodes.forEach(node=>historyCheck(node,node.status,'Node'));
    data.edges.forEach(edge=>historyCheck(edge,edge.status,'Edge'));
    data.paths.forEach(path=>historyCheck(path,this.pathStatus(path,data.nodes,data.edges),'Path'));
    return errors;
  },
  unitLabel(data, path) {
    const unit = data.units.find(item => item.id === path.unitId);
    return unit ? unit.name : '—';
  },
  pathStatus(path, nodes, edges) {
    const find = (items, id) => items.find(item => item.id === id);
    const objects = [...path.nodes.map(id => find(nodes,id)), ...path.edges.map(id => find(edges,id))];
    if (!objects.length) return null;
    if (objects.some(item => !item)) return 'unknown';
    const statuses = objects.map(item => item.status);
    if (statuses.every(status => status === 'normal')) return 'normal';
    if (statuses.every(status => status === 'abnormal')) return 'abnormal';
    if (statuses.every(status => status === 'unknown')) return 'unknown';
    if (statuses.includes('abnormal')) return 'partialAbnormal';
    return 'partialUnknown';
  }
};
