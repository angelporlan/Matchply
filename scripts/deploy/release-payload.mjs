const payload = {
  sha: process.env.RELEASE_SHA,
  web_image: `ghcr.io/angelporlan/matchply-web@${process.env.WEB_DIGEST}`,
  worker_image: `ghcr.io/angelporlan/matchply-worker@${process.env.WORKER_DIGEST}`,
  registry_user: process.env.REGISTRY_USER,
  registry_token: process.env.REGISTRY_TOKEN,
};
if (!/^[a-f0-9]{40}$/.test(payload.sha || '')) throw new Error('Invalid release commit');
for (const field of ['web_image', 'worker_image']) {
  if (!/@sha256:[a-f0-9]{64}$/.test(payload[field])) throw new Error('Missing immutable image digest');
}
// Stdout is piped directly into SSH, never written to the Actions log or an artifact.
process.stdout.write(JSON.stringify(payload));
