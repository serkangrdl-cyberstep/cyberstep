import { CYBERSTEP_API_BASE, CYBERSTEP_SCAN_URL, CACHE_TTL_MS } from "./config.js";

// ─── In-memory cache: domain → { data, timestamp } ───────────────────────────
const cache = new Map();

function isSkippableDomain(domain) {
  if (!domain) return true;
  const skip = ["localhost", "127.0.0.1", "::1", "newtab", "extensions", "devtools"];
  if (skip.some(s => domain.includes(s))) return true;
  if (domain.startsWith("chrome") || domain.startsWith("about") || domain.startsWith("moz-extension")) return true;
  if (!/[a-z0-9-]+\.[a-z]{2,}/.test(domain)) return true;
  return false;
}

async function fetchScore(domain) {
  const cached = cache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) return cached.data;

  try {
    const res = await fetch(`${CYBERSTEP_API_BASE}/api/public/domain-score/${domain}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(domain, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

function badgeColor(data) {
  if (!data || data.status === "not_scanned") return "#64748b";
  const s = data.score;
  if (s >= 80) return "#16a34a";
  if (s >= 60) return "#ca8a04";
  if (s >= 40) return "#ea580c";
  return "#dc2626";
}

async function updateTab(tabId, url) {
  if (!url) { chrome.action.setBadgeText({ text: "", tabId }); return; }
  try {
    const { hostname } = new URL(url);
    const domain = hostname.replace(/^www\./, "");
    if (isSkippableDomain(domain)) { chrome.action.setBadgeText({ text: "", tabId }); return; }

    const data = await fetchScore(domain);

    await chrome.action.setBadgeBackgroundColor({ color: badgeColor(data), tabId });

    if (!data || data.status === "not_scanned") {
      await chrome.action.setBadgeText({ text: "?", tabId });
    } else {
      await chrome.action.setBadgeText({ text: String(data.score), tabId });
    }

    // Store current tab info for popup
    await chrome.storage.session.set({ [`tab_${tabId}`]: { domain, data } });
  } catch {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") updateTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url) updateTab(tabId, tab.url);
});

// Refresh badge on install/startup
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true });
  for (const tab of tabs) if (tab.id && tab.url) updateTab(tab.id, tab.url);
});

chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true });
  for (const tab of tabs) if (tab.id && tab.url) updateTab(tab.id, tab.url);
});

// Message from popup: request refresh
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TAB_SCORE") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) { sendResponse(null); return; }
      try {
        const { hostname } = new URL(tab.url);
        const domain = hostname.replace(/^www\./, "");
        if (isSkippableDomain(domain)) { sendResponse({ domain, status: "system_page" }); return; }
        const data = await fetchScore(domain);
        sendResponse(data ?? { domain, status: "not_scanned" });
      } catch { sendResponse(null); }
    });
    return true; // async response
  }

  if (msg.type === "GET_SCAN_URL") {
    sendResponse(CYBERSTEP_SCAN_URL);
    return false;
  }
});
