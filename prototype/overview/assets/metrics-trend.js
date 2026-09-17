window.LinkMonitor = window.LinkMonitor || {};
(function (LM) {
  const D=LM.data,U=LM.util,M=LM.metrics,$=id=>document.getElementById(id),byId=(items,id)=>items.find(item=>item.id===id);
  const state={pathId:null,objectKey:'path',range:'1h',customHours:1,tab:'metrics',serviceIp:'aggregate',isolationDirection:'current',modes:{pathLatency:'default',latency:'default',throughput:'avg',connections:'avg'}};
  let charts=[];
  const esc=U.escape;
  const metricBadge=status=>`<span class="metric-badge ${status}">${M.statusText(status)}</span>`;
  const value=(number,unit,digits=1)=>number==null?'— 未知':`${Number(number).toFixed(digits)} ${unit}`;
  const currentPath=()=>byId(D.paths,state.pathId);
  const statusRank={normal:0,unknown:1,abnormal:2};
  const worstStatus=points=>points.reduce((result,item)=>statusRank[item.status]>statusRank[result]?item.status:result,'normal');
  const seedOf=value=>String(value).split('').reduce((sum,char)=>sum+char.charCodeAt(0),0);
  const series=(name,color,base,seed,unit,scale=.18)=>({name,color,unit,points:M.trend(base,seed,state.range,scale,state.customHours)});
  const maxSeries=(base,seed)=>base==null?0:base*1.28+(seed%5);
  const p95Series=(base,seed)=>base==null?0:base*1.16+(seed%3);
  function rangeSpec(){return M.rangeSpec(state.range,state.customHours);}

  function chartCard(title,unit,items,options={}){
    const index=charts.length,spec=rangeSpec();
    if(options.empty){return `<article class="metric-chart-card"><div class="chart-head"><div><h3>${esc(title)}</h3><p>${esc(unit)}</p></div></div><div class="metric-empty ${options.emptyKind||''}"><strong>${esc(options.empty)}</strong><span>${esc(options.emptyHint||'请切换对象或时间范围后重试。')}</span></div></article>`;}
    const width=820,height=190,left=42,right=16,top=18,bottom=30,valid=items.flatMap(item=>item.points.map(point=>point.value).filter(v=>v!=null)),max=Math.max(1,...valid)*1.15,min=0,x=i=>left+i*(width-left-right)/(spec.points-1),y=v=>top+(max-v)*(height-top-bottom)/(max-min);
    const bands=[];for(let i=0;i<spec.points;i++){const statuses=items.map(item=>item.points[i]?.status||'unknown'),status=statuses.sort((a,b)=>statusRank[b]-statusRank[a])[0];if(status!=='normal')bands.push(`<rect class="status-band ${status}" x="${x(i)-3}" y="${top}" width="${Math.max(6,(width-left-right)/(spec.points-1))}" height="${height-top-bottom}"/>`);}
    const seriesHtml=items.map((item,seriesIndex)=>{
      const segments=[];let current=[];item.points.forEach((point,i)=>{if(point.value==null){if(current.length){segments.push(current);current=[];}}else current.push(`${x(i)},${y(point.value)}`);});if(current.length)segments.push(current);
      const lines=segments.map(points=>`<polyline points="${points.join(' ')}"/>`).join('');
      const dots=item.points.map((point,i)=>point.value==null?'':`<circle class="${point.status}" cx="${x(i)}" cy="${y(point.value)}" r="${point.status==='normal'?2.2:3.2}"/>`).join('');
      return `<g class="chart-series" data-series-index="${seriesIndex}" style="--series:${item.color}">${lines}${dots}</g>`;
    }).join('');
    charts.push({title,unit,series:items,spec});
    const hasGap=items.some(item=>item.points.some(point=>point.value==null));
    return `<article class="metric-chart-card" data-chart-card="${index}"><div class="chart-head"><div><h3>${esc(title)}</h3><p>${esc(unit)}</p></div><div class="chart-modes">${options.modeKey?modeButtons(options.modeKey,options.mode||'default'):''}</div></div><div class="chart-legend">${items.map((item,i)=>`<button class="legend-toggle active" data-legend-series="${i}"><i style="background:${item.color}"></i>${esc(item.name)}</button>`).join('')}${hasGap?'<span class="gap-hint">断点：无数据</span>':''}<span class="status-hint"><i class="abnormal"></i>异常区间 <i class="unknown"></i>未知/无数据</span></div><div class="chart-stage"><svg class="metric-chart-svg" data-chart-index="${index}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><line class="axis-line" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/>${bands.join('')}${seriesHtml}<line class="chart-cursor" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}" hidden/><text class="axis-label" x="${left}" y="${height-8}">${timeLabel(items[0].points[0].time,spec)}</text><text class="axis-label" x="${width-right}" y="${height-8}" text-anchor="end">${timeLabel(items[0].points.at(-1).time,spec)}</text></svg><div class="chart-tooltip" hidden></div></div></article>`;
  }
  function timeLabel(timestamp,spec){const date=new Date(timestamp);return spec.minutes<=1440?date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}):`${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function modeButtons(key,mode){
    const configs={pathLatency:[['default','平均值 + P95'],['max','最大值']],latency:[['default','平均值 + P95'],['max','最大值']],throughput:[['avg','平均值'],['max','最大值']],connections:[['avg','平均值'],['max','最大值']]};
    return (configs[key]||[]).map(([value,label])=>`<button class="mode-button ${mode===value?'active':''}" data-mode-key="${key}" data-mode-value="${value}">${label}</button>`).join('');
  }
  function latencySeries(base,seed,mode=state.modes.latency){return mode==='max'?[series('最大值','#f59e0b',maxSeries(base,seed),seed+7,'ms',.22)]:[series('平均值','#1677ff',base,seed,'ms'),series('P95','#8b5cf6',p95Series(base,seed),seed+3,'ms',.2)];}
  function throughputSeries(baseItems,seed){return baseItems.map((item,index)=>series(`${item.name}·${state.modes.throughput==='max'?'最大值':'平均值'}`,item.color,state.modes.throughput==='max'?maxSeries(item.base,seed+index):item.base,seed+index*5,'Mbps',.21));}
  function lossSeries(base,seed,prefix=''){return [series(`${prefix}平均值`,'#10a37f',base,seed,'%',.2),series(`${prefix}最大值`,'#ef4444',maxSeries(base,seed),seed+5,'%',.28)];}

  function renderPathReference(){
    const path=currentPath(),metric=path.metrics,seed=seedOf(path.id),mode=state.modes.pathLatency;
    const summary=`<div><span class="metric-kicker">整链时延</span><strong>${value(metric.endToEndLatencyMs,'ms')}</strong>${metricBadge(metric.status)}<p>起点到终点端到端探测；不由分段时延相加。</p></div>`;
    charts=[];
    const chart=metric.endToEndLatencyMs==null?chartCard('整链时延','毫秒',[],{empty:'采集失败，当前区间无可用数据',emptyKind:'failed',emptyHint:'数据过期或中断后不延续旧值。'}):chartCard('整链时延','毫秒',latencySeries(metric.endToEndLatencyMs,seed,mode),{modeKey:'pathLatency',mode});
    $('pathMetricReference').innerHTML=`<div class="path-metric-summary">${summary}</div>${chart}`;
  }
  function objectOptions(path){
    return [`<option value="path">整条链路 · ${esc(path.name)}</option>`,...path.nodes.map(id=>{const node=byId(D.nodes,id);return `<option value="node:${id}">Node · ${esc(node.name)}</option>`;}),...path.edges.map(id=>{const edge=byId(D.edges,id),a=byId(D.nodes,edge.source),b=byId(D.nodes,edge.target);return `<option value="edge:${id}">Edge · ${esc(a.name)} → ${esc(b.name)}</option>`;})].join('');
  }
  function currentObject(){if(state.objectKey==='path')return{kind:'path',object:currentPath()};const [kind,id]=state.objectKey.split(':');return{kind,object:byId(kind==='node'?D.nodes:D.edges,id)};}
  function directionFor(path,node){const forward=path.direction==='下行';return node.metricKind==='firewall'?(forward?'出向':'入向'):(forward?'正向':'反向');}
  function renderDimensionControls(kind,obj,path){
    if(kind!=='node'){$('trendDimensionControls').innerHTML='';return;}
    if(obj.metricKind==='service'&&obj.ipMetrics.length>1){$('trendDimensionControls').innerHTML=`<label for="trendIpSelect">指标对象</label><select id="trendIpSelect"><option value="aggregate">逻辑节点聚合</option>${obj.ipMetrics.map(item=>`<option value="${item.ip}">${item.ip}</option>`).join('')}</select>`;$('trendIpSelect').value=state.serviceIp;return;}
    if(obj.metricKind==='isolation'){
      const current=path.direction==='下行'?'forward':'reverse',other=current==='forward'?'reverse':'forward';
      $('trendDimensionControls').innerHTML=`<span class="control-label">方向</span><div class="segment-control"><button data-isolation-direction="current" class="${state.isolationDirection==='current'?'active':''}">当前·${current==='forward'?'正向':'反向'}</button><button data-isolation-direction="other" class="${state.isolationDirection==='other'?'active':''}">另一方向·${other==='forward'?'正向':'反向'}</button><button data-isolation-direction="both" class="${state.isolationDirection==='both'?'active':''}">对比</button></div>`;return;
    }
    $('trendDimensionControls').innerHTML='';
  }
  function renderObjectTrend(){
    const path=currentPath(),{kind,object:obj}=currentObject(),seed=seedOf(obj.id||path.id);renderDimensionControls(kind,obj,path);
    if(kind==='path'){$('trendObjectContext').innerHTML=`<strong>${esc(path.name)}</strong><span>整链参照已固定显示在上方</span>`;$('objectTrendContent').innerHTML='<div class="metric-empty not-applicable"><strong>该对象不适用此指标</strong><span>请选择一个 Node 或 Edge 查看对象指标。</span></div>';return;}
    if(kind==='edge'){
      const metric=obj.metricsByPath?.[path.id],a=byId(D.nodes,obj.source),b=byId(D.nodes,obj.target);
      $('trendObjectContext').innerHTML=`<strong>${esc(a.name)} → ${esc(b.name)}</strong><span>${esc(path.direction)} · ${metricBadge(metric?.status||'unknown')}</span>`;
      if(!metric||metric.status==='unknown'){$('objectTrendContent').innerHTML=chartCard('分段时延','毫秒',[],{empty:'采集失败，当前区间无可用数据',emptyKind:'failed',emptyHint:'缺失区间不补零，也不延续旧值。'});return;}
      $('objectTrendContent').innerHTML=chartCard('分段时延','毫秒',latencySeries(metric.segmentLatencyMs,seed),{modeKey:'latency',mode:state.modes.latency})+chartCard('分段丢包率','%',lossSeries(metric.lossRate,seed+8));return;
    }
    $('trendObjectContext').innerHTML=`<strong>${esc(obj.name)}</strong><span>当前 Path：${esc(path.name)} · ${esc(directionFor(path,obj))}</span>`;
    if(obj.metricStatus==='unknown'){$('objectTrendContent').innerHTML=chartCard('对象指标','—',[],{empty:'采集失败，当前区间无可用数据',emptyKind:'failed',emptyHint:'当前对象指标已过期，显示未知。'});return;}
    if(obj.metricKind==='service'){
      const selected=state.serviceIp==='aggregate'?null:obj.ipMetrics.find(item=>item.ip===state.serviceIp),latency=selected?.latencyMs??obj.metrics.latency?.latencyMs,loss=selected?.lossRate??obj.metrics.loss?.lossRate,label=selected?selected.ip:'逻辑节点聚合';
      $('objectTrendContent').innerHTML=chartCard(`${label} · 时延`,'毫秒',latencySeries(latency,seed),{modeKey:'latency',mode:state.modes.latency})+chartCard(`${label} · 丢包率`,'%',lossSeries(loss,seed+9));return;
    }
    if(obj.metricKind==='isolation'){
      const current=path.direction==='下行'?'forward':'reverse',other=current==='forward'?'reverse':'forward',keys=state.isolationDirection==='both'?[current,other]:[state.isolationDirection==='current'?current:other],names={forward:'正向',reverse:'反向'};
      const rates=keys.map((key,index)=>({name:names[key],base:obj.metrics[key].throughputMbps,color:index?'#8b5cf6':'#1677ff'})),lossKeys=keys.flatMap((key,index)=>lossSeries(obj.metrics[key].lossRate,seed+index*7,`${names[key]}·`));
      $('objectTrendContent').innerHTML=chartCard('吞吐量','Mbps',throughputSeries(rates,seed),{modeKey:'throughput',mode:state.modes.throughput})+chartCard('丢包率','%',lossKeys);return;
    }
    const flow=path.direction==='下行'?'出向':'入向';
    $('objectTrendContent').innerHTML=chartCard(`吞吐量 · 当前Path${flow}`,'Mbps',throughputSeries([{name:'入向',base:obj.metrics.inMbps,color:'#8b5cf6'},{name:'出向',base:obj.metrics.outMbps,color:'#1677ff'}],seed),{modeKey:'throughput',mode:state.modes.throughput})+chartCard('当前总连接数','个',[series(state.modes.connections==='max'?'最大值':'平均值','#f59e0b',state.modes.connections==='max'?maxSeries(obj.metrics.connections,seed):obj.metrics.connections,seed+5,'个',.16)],{modeKey:'connections',mode:state.modes.connections});
  }
  function renderSummary(){
    const path=currentPath(),unit=byId(D.units,path.unitId),business=byId(D.businessObjects,path.businessId);
    $('trendSummaryPanel').innerHTML=`<section class="summary-grid"><article><span>业务对象</span><strong>${esc(business.name)}</strong></article><article><span>单位</span><strong>${esc(unit.name)}</strong></article><article><span>方向</span><strong>${esc(path.direction)}</strong></article><article><span>当前状态</span><strong>${U.badge(LM.model.pathStatus(path,D.nodes,D.edges))}</strong></article><article><span>整链时延</span><strong>${value(path.metrics.endToEndLatencyMs,'ms')}</strong></article></section><section class="summary-route"><h2>当前生效链路</h2><div>${path.nodes.map((id,index)=>`${index?'<span>→</span>':''}<b>${esc(byId(D.nodes,id).name)}</b>`).join('')}</div></section>`;
  }
  function bindCharts(){
    document.querySelectorAll('[data-legend-series]').forEach(button=>button.onclick=()=>{button.classList.toggle('active');const card=button.closest('[data-chart-card]'),seriesIndex=button.dataset.legendSeries,group=card.querySelector(`.chart-series[data-series-index="${seriesIndex}"]`);if(group)group.hidden=!button.classList.contains('active');});
    document.querySelectorAll('[data-mode-key]').forEach(button=>button.onclick=()=>{state.modes[button.dataset.modeKey]=button.dataset.modeValue;renderMetrics();});
    document.querySelectorAll('.metric-chart-svg').forEach(svg=>{
      svg.onmousemove=event=>{const rect=svg.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));document.querySelectorAll('.metric-chart-svg').forEach(other=>{const cursor=other.querySelector('.chart-cursor');cursor.hidden=false;const box=other.viewBox.baseVal;cursor.setAttribute('x1',box.width*ratio);cursor.setAttribute('x2',box.width*ratio);const chart=charts[Number(other.dataset.chartIndex)],index=Math.round(ratio*(chart.spec.points-1)),tooltip=other.parentElement.querySelector('.chart-tooltip'),point=chart.series[0].points[index];tooltip.hidden=false;tooltip.style.left=`${Math.min(78,Math.max(8,ratio*100))}%`;tooltip.innerHTML=`<strong>${new Date(point.time).toLocaleString('zh-CN',{hour12:false})}</strong>${chart.series.map(item=>{const p=item.points[index];return `<span><i style="background:${item.color}"></i>${esc(item.name)}：${p.value==null?'无数据':`${p.value} ${esc(chart.unit)}`} · ${M.statusText(p.status)}</span>`;}).join('')}`;});};
      svg.onmouseleave=()=>document.querySelectorAll('.metric-chart-svg').forEach(other=>{other.querySelector('.chart-cursor').hidden=true;other.parentElement.querySelector('.chart-tooltip').hidden=true;});
    });
  }
  function renderMetrics(){charts=[];const path=currentPath(),spec=rangeSpec();$('trendGrain').textContent=`实际粒度：${spec.grain}`;document.querySelectorAll('[data-range]').forEach(button=>button.classList.toggle('active',button.dataset.range===state.range));$('trendCustomRange').hidden=state.range!=='custom';$('trendObjectSelect').innerHTML=objectOptions(path);$('trendObjectSelect').value=state.objectKey;renderPathReference();renderObjectTrend();bindCharts();
    $('trendObjectSelect').onchange=()=>{state.objectKey=$('trendObjectSelect').value;state.serviceIp='aggregate';state.isolationDirection='current';renderMetrics();};
    const ip=$('trendIpSelect');if(ip)ip.onchange=()=>{state.serviceIp=ip.value;renderMetrics();};
    document.querySelectorAll('[data-isolation-direction]').forEach(button=>button.onclick=()=>{state.isolationDirection=button.dataset.isolationDirection;renderMetrics();});
  }
  function render(){
    const path=currentPath(),unit=byId(D.units,path.unitId);$('trendPathName').textContent=path.name;$('trendPathMeta').textContent=`${unit.name} · ${path.direction} · ${path.id}`;$('trendPathStatus').innerHTML=U.badge(LM.model.pathStatus(path,D.nodes,D.edges));
    $('trendSummaryPanel').hidden=state.tab!=='summary';$('trendMetricsPanel').hidden=state.tab!=='metrics';$('trendSummaryTab').classList.toggle('active',state.tab==='summary');$('trendMetricsTab').classList.toggle('active',state.tab==='metrics');renderSummary();if(state.tab==='metrics')renderMetrics();
  }
  function open(pathId,kind='path',id=null){
    const path=byId(D.paths,pathId);if(!path)return;state.pathId=pathId;state.objectKey=kind==='path'?'path':`${kind}:${id}`;state.range='1h';state.tab='metrics';state.serviceIp='aggregate';state.isolationDirection='current';$('app').hidden=true;$('trendView').hidden=false;window.scrollTo(0,0);render();
  }
  function close(){$('trendView').hidden=true;$('app').hidden=false;}
  function bind(){
    $('trendBackBtn').onclick=close;$('trendSummaryTab').onclick=()=>{state.tab='summary';render();};$('trendMetricsTab').onclick=()=>{state.tab='metrics';render();};
    document.querySelectorAll('[data-range]').forEach(button=>button.onclick=()=>{state.range=button.dataset.range;document.querySelectorAll('[data-range]').forEach(item=>item.classList.toggle('active',item===button));$('trendCustomRange').hidden=state.range!=='custom';if(state.range!=='custom')renderMetrics();});
    $('applyTrendRange').onclick=()=>{const start=new Date($('trendStart').value),end=new Date($('trendEnd').value),hours=(end-start)/36e5;if(!Number.isFinite(hours)||hours<=0){alert('请选择有效的开始和结束时间');return;}if(hours>720){$('objectTrendContent').innerHTML='<div class="metric-empty retention"><strong>所选时间超出30天保留期</strong><span>请将自定义范围调整为不超过30×24小时。</span></div>';return;}state.customHours=hours;renderMetrics();};
  }
  LM.metricsUI={open,close,bind};
  document.addEventListener('DOMContentLoaded',bind);
}(window.LinkMonitor));
