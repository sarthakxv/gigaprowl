// Runs inside the user's own linkedin.com tabs. Executes Gigaprowl's queued actions
// via LinkedIn's internal "Voyager" API using the page's own session + CSRF
// token. Requests originate from the user's real browser + IP.
//
// Relationship-aware: it checks the target's degree live and picks the valid
// path — DM a 1st-degree/Open-Profile person, otherwise send a connection
// request (with the note). On a security checkpoint it stops and reports back.
//
// NOTE: Voyager endpoints are undocumented and change. If actions start failing,
// resolveProfileId / getDistance / sendInvite / sendMessage are what to update.

function csrfToken() {
  const m = document.cookie.match(/JSESSIONID="?([^;"]+)"?/);
  return m ? m[1] : null;
}
const H = () => ({
  "csrf-token": csrfToken(),
  "accept": "application/vnd.linkedin.normalized+json+2.1",
  "x-restli-protocol-version": "2.0.0",
  "content-type": "application/json",
});

// LinkedIn returns 401/403 on an expired session and 999 when it wants a
// human check. Treat all as "needs re-login" so we pause instead of hammering.
function checkpoint(status) { return [401, 403, 999].includes(status); }

async function resolveProfileId(publicId) {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6`;
  const r = await fetch(url, { headers: H(), credentials: "include" });
  if (checkpoint(r.status)) throw new Error("CHECKPOINT");
  if (!r.ok) throw new Error(`resolve ${r.status}`);
  const d = await r.json();
  const el = d?.elements?.[0] || d?.data?.elements?.[0] || (d?.included || []).find((x) => x.entityUrn && /fsd_profile/.test(x.entityUrn));
  const id = (el?.entityUrn || "").split(":").pop().replace(/[()]/g, "").split(",")[0];
  if (!id) throw new Error("profile not found");
  return id;
}

// "DISTANCE_1" (connected) | "DISTANCE_2" | "DISTANCE_3" | "OUT_OF_NETWORK" | null
async function getDistance(publicId) {
  try {
    const r = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(publicId)}/networkinfo`, { headers: H(), credentials: "include" });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.data?.distance?.value || d?.distance?.value || null;
  } catch { return null; }
}

async function sendInvite(profileId, message) {
  const body = { invitee: { "com.linkedin.voyager.growth.invitation.InviteeProfile": { profileId } }, trackingId: btoa(String(Date.now())).slice(0, 16) };
  if (message) body.message = message.slice(0, 290);
  const r = await fetch("https://www.linkedin.com/voyager/api/growth/normInvitations", { method: "POST", headers: H(), credentials: "include", body: JSON.stringify(body) });
  if (checkpoint(r.status)) throw new Error("CHECKPOINT");
  if (r.status >= 200 && r.status < 300) return true;
  throw new Error(`invite ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

async function sendMessage(profileId, text) {
  const body = {
    keyVersion: "LEGACY_INBOX",
    conversationCreate: {
      eventCreate: { value: { "com.linkedin.voyager.messaging.create.MessageCreate": { body: text, attributedBody: { text, attributes: [] }, attachments: [] } } },
      recipients: [profileId], subtype: "MEMBER_TO_MEMBER",
    },
  };
  const r = await fetch("https://www.linkedin.com/voyager/api/messaging/conversations?action=create", { method: "POST", headers: H(), credentials: "include", body: JSON.stringify(body) });
  if (checkpoint(r.status)) throw new Error("CHECKPOINT");
  if (r.ok) return true;
  throw new Error(`message ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

// Decide the valid action from the live relationship, then execute.
async function run(action) {
  const profileId = await resolveProfileId(action.identifier);
  const dist = await getDistance(action.identifier);
  const connected = dist === "DISTANCE_1";

  if (connected) {                       // already connected → always DM
    await sendMessage(profileId, action.message);
    return { ok: true, did: "message" };
  }
  if (action.type === "invite") {        // not connected, invite requested
    await sendInvite(profileId, action.message);
    return { ok: true, did: "invite" };
  }
  // wanted a DM but not connected: try (works for Open Profile), else connect
  try {
    await sendMessage(profileId, action.message);
    return { ok: true, did: "message" };
  } catch (e) {
    if (String(e.message).includes("CHECKPOINT")) throw e;
    await sendInvite(profileId, action.message);
    return { ok: true, did: "invite_fallback" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.prowl || !msg.action) return;
  run(msg.action)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e), checkpoint: String(e.message || e).includes("CHECKPOINT") }));
  return true; // async response
});
