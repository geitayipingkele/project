/* Shared primitives for P01 and future registered pages. */
window.LinkMonitor = window.LinkMonitor || {};
window.LinkMonitor.util = {
  escape(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); },
  time() { return new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date()); },
  statusLabel(status) { return ({ normal:'正常', abnormal:'异常', unknown:'未知', partialAbnormal:'部分异常', partialUnknown:'部分未知' })[status] || '—'; },
  statusClass(status) { return status || 'unknown'; },
  badge(status) { return `<span class="status-badge ${this.statusClass(status)}">${this.statusLabel(status)}</span>`; }
  ,selectedValues(control) { return control ? [...control.selectedOptions].map(option=>option.value).filter(Boolean) : []; }
  ,roundedOrthogonal(from, to, lane) {
    const bend = lane || 0, mx=(from.x+to.x)/2+bend, r=10, dirX=Math.sign(mx-from.x)||1, dirY=Math.sign(to.y-from.y)||1, dirX2=Math.sign(to.x-mx)||1;
    return { path:`M ${from.x} ${from.y} H ${mx-dirX*r} Q ${mx} ${from.y} ${mx} ${from.y+dirY*r} V ${to.y-dirY*r} Q ${mx} ${to.y} ${mx+dirX2*r} ${to.y} H ${to.x}`, mid:{x:mx,y:(from.y+to.y)/2} };
  }
};
