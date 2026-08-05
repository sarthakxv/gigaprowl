// Contact discovery via Apollo.io. Finds likely hiring managers for a role at a company.
import { findEmail, verifyEmail, leadmagicEnabled } from "@/lib/leadmagic";

// Fill missing emails via LeadMagic (and verify the ones we already have) so the
// Gmail outreach step has a deliverable target. Runs in parallel, best-effort.
async function enrichEmails(contacts, job) {
  if (!leadmagicEnabled() || !contacts?.length) return contacts;
  const domain = job.companyDomain || null;
  return Promise.all(
    contacts.map(async (c) => {
      try {
        if (!c.email) {
          const hit = await findEmail({ firstName: c.firstName, lastName: c.lastName, company: c.company, domain });
          if (hit?.email) return { ...c, email: hit.email, emailStatus: hit.status, emailSource: "leadmagic" };
        } else {
          const v = await verifyEmail(c.email);
          if (v) return { ...c, emailStatus: v.status };
        }
      } catch {}
      return c;
    })
  );
}

function managerTitlesFor(jobTitle) {
  const t = jobTitle.toLowerCase();
  if (/data|ml|machine learning|ai/.test(t)) return ["Head of Data", "Director of Data Science", "VP of AI", "Engineering Manager"];
  if (/product manager|product owner/.test(t)) return ["VP of Product", "Head of Product", "Director of Product"];
  if (/design/.test(t)) return ["Head of Design", "Design Director", "VP of Design"];
  if (/devops|sre|infra|platform/.test(t)) return ["Head of Infrastructure", "Director of Platform Engineering", "VP of Engineering"];
  if (/security/.test(t)) return ["CISO", "Head of Security", "Director of Security Engineering"];
  return ["Engineering Manager", "Director of Engineering", "VP of Engineering", "Head of Engineering", "CTO"];
}

function demoContacts(job, titles, note) {
  return titles.slice(0, 2).map((title, i) => ({
    id: `demo_${job.sourceId}_${i}`,
    firstName: ["Alex", "Jordan"][i], lastName: ["Rivera", "Chen"][i],
    name: ["Alex Rivera", "Jordan Chen"][i], title,
    company: job.company, email: null, linkedinUrl: null,
    confidence: note,
  }));
}

export async function findContacts(job) {
  const key = process.env.APOLLO_API_KEY;
  const titles = managerTitlesFor(job.title);

  if (!key) return enrichEmails(demoContacts(job, titles, "demo — add APOLLO_API_KEY for real contacts"), job);

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify({
      q_organization_name: job.company,
      person_titles: titles,
      page: 1, per_page: 5,
    }),
  });
  if (!res.ok) {
    // 403 = plan lacks People Search API access; degrade instead of failing the hunt.
    console.error(`Apollo ${res.status} — falling back to demo contacts`);
    return enrichEmails(demoContacts(job, titles, `demo — Apollo key returned ${res.status} (People Search API needs a paid Apollo plan)`), job);
  }
  const data = await res.json();
  const people = (data.people || []).map((p) => ({
    id: p.id,
    firstName: p.first_name, lastName: p.last_name, name: p.name,
    title: p.title, company: p.organization?.name || job.company,
    email: p.email && p.email !== "email_not_unlocked@domain.com" ? p.email : null,
    linkedinUrl: p.linkedin_url || null,
    confidence: "apollo",
  }));
  return people.length
    ? enrichEmails(people, job)
    : enrichEmails(demoContacts(job, titles, "demo — Apollo found no contacts at this company"), job);
}
