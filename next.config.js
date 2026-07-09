/** @type {import('next').NextConfig} */
// Versión visible en el header (donde estaba "HQ"): se deriva SOLA del último PR mergeado — en
// Vercel el commit de main tras un merge se llama "Merge pull request #N ..." (o "Título (#N)"
// si es squash), así que VERCEL_GIT_COMMIT_MESSAGE trae el número y el build lo convierte en
// "1.N". Sin ese env (local / branch sin PR) cae al SHA corto o "dev". Confirma de un vistazo
// que el deploy que estás mirando es el del último merge.
const msg = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
const pr = (msg.match(/#(\d+)/) || [])[1];
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pr ? `1.${pr}` : (sha || "dev"),
  },
};
module.exports = nextConfig;
