import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

// Students reach the game by scanning a QR code, so a fair few will "add to
// home screen". This is what that icon and its name come from.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
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
