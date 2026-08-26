// Gigaprowl LinkedIn Engine — background service worker.
// Every couple minutes: pull queued actions from Gigaprowl, hand each to a
// linkedin.com tab's content script to execute (human-paced), then report back.

const DEFAULT_BASE = "https://prowl-livid.vercel.app";

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("poll", { periodInMinutes: 2 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("poll", { periodInMinutes: 2 }));
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "poll") poll(); });

function cfg() {
  return new Promise((res) => chrome.storage.local.get(["base", "token"], res));
}

async function ensureLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  if (tabs.length) return tabs[0];
  const tab = await chrome.tabs.create({ url: "https://www.linkedin.com/feed/", active: false });
  // wait for it to finish loading so the content script is live
  await new Promise((res) => {
    const t = setInterval(async () => {
      const cur = await chrome.tabs.get(tab.id).catch(() => null);
      if (!cur || cur.status === "complete") { clearInterval(t); res(); }
    }, 1000);
    setTimeout(() => { clearInterval(t); res(); }, 15000);
  });
  return tab;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll() {
  const { base, token } = await cfg();
  if (!token) return;
  const B = base || DEFAULT_BASE;

  let data;
  try {
    const r = await fetch(`${B}/api/li/pull`, { headers: { "x-prowl-token": token } });
    data = await r.json();
  } catch { return; }
  const actions = (data && data.actions) || [];
  await chrome.storage.local.set({ lastPoll: Date.now(), lastPending: actions.length, remainingToday: data && data.remainingToday });
  if (!actions.length) return;

  // Human-hours gate: don't fire outreach at 3am. Pull still ran (keeps status
  // fresh); we just hold execution until a sane local window.
  const hr = new Date().getHours();
  if (hr < 8 || hr >= 20) { await chrome.storage.local.set({ heldOffHours: true }); return; }
  await chrome.storage.local.set({ heldOffHours: false });

  const tab = await ensureLinkedInTab();
  if (!tab) return;

  const results = [];
  for (const action of actions) {
    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { prowl: true, action });
    } catch (e) {
      res = { ok: false, error: `exec ${e.message || e}` };
    }
    results.push({ id: action.id, ok: !!(res && res.ok), error: res && res.error, did: res && res.did });
    // If LinkedIn wants a human check, stop immediately and flag re-login.
    if (res && res.checkpoint) { await chrome.storage.local.set({ checkpoint: true }); break; }
    await chrome.storage.local.set({ checkpoint: false });
    // human-ish spacing between actions (15–35s)
    await sleep(15000 + Math.random() * 20000);
  }

  try {
    await fetch(`${B}/api/li/ack`, { method: "POST", headers: { "x-prowl-token": token, "content-type": "application/json" }, body: JSON.stringify({ results }) });
  } catch {}
}

// let the popup trigger an immediate run
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg && msg.pollNow) { poll().then(() => sendResponse({ ok: true })); return true; }
});
