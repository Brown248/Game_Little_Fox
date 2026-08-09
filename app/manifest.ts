import type { MetadataRoute } from "next";

// Students reach the game by scanning a QR code, so a fair few will "add to
// home screen". This is what that icon and its name come from.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Little Fox Game",
    short_name: "Little Fox",
    description:
      "A ranked English word game from Little Fox Language School — play a unit, climb the class leaderboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDF3E3",
    theme_color: "#FDF3E3",
    icons: [
      {
        src: "/little-fox-mark.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/little-fox-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
