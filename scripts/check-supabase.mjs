// Checks a real Supabase project the way the app will use it.
//
//   npm run check:db
//
// Reads .env.local, then answers the two questions that go wrong on setup day:
// are the keys right, and has schema.sql actually been run? Read-only — it
// never writes a row, so it is safe against a live class.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log("  ok    " + m);
const bad = (m) => console.log("  FAIL  " + m);

let failures = 0;
const fail = (m) => {
  failures += 1;
  bad(m);
};

console.log("\nSupabase connection check\n");

if (!url || !anon) {
  console.log(
    "No keys found. Copy .env.example to .env.local and fill in\n" +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.\n"
  );
  process.exit(1);
}

console.log("project: " + url);
console.log("anon key: " + anon.slice(0, 6) + "… (" + anon.length + " chars)");
if (anon.length < 40) {
  fail("that anon key looks too short to be real — copy it again from Settings → API");
}
if (service && service.length < 40) {
  fail("SUPABASE_SERVICE_ROLE_KEY looks too short — /admin will not work");
}
if (!service) {
  fail("SUPABASE_SERVICE_ROLE_KEY is missing — /admin will not work");
}
console.log("");

// Every table and view the student-facing code reads.
const targets = [
  ["players", "table"],
  ["attempts", "table"],
  ["v_unit_ranking", "view"],
  ["v_overall_ranking", "view"],
];

let attemptsExists = false;

for (const [name, kind] of targets) {
  try {
    const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, {
      headers: { apikey: anon, authorization: `Bearer ${anon}` },
    });
    if (res.ok) {
      ok(`${kind} ${name}`);
      if (name === "attempts") attemptsExists = true;
      continue;
    }
    const body = await res.text();
    if (res.status === 404 || /does not exist|not find/i.test(body)) {
      fail(`${kind} ${name} is missing — run supabase/schema.sql in the SQL editor`);
    } else if (res.status === 401) {
      fail(`${kind} ${name}: key rejected (401) — check the anon key`);
    } else {
      fail(`${kind} ${name}: HTTP ${res.status} ${body.slice(0, 120)}`);
    }
  } catch (err) {
    fail(`${kind} ${name}: ${err.message} — check the project URL`);
  }
}

// RLS is the reason a student cannot wipe the board. Only meaningful once the
// table is really there — a missing table refuses everything, which would look
// like a pass and mean nothing.
if (attemptsExists) {
  try {
    const res = await fetch(`${url}/rest/v1/attempts?id=eq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: { apikey: anon, authorization: `Bearer ${anon}` },
    });
    if (res.status === 401 || res.status === 403) {
      ok("anon cannot delete attempts (RLS is on)");
    } else {
      fail(
        `anon got HTTP ${res.status} on a delete — RLS may be off, re-run the policies at the end of schema.sql`
      );
    }
  } catch (err) {
    fail(`could not test RLS: ${err.message}`);
  }
} else {
  console.log("  --    RLS not tested (no attempts table yet)");
}

console.log("");
if (failures) {
  console.log(`${failures} problem(s). Fix those and run this again.\n`);
  process.exit(1);
}
console.log("All good — the scoreboard is ready for a class.\n");
