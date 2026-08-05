const $ = (id) => document.getElementById(id);
const DEFAULT_BASE = "https://prowl-livid.vercel.app";

function render() {
  chrome.storage.local.get(["base", "token", "lastPoll", "lastPending", "remainingToday", "checkpoint", "heldOffHours"], (s) => {
    $("base").value = s.base || DEFAULT_BASE;
    $("token").value = s.token || "";
    const parts = [];
    if (s.checkpoint) parts.push('<span style="color:#ff6b6b">⚠ LinkedIn needs a re-login — open LinkedIn and sign in, then Run now.</span>');
    parts.push(s.token ? '<span class="ok">✓ paired</span>' : "not paired yet");
    if (s.heldOffHours) parts.push("paused: outside sending hours (8am–8pm)");
    if (s.lastPoll) parts.push(`last check: ${new Date(s.lastPoll).toLocaleTimeString()}`);
    if (typeof s.lastPending === "number") parts.push(`pending last pull: ${s.lastPending}`);
    if (typeof s.remainingToday === "number") parts.push(`invites left today: ${s.remainingToday}`);
    parts.push("Keep a LinkedIn tab open. Actions run from your own session, spaced out to stay safe.");
    $("status").innerHTML = parts.join("<br>");
  });
}

$("save").onclick = () => {
  const base = ($("base").value || DEFAULT_BASE).trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  chrome.storage.local.set({ base, token }, () => {
    chrome.alarms.create("poll", { periodInMinutes: 2 });
    chrome.runtime.sendMessage({ pollNow: true }, () => render());
    render();
  });
};

$("poll").onclick = () => chrome.runtime.sendMessage({ pollNow: true }, () => setTimeout(render, 1500));

render();
