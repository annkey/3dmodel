"use strict";

const crypto = require("crypto");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || "";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "kmax1224";
const RESET_ADMIN = process.argv.includes("--reset-admin");

const STORE_DEFAULTS = {
  generator_settings: {},
  user_credits: { balances: {}, ledger: [] },
  auth_sessions: { sessions: [] },
  user_models: { models: [] }
};

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run this through Railway CLI or set DATABASE_URL locally.");
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldUsePostgresSsl() ? { rejectUnauthorized: false } : undefined
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_runtime_stores (
        store_key TEXT PRIMARY KEY,
        store_value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const [storeKey, value] of Object.entries(STORE_DEFAULTS)) {
      await insertStoreIfMissing(pool, storeKey, value);
    }

    await seedAdminUsers(pool);
    console.log("Runtime Postgres seed complete.");
  } finally {
    await pool.end();
  }
}

async function seedAdminUsers(pool) {
  const result = await pool.query("SELECT store_value FROM app_runtime_stores WHERE store_key = $1", ["admin_users"]);
  const currentStore = result.rows[0]?.store_value;
  const users = Array.isArray(currentStore?.users) ? currentStore.users : [];
  const adminIndex = users.findIndex((user) => {
    return String(user?.id || "").toLowerCase() === "admin" || String(user?.username || "").toLowerCase() === "admin";
  });

  if (adminIndex >= 0 && !RESET_ADMIN) {
    console.log("Admin user already exists. Use --reset-admin to reset its password.");
    return;
  }

  const now = new Date().toISOString();
  const adminUser = {
    id: "admin",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    disabled: false,
    modelStorageQuotaBytes: 10 * 1024 * 1024 * 1024,
    password: buildPasswordRecord(DEFAULT_ADMIN_PASSWORD),
    createdAt: users[adminIndex]?.createdAt || now,
    updatedAt: now
  };

  const nextUsers = adminIndex >= 0
    ? users.map((user, index) => index === adminIndex ? { ...user, ...adminUser } : user)
    : [adminUser, ...users];

  await upsertStore(pool, "admin_users", { users: nextUsers });
  console.log(`Admin user ${adminIndex >= 0 ? "reset" : "created"} with password from DEFAULT_ADMIN_PASSWORD.`);
}

async function insertStoreIfMissing(pool, storeKey, value) {
  await pool.query(
    `INSERT INTO app_runtime_stores (store_key, store_value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (store_key) DO NOTHING`,
    [storeKey, JSON.stringify(value)]
  );
}

async function upsertStore(pool, storeKey, value) {
  await pool.query(
    `INSERT INTO app_runtime_stores (store_key, store_value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (store_key)
     DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
    [storeKey, JSON.stringify(value)]
  );
}

function buildPasswordRecord(password) {
  const value = String(password || "");
  if (value.length < 6) {
    throw new Error("Admin password must be at least 6 characters.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return {
    algorithm: "scrypt",
    salt,
    hash
  };
}

function shouldUsePostgresSsl() {
  const value = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
  return ["1", "true", "require", "required", "verify-ca", "verify-full"].includes(value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
