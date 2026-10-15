import crypto from "crypto";
import { withUser, workerDb } from "@/lib/postgres";

const digest = (token) => crypto.createHash("sha256").update(token).digest();

export async function issueExtensionToken(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  await withUser(userId, (sql) => sql`
    insert into app.extension_credentials (user_id, token_hash, expires_at)
    values (${userId}, ${digest(token)}, now() + interval '30 days')
  `);
  return token;
}

export async function verifyExtensionToken(token) {
  if (!token || typeof token !== "string" || token.length > 128) return null;
  const [row] = await workerDb()`
    select user_id from app.extension_credentials
    where token_hash = ${digest(token)} and revoked_at is null and expires_at > now()
  `;
  return row?.user_id || null;
}

export async function revokeExtensionTokens(userId) {
  await withUser(userId, (sql) => sql`
    update app.extension_credentials set revoked_at = now()
    where user_id = ${userId} and revoked_at is null
  `);
}

// Sign-out path: revoke the credentials and stop reporting the extension as
// paired in one transaction, without loading the whole user state.
export async function unpairExtension(userId) {
  await withUser(userId, async (sql) => {
    await sql`
      update app.extension_credentials set revoked_at = now()
      where user_id = ${userId} and revoked_at is null
    `;
    await sql`
      delete from app.integrations
      where user_id = ${userId} and (
        provider = 'linkedinExt'
        or (provider = 'linkedin' and data->>'method' = 'extension' and coalesce(data->>'accountId', '') = '')
      )
    `;
  });
}
