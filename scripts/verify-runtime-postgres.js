"use strict";

const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || "";

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldUsePostgresSsl() ? { rejectUnauthorized: false } : undefined
  });

  try {
    const stores = await pool.query("SELECT store_key FROM app_runtime_stores ORDER BY store_key");
    const admins = await pool.query(
      "SELECT store_value FROM app_runtime_stores WHERE store_key = $1",
      ["admin_users"]
    );
    const users = Array.isArray(admins.rows[0]?.store_value?.users)
      ? admins.rows[0].store_value.users
      : [];

    console.log(JSON.stringify({
      stores: stores.rows.map((row) => row.store_key),
      adminUsers: users.filter((user) => user.role === "admin").length,
      totalUsers: users.length
    }));
  } finally {
    await pool.end();
  }
}

function shouldUsePostgresSsl() {
  const value = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
  return ["1", "true", "require", "required", "verify-ca", "verify-full"].includes(value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
