#!/usr/bin/env node
/**
 * Safe Production Migration and Idempotent Seeding Runner
 * Usage:
 *   $env:DATABASE_URL="postgresql://user:password@ep-host.neon.tech/neondb?sslmode=require"
 *   node scripts/safe-migrate-and-seed.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  console.log('================================================================');
  console.log('TEERRESULT24 — SAFE PRODUCTION DATABASE MIGRATION & SEED RUNNER');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://'))) {
    console.error('ERROR: Missing or invalid DATABASE_URL environment variable.');
    console.error('Please set DATABASE_URL with your Neon PostgreSQL connection string, for example:');
    console.error('  $env:DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"');
    process.exit(1);
  }

  // Sanitize connection string for safe logging
  const parsed = new URL(dbUrl);
  const sanitized = `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  console.log(`Connecting to: ${sanitized}`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL database.\n');

    // 1. Read the safe production SQL script
    const sqlPath = path.join(__dirname, '..', 'prisma', 'safe-production-migrate-and-seed.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying safe, idempotent migrations & seed data...');
    await client.query(sqlContent);
    console.log('✓ Migration SQL executed successfully.\n');

    // 2. Verify all 9 required tables exist
    console.log('--- Verifying Table Existence ---');
    const requiredTables = [
      'GameCategory',
      'TeerResult',
      'PendingResultReview',
      'AutomationLock',
      'SourceRecord',
      'ImportJob',
      'CorrectionLog',
      'LoginAttempt',
      'AdminUser',
    ];

    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tableRes = await client.query(tableQuery);
    const existingTables = new Set(tableRes.rows.map((r) => r.table_name));

    let allTablesPresent = true;
    for (const tbl of requiredTables) {
      if (existingTables.has(tbl)) {
        console.log(`  [OK] Table "${tbl}" exists.`);
      } else {
        console.error(`  [MISSING] Table "${tbl}" is missing!`);
        allTablesPresent = false;
      }
    }

    if (!allTablesPresent) {
      throw new Error('Some required production tables are missing after migration.');
    }

    // 3. Verify the 6 Official Competition Categories
    console.log('\n--- Verifying Competition Categories ---');
    const catRes = await client.query(`
      SELECT id, name, slug, "round1Time", "round2Time", "order", "isActive"
      FROM "GameCategory"
      ORDER BY "order" ASC
    `);

    console.log(`Found ${catRes.rows.length} category records:`);
    for (const cat of catRes.rows) {
      console.log(`  [${cat.order}] ${cat.name} (${cat.slug}) — FR: ${cat.round1Time} | SR: ${cat.round2Time} [Active: ${cat.isActive}]`);
    }

    const expectedSlugs = [
      'shillong-teer',
      'khanapara-teer',
      'juwai-teer',
      'shillong-night-teer',
      'shillong-morning-teer',
      'welcome-morning-teer',
    ];
    const presentSlugs = new Set(catRes.rows.map((c) => c.slug));
    const allCategoriesCovered = expectedSlugs.every((slug) => presentSlugs.has(slug));

    if (!allCategoriesCovered) {
      throw new Error('Not all 6 official competition categories are present in the database.');
    }
    console.log('✓ All 6 official competition categories verified in database.\n');

    // 4. Verify Admin User
    console.log('--- Verifying Admin User ---');
    const adminRes = await client.query(`
      SELECT id, username, name, role, "createdAt"
      FROM "AdminUser"
      WHERE username = 'admin'
    `);

    if (adminRes.rows.length > 0) {
      console.log(`  [OK] Admin user "${adminRes.rows[0].username}" exists (Role: ${adminRes.rows[0].role}).`);
    } else {
      console.warn('  [WARN] Admin user record not found.');
    }

    console.log('\n================================================================');
    console.log('PRODUCTION DATABASE VERIFICATION COMPLETED SUCCESSFULLY (100% OK)');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\nDatabase operation failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
