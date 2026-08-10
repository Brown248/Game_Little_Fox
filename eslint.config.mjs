// Flat config — `next lint` was removed in Next 16, so `npm run lint` now
// calls the ESLint CLI directly and reads this file instead of .eslintrc.json.
// The rule set is still just eslint-config-next's core-web-vitals.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "supabase/**",
      "public/**",
    ],
  },

  ...nextCoreWebVitals,

  {
    // react-hooks 7 (new in the Next 16 config) forbids setState inside an
    // effect body. These screens have to do exactly that and cannot be
    // rewritten around it:
    //   · StartForm · PlayClient · MyScores · RankBoard · both leaderboards —
    //     read the saved player out of localStorage after mount. Doing it
    //     during render would break SSR: the server has no localStorage, so
    //     the markup would not match.
    //   · RankBoard, MyScores and PlayClient also kick off their Supabase
    //     query on mount, and that query reports its own loading/failure
    //     state.
    // The rule stays on everywhere else, so new code still gets caught.
    files: [
      "components/StartForm.tsx",
      "components/PlayClient.tsx",
      "components/MyScores.tsx",
      "components/RankBoard.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
];

export default config;
