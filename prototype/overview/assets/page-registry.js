/* Future pages register here; index.html can load a page without ES modules. */
window.LinkMonitor = window.LinkMonitor || {};
window.LinkMonitor.pages = window.LinkMonitor.pages || {};
window.LinkMonitor.pageMeta = window.LinkMonitor.pageMeta || { overview:{ name:'链路监控总览', topology:'网级与边缘节点两层四区' } };
window.LinkMonitor.activePage = null;
window.LinkMonitor.registerPage = function (id, controller) { window.LinkMonitor.pages[id] = controller; };
window.LinkMonitor.mountPage = function (id, root) {
  if (window.LinkMonitor.activePage && window.LinkMonitor.pages[window.LinkMonitor.activePage].unmount) window.LinkMonitor.pages[window.LinkMonitor.activePage].unmount();
  const page = window.LinkMonitor.pages[id];
  if (!page || !page.mount) throw new Error(`Page not registered: ${id}`);
  page.mount(root || document.getElementById('app'));
  window.LinkMonitor.activePage = id;
};
window.LinkMonitor.unmountPage = function () {
  const page = window.LinkMonitor.pages[window.LinkMonitor.activePage];
  if (page && page.unmount) page.unmount();
  window.LinkMonitor.activePage = null;
};
