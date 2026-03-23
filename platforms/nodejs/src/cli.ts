#!/usr/bin/env node
import "named-logs-context";
import { createServer, type Env } from "template-agnostic-server-app";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { RemoteLibSQL } from "remote-sql-libsql";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadEnv } from "ldenv";

const __dirname = import.meta.dirname;

loadEnv({
  defaultEnvFile: path.join(__dirname, "../.env.default"),
});

type NodeJSEnv = Env & {
  DB: string;
};

async function main() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"),
  );
  const program = new Command();

  program
    .name("faucet-nodejs")
    .version(pkg.version)
    .usage(`faucet-nodejs [--port 2000]`)
    .description("run faucet server as a node process")
    .option("-p, --port <port>");

  program.parse(process.argv);

  type Options = {
    port?: string;
  };

  const options: Options = program.opts();
  const port = options.port ? parseInt(options.port) : 2000;

  const env = process.env as NodeJSEnv;

  const db = env.DB;

  const client = createClient({
    url: db,
  });
  const remoteSQL = new RemoteLibSQL(client);

  // Create server app (includes API routes under /api)
  const app = createServer<NodeJSEnv>({
    getDB: () => remoteSQL,
    getEnv: () => env,
  });

  // Serve static files if directory exists
  const staticDir = path.join(__dirname, "../static");
  if (fs.existsSync(staticDir)) {
    // Serve static assets
    app.use("/*", serveStatic({ root: "./static" }));

    // Fallback to index.html for SPA (any request that didn't match static files)
    app.get("*", serveStatic({ root: "./static", path: "/index.html" }));
  }

  if (db === ":memory:") {
    // console.log(`executing setup...`);
    // can fetch an admin route with the token if needed
  }

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`Server is running on http://localhost:${port}`);
}
main();
