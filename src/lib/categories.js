/**
 * Official Teer Competition Categories Definition & Database Sync
 * Canonical source of truth for TeerResult2
 */

export const OFFICIAL_CATEGORIES = [
  {
    id: 'cat_shillong_teer',
    name: 'Shillong Teer',
    slug: 'shillong-teer',
    location: 'Polo Grounds, Shillong, Meghalaya',
    round1Time: '03:45 PM',
    round2Time: '04:45 PM',
    description: 'Official Khasi Hills Archery Sports Association daily competition results.',
    order: 1,
    isActive: true,
  },
  {
    id: 'cat_khanapara_teer',
    name: 'Khanapara Teer',
    slug: 'khanapara-teer',
    location: 'Ri-Bhoi District, Assam/Meghalaya Border',
    round1Time: '04:10 PM',
    round2Time: '04:45 PM',
    description: 'Daily Guwahati / Khanapara traditional archery outcome.',
    order: 2,
    isActive: true,
  },
  {
    id: 'cat_juwai_teer',
    name: 'Juwai Teer',
    slug: 'juwai-teer',
    location: 'Jowai, West Jaintia Hills, Meghalaya',
    round1Time: '02:05 PM',
    round2Time: '02:45 PM',
    description: 'West Jaintia Hills afternoon archery session results.',
    order: 3,
    isActive: true,
  },
  {
    id: 'cat_shillong_night_teer',
    name: 'Shillong Night Teer',
    slug: 'shillong-night-teer',
    location: 'Polo Grounds / Authorized Club (Night Session)',
    round1Time: '10:15 PM',
    round2Time: '11:15 PM',
    description: 'Night edition archery session outcome in Meghalaya.',
    order: 4,
    isActive: true,
  },
];

/**
 * Ensures all four official competition categories exist in the database.
 * Uses slug uniqueness to update or insert without creating duplicates.
 * Preserves existing database IDs.
 */
export async function ensureOfficialCategories(client) {
  if (!client || !client.gameCategory) return OFFICIAL_CATEGORIES;

  const synced = [];
  for (const cat of OFFICIAL_CATEGORIES) {
    try {
      const existing = await client.gameCategory.findUnique({
        where: { slug: cat.slug },
      });

      if (existing) {
        const updated = await client.gameCategory.update({
          where: { id: existing.id },
          data: {
            name: cat.name,
            location: cat.location,
            round1Time: cat.round1Time,
            round2Time: cat.round2Time,
            description: cat.description,
            order: cat.order,
            isActive: true,
          },
        });
        synced.push(updated);
      } else {
        const created = await client.gameCategory.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            location: cat.location,
            round1Time: cat.round1Time,
            round2Time: cat.round2Time,
            description: cat.description,
            order: cat.order,
            isActive: true,
          },
        });
        synced.push(created);
      }
    } catch (err) {
      console.warn(`[ensureOfficialCategories] Error syncing ${cat.slug}:`, err.message || err);
    }
  }

  return synced.length > 0 ? synced : OFFICIAL_CATEGORIES;
}

/**
 * Fetches active categories from the database, auto-seeding if empty.
 * Returns canonical list if database is unreachable.
 */
export async function getOfficialCategories(client) {
  try {
    if (!client || !client.gameCategory) {
      return OFFICIAL_CATEGORIES;
    }

    let categories = await client.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (!categories || categories.length === 0) {
      categories = await ensureOfficialCategories(client);
    }

    return categories;
  } catch (err) {
    console.warn('[getOfficialCategories] Database query failed, using canonical categories:', err.message || err);
    return OFFICIAL_CATEGORIES;
  }
}
