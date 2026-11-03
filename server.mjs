import http from "node:http";
import { readFileSync } from "node:fs";
import pg from "pg";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
const { version } = JSON.parse(
  readFileSync(new URL("./version.json", import.meta.url), "utf8"),
);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 3000,
});
await pool.query(
  "CREATE TABLE IF NOT EXISTS probe_items (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, value text NOT NULL)",
);
const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/health") {
      await pool.query("SELECT 1");
      response.writeHead(200);
      response.end("healthy");
      return;
    }
    if (request.url === "/items" && request.method === "POST") {
      let text = "";
      for await (const chunk of request) {
        text += chunk;
        if (text.length > 100) throw new Error("Input exceeds limit");
      }
      await pool.query("INSERT INTO probe_items(value) VALUES ($1)", [text]);
    } else if (request.url !== "/") {
      response.writeHead(404);
      response.end("unknown path");
      return;
    }
    const data = await pool.query("SELECT value FROM probe_items ORDER BY id"),
      role = await pool.query(
        "SELECT current_user AS name,rolsuper FROM pg_roles WHERE rolname=current_user",
      );
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        version,
        label: process.env.APP_LABEL,
        deploymentId: process.env.PORENDER_DEPLOYMENT_ID,
        values: data.rows.map((row) => row.value),
        superuser: role.rows[0].rolsuper,
      }),
    );
    console.log(
      JSON.stringify({
        event: "request",
        version,
        method: request.method,
        path: request.url,
      }),
    );
  } catch {
    response.writeHead(503);
    response.end("database unavailable");
  }
});
server.listen(Number(process.env.PORT || 10000), "0.0.0.0", () =>
  console.log(JSON.stringify({ event: "started", version })),
);
process.once("SIGTERM", () =>
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  }),
);
