window.LinkMonitor = window.LinkMonitor || {};
(function (LM) {
  const D=LM.data, byId=(items,id)=>items.find(item=>item.id===id);
  const severity={normal:0,unknown:1,abnormal:2};
  const worst=items=>items.reduce((value,item)=>severity[item?.status]>severity[value]?item.status:value,'normal');
  const ipFor=(node,index,offset)=>{
    const unitIndex=Math.max(1,D.units.findIndex(unit=>unit.id===node.unitId)+1);
    return `10.${unitIndex}.${(index%20)+10}.${20+offset}`;
  };

  D.nodes.forEach((node,index)=>{
    if(node.kind==='service'){
      const count=index%4===0?3:index%3===0?2:1,unknown=node.status==='unknown';
      node.metricKind='service';
      node.ipMetrics=Array.from({length:count},(_,offset)=>{
        const status=unknown?'unknown':(node.id==='net-iii'&&offset===1)||(node.status==='abnormal'&&offset===0)?'abnormal':'normal';
        return {ip:ipFor(node,index,offset),status,latencyMs:unknown?null:Number((7+(index%9)*1.8+offset*5.4).toFixed(1)),lossRate:unknown?null:Number(((index%4)*.04+offset*.11).toFixed(2))};
      });
      const valid=node.ipMetrics.filter(item=>item.status!=='unknown'&&item.latencyMs!=null);
      node.metricStatus=worst(node.ipMetrics);
      node.metrics=valid.length?{
        latency:valid.reduce((a,b)=>a.latencyMs>=b.latencyMs?a:b),
        loss:valid.reduce((a,b)=>a.lossRate>=b.lossRate?a:b)
      }:{latency:null,loss:null};
      return;
    }
    if(node.name.includes('防火墙')){
      node.metricKind='firewall';
      node.metricStatus=node.status==='unknown'?'unknown':'normal';
      node.metrics=node.metricStatus==='unknown'?{inMbps:null,outMbps:null,connections:null}:{inMbps:286.4+(index%5)*38.2,outMbps:241.8+(index%4)*31.7,connections:1260+(index%7)*143};
      return;
    }
    node.metricKind='isolation';
    const currentStatus=node.status==='unknown'?'unknown':node.status==='abnormal'?'abnormal':'normal';
    node.metrics={
      forward:{status:currentStatus,throughputMbps:currentStatus==='unknown'?null:94.6+(index%7)*15.8,lossRate:currentStatus==='unknown'?null:Number(((index%4)*.06).toFixed(2))},
      reverse:{status:currentStatus==='abnormal'?'normal':currentStatus,throughputMbps:currentStatus==='unknown'?null:71.2+(index%6)*12.4,lossRate:currentStatus==='unknown'?null:Number(((index%3)*.05).toFixed(2))}
    };
    node.metricStatus=worst([node.metrics.forward,node.metrics.reverse]);
  });

  D.paths.forEach((path,pathIndex)=>{
    const pathMetricStatus=['unknown','partialUnknown'].includes(path.status)?'unknown':pathIndex%13===0?'abnormal':'normal';
    path.metrics={status:pathMetricStatus,endToEndLatencyMs:pathMetricStatus==='unknown'?null:Number((42+(pathIndex%10)*7.3).toFixed(1))};
    path.edges.forEach((edgeId,edgeIndex)=>{
      const edge=byId(D.edges,edgeId);if(!edge)return;
      edge.metricsByPath=edge.metricsByPath||{};
      const status=edge.status==='unknown'?'unknown':edge.status==='abnormal'?'abnormal':(pathIndex+edgeIndex)%17===0?'abnormal':'normal';
      edge.metricsByPath[path.id]={status,direction:path.direction,segmentLatencyMs:status==='unknown'?null:Number((4.5+(edgeIndex%5)*2.7+(pathIndex%3)).toFixed(1)),lossRate:status==='unknown'?null:Number((((pathIndex+edgeIndex)%5)*.07).toFixed(2))};
    });
  });

  const ranges={
    '1h':{label:'近1小时',points:25,minutes:60,grain:'1分钟'},'6h':{label:'近6小时',points:37,minutes:360,grain:'5分钟'},
    '24h':{label:'近24小时',points:49,minutes:1440,grain:'15分钟'},'7d':{label:'近7天',points:57,minutes:10080,grain:'2小时'},
    '30d':{label:'近30天',points:61,minutes:43200,grain:'6小时'}
  };
  function trend(base,seed,range='1h',scale=.18,customHours=1){
    const spec=rangeSpec(range,customHours),start=Date.now()-spec.minutes*60000;
    return Array.from({length:spec.points},(_,index)=>{
      const gap=(index+seed)%23===0,status=gap?'unknown':(index+seed)%19===0?'abnormal':'normal';
      const wave=Math.sin((index+seed)*.48)*scale+Math.cos((index+seed)*.19)*scale*.45;
      return {time:start+index*(spec.minutes*60000/(spec.points-1)),value:gap?null:Math.max(0,Number((base*(1+wave)).toFixed(2))),status};
    });
  }
  function formatRate(mbps){if(mbps==null)return '— 未知';if(mbps<1)return `${Math.round(mbps*1000)} Kbps`;if(mbps>=1000)return `${(mbps/1000).toFixed(2)} Gbps`;return `${Number(mbps).toFixed(1)} Mbps`;}
  function statusText(status){return ({normal:'正常',abnormal:'异常',unknown:'未知'})[status]||'未知';}
  function rangeSpec(range,customHours){
    if(range!=='custom')return ranges[range]||ranges['1h'];
    const hours=Math.max(1,Math.min(720,customHours||1)),grain=hours<=6?'5分钟':hours<=24?'15分钟':hours<=168?'2小时':'6小时';
    return {label:'自定义',points:hours<=24?49:61,minutes:hours*60,grain};
  }
  LM.metrics={ranges,trend,formatRate,statusText,rangeSpec,worst};
}(window.LinkMonitor));
