/* Full snapshots are inputs; recommendations are produced locally, never supplied by 4A. */
const orgCompare = (() => {
  const normalize = value => String(value ?? '').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/　/g,' ').trim();
  function differences(oldNodes, newNodes) {
    const oldMap = new Map(oldNodes.map(n => [n.id, n]));
    const newMap = new Map(newNodes.map(n => [n.id, n]));
    return {
      added: newNodes.filter(n => !oldMap.has(n.id)),
      removed: oldNodes.filter(n => !newMap.has(n.id)),
      changed: newNodes.flatMap(n => {
        const old = oldMap.get(n.id);
        if (!old) return [];
        const fields = Object.keys(n).filter(k => k !== 'id' && old[k] !== n[k]);
        return fields.length ? [{old, next:n, fields}] : [];
      })
    };
  }
  function nameTier(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 3;
    if (a.includes(b) || b.includes(a)) return 2;
    // Only useful shared name text supports the illustrative partial-name tier.
    const generic = ['有限责任公司','有限公司','服务中心','供电服务中心','供电局','供电所','电网','公司','中心'];
    const useful = name => generic.reduce((s, word) => s.split(word).join(''), name);
    const left = useful(a), right = useful(b);
    for (let i=0; i<left.length-1; i++) if (right.includes(left.slice(i,i+2))) return 1;
    return 0;
  }
  function childMatch(oldNodes, newNodes, oldId, newId) {
    const left = oldNodes.filter(n => n.parent === oldId);
    const right = newNodes.filter(n => n.parent === newId);
    const usedLeft = new Set(), usedRight = new Set();
    for (const a of left) {
      const b = right.find(n => n.id === a.id);
      if (b) { usedLeft.add(a.id); usedRight.add(b.id); }
    }
    const remainingLeft = left.filter(n => !usedLeft.has(n.id));
    const remainingRight = right.filter(n => !usedRight.has(n.id));
    for (const a of remainingLeft) {
      const name = normalize(a.name);
      const sameLeft = remainingLeft.filter(n => normalize(n.name) === name);
      const sameRight = remainingRight.filter(n => normalize(n.name) === name);
      if (sameLeft.length === 1 && sameRight.length === 1) {
        usedLeft.add(a.id); usedRight.add(sameRight[0].id);
      }
    }
    const denominator = Math.max(left.length, right.length);
    return {matched:usedLeft.size, total:denominator, ratio:denominator ? usedLeft.size / denominator : null};
  }
  function candidates(oldNodes, newNodes, oldId, mappings={}) {
    const old = oldNodes.find(n => n.id === oldId);
    if (!old || newNodes.some(n => n.id === oldId)) return [];
    const parent = newNodes.some(n => n.id === old.parent) ? old.parent : mappings[old.parent];
    if (parent === undefined) return [];
    const taken = new Set(Object.entries(mappings).filter(([id]) => id !== oldId).map(([,id]) => id));
    return newNodes.filter(n => n.parent === parent && !taken.has(n.id));
  }
  function recommend(oldNodes, newNodes, oldId, mappings={}) {
    const old = oldNodes.find(n => n.id === oldId);
    const ranked = candidates(oldNodes,newNodes,oldId,mappings).map(n => ({node:n, tier:nameTier(old.name,n.name), ...childMatch(oldNodes,newNodes,oldId,n.id)}));
    const tier = Math.max(0,...ranked.map(n => n.tier));
    const same = ranked.filter(n => tier > 0 && n.tier === tier);
    if (same.length === 1 && tier >= 2) return same[0].node.id;
    const supported = same.filter(n => n.ratio !== null && n.ratio >= .5);
    const highest = Math.max(-1,...supported.map(n => n.ratio));
    const winners = supported.filter(n => n.ratio === highest);
    return winners.length === 1 ? winners[0].node.id : '';
  }
  return {normalize,differences,nameTier,childMatch,candidates,recommend};
})();
