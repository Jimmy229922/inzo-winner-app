// Deprecated legacy activity log file. Replaced by modern implementation in pages/activityLog.js.
// Keeping a lightweight shim to avoid function name collisions.
console.info('[LegacyActivityLog] legacy file loaded');
function renderActivityLogPage(){
  if (typeof window !== 'undefined' && typeof window.activityLogViewMode !== 'undefined') {
    // Modern script already loaded; do nothing (router uses the modern version because it redefines the function later)
  } else {
    console.warn('[LegacyActivityLog] Modern activity log script not yet loaded.');
  }
}