"use client";

import { useEffect, useState } from "react";
import { loadPlayer } from "@/lib/session";

// The heading on the unit picker, in the student's own name.
//
// The name only exists in localStorage, which the server cannot see, so this
// renders a neutral heading first and fills the name in after mount — matching
// what the server sent, then swapping. Anyone who lands here without a name
// gets the plain version and can still play; /play sends them back to the door
// if they really have none.
export default function ExplorerGreeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(loadPlayer()?.name ?? null);
  }, []);

  return <h1>{name ? `Where to, ${name}?` : "Where to next?"}</h1>;
}
