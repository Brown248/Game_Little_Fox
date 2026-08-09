import http from "node:http";

// supabase-js talks to `${url}/rest/v1/...`, but a bare PostgREST serves at
// `/`. This proxy strips the prefix so the *real* lib/supabase.ts client can be
// pointed at the test container with no code changes.

const POSTGREST = { host: "127.0.0.1", port: 55430 };
const PROXY_PORT = 55431;

export default async function setup() {
  await assertPostgrestUp();

  // Connection reuse between undici (Node's fetch, used by supabase-js) and a
  // hand-rolled proxy produces intermittent "fetch failed" errors when a
  // pooled socket is reused just as it closes. One connection per request is
  // slower and completely deterministic, which is what a test needs.
  const agent = new http.Agent({ keepAlive: false, maxSockets: 64 });

  const server = http.createServer((req, res) => {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["keep-alive"];
    headers.connection = "close";

    const proxied = http.request(
      {
        host: POSTGREST.host,
        port: POSTGREST.port,
        method: req.method,
        path: (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/",
        headers,
        agent,
      },
      (upstream) => {
        const out = { ...upstream.headers };
        delete out.connection;
        delete out["keep-alive"];
        delete out["transfer-encoding"];
        res.writeHead(upstream.statusCode ?? 502, { ...out, connection: "close" });
        upstream.pipe(res);
      }
    );

    const fail = (err: Error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(502, { "content-type": "application/json", connection: "close" });
      res.end(JSON.stringify({ message: `proxy error: ${err.message}` }));
    };

    proxied.on("error", fail);
    req.on("error", fail);
    req.pipe(proxied);
  });

  server.keepAliveTimeout = 0;

  await new Promise<void>((resolve) => server.listen(PROXY_PORT, "127.0.0.1", resolve));

  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}

async function assertPostgrestUp() {
  try {
    const res = await fetch(`http://${POSTGREST.host}:${POSTGREST.port}/`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `The database test stack isn't running (${(err as Error).message}).\n` +
        "Start it with:\n" +
        "  docker compose -f tests/db/docker-compose.yml up -d\n"
    );
  }
}
