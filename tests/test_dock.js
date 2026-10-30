// Run with dock.js in a JS VM. Assertions cover reader-space reservation,
// closing, fullscreen, and navigation rather than CSS text.
function checkDock() {
  if (typeof dockLayout !== 'function') throw Error('dockLayout is not implemented');
  const same = (actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(JSON.stringify({actual, expected}));
  };
  same(dockLayout(true, false, false, 430), {docked:true, padding:446});
  same(dockLayout(true, false, false, 74), {docked:true, padding:90});
  same(dockLayout(false, false, false, 430), {docked:false, padding:0});
  same(dockLayout(true, true, false, 430), {docked:false, padding:0});
  same(dockLayout(true, false, true, 430), {docked:false, padding:0});
  same(dockLayout(true, false, false, NaN), {docked:true, padding:16});
  return 'Dock layout: 6 checks passed';
}
checkDock();
