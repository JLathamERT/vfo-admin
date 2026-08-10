// data.js — public specialist data for the /store bookstore page.
// Plain browser ES module: no build step, no dependencies.
// Fetch shape and the three visibility filters mirror the public embeddable
// widget (widget/vfo-widget.js) and gotchas #201 / #231 — do not relax them.

const SUPABASE_URL = 'https://ejpsprsmhpufwogbmxjv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHNwcnNtaHB1ZndvZ2JteGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDcwNjksImV4cCI6MjA4NzYyMzA2OX0.sdMVsnXePSH8zgstt82O1dhpMxYZq5QivyIrCHMbECU';

const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/';
const HEADSHOT_FALLBACK = 'https://biz-diagnostic.com/img/expert/';
const REQUEST_TIMEOUT_MS = 15000;
const INTERNAL_ECOSYSTEM = 'Member Services';

const EXPERTS_PATH =
  '/rest/v1/experts?select=id,name,short_bio,long_bio,headshot_image,status,sort_order,vfo_accredited' +
  '&order=sort_order.asc,name.asc';
const ASSIGNMENTS_PATH = '/rest/v1/vfo_ecosystem_assignments?select=expert_id,name';

export const ECOSYSTEMS = [
  'Tax Planning',
  'Business Advisory',
  'Legal Services',
  'Risk Mitigation',
  'Wealth Management'
];

export const ECO_COLORS = {
  'Tax Planning': '#0b4bad',
  'Business Advisory': '#c96a2e',
  'Legal Services': '#2f6b4f',
  'Risk Mitigation': '#8a3033',
  'Wealth Management': '#5b4a8f'
};

async function fetchRows(path, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(SUPABASE_URL + path, {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      signal: controller.signal
    });
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'timed out' : 'could not be reached';
    throw new Error(`The specialist directory ${reason} while loading ${label}. Please check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`The specialist directory returned an error (${response.status}) while loading ${label}. Please try again.`);
  }

  let rows;
  try {
    rows = await response.json();
  } catch (err) {
    throw new Error(`The specialist directory sent an unreadable response while loading ${label}. Please try again.`);
  }
  if (!Array.isArray(rows)) {
    throw new Error(`The specialist directory sent unexpected data while loading ${label}. Please try again.`);
  }
  return rows;
}

function buildEcoMap(assignments) {
  const sets = {};
  for (const row of assignments) {
    if (!row || row.expert_id == null || !row.name) continue;
    if (!sets[row.expert_id]) sets[row.expert_id] = new Set();
    sets[row.expert_id].add(row.name);
  }
  const ecoMap = {};
  for (const [expertId, names] of Object.entries(sets)) ecoMap[expertId] = [...names];
  return ecoMap;
}

function toSpecialist(expert, categories) {
  return {
    id: expert.id,
    name: expert.name,
    shortBio: expert.short_bio || '',
    longBio: expert.long_bio || '',
    headshotUrl: expert.headshot_image ? HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image) : null,
    headshotFallback: expert.headshot_image ? HEADSHOT_FALLBACK + expert.headshot_image : null,
    categories
  };
}

export async function loadSpecialists() {
  const [experts, assignments] = await Promise.all([
    fetchRows(EXPERTS_PATH, 'specialists'),
    fetchRows(ASSIGNMENTS_PATH, 'ecosystem assignments')
  ]);

  const ecoMap = buildEcoMap(assignments);

  const specialists = experts
    .filter((ex) => (ex.status || 'Active') === 'Active')
    .filter((ex) => !(ecoMap[ex.id] || []).includes(INTERNAL_ECOSYSTEM))
    .filter((ex) => !ex.vfo_accredited)
    .map((ex) => toSpecialist(ex, (ecoMap[ex.id] || []).filter((name) => ECOSYSTEMS.includes(name))))
    .filter((specialist) => specialist.categories.length > 0);

  const byEcosystem = {};
  for (const ecosystem of ECOSYSTEMS) byEcosystem[ecosystem] = [];
  for (const specialist of specialists) {
    for (const ecosystem of specialist.categories) byEcosystem[ecosystem].push(specialist);
  }

  return { specialists, byEcosystem };
}
