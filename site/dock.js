function dockLayout(articleVisible, expanded, fullscreen, measuredHeight) {
  const docked = articleVisible && !expanded && !fullscreen;
  const height = Number.isFinite(measuredHeight) ? Math.max(0, measuredHeight) : 0;
  return {docked, padding: docked ? Math.ceil(height) + 16 : 0};
}
