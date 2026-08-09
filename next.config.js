/** @type {import('next').NextConfig} */
const nextConfig = {
  // lib/units.ts reads content/units/*.json with fs at request time so that
  // adding unit 21 means adding a JSON file and touching no code. Next can't
  // trace a dynamic fs path, so the folder has to be force-included in the
  // serverless bundle or the reads 404 on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./content/units/**"],
  },
};

module.exports = nextConfig;
