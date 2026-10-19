chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyze-emotion-lens",
    title: "Analyze emotion in selected text",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "analyze-emotion-lens" || !info.selectionText) return;
  await chrome.storage.local.set({ pendingText: info.selectionText.slice(0, 5000) });
  // The user can click the extension icon to view the selected text and run analysis.
  // openPopup is available in recent Chrome versions; the stored text remains available if it fails.
  if (chrome.action.openPopup) {
    try { await chrome.action.openPopup(); } catch { /* User can open the popup manually. */ }
  }
});