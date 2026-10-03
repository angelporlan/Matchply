/** Explicit live check; never included in npm test. Does not write product entities. */
import { loadEnvConfig } from '@next/env';
import { downloadPublicPage } from '@/lib/offer-import/public-page';
import { extractOffer } from '@/lib/offer-import/extract';
import { importOffer } from '@/lib/offer-import/service';

async function main() {
  loadEnvConfig(process.cwd());
  const url = 'https://www.linkedin.com/jobs/view/4465816694/';
  const page = await downloadPublicPage(url);
  const extracted = extractOffer(page.html, page.url);
  process.stdout.write(JSON.stringify({ check: 'public_page', jobTitle: extracted?.jobTitle, company: extracted?.company, descriptionLength: extracted?.description.length }) + '\n');
  for (const method of ['direct', 'web_search'] as const) {
    try {
      const result = await importOffer(url, method === 'web_search' ? { download: async () => { throw new Error('Forced fallback smoke check'); } } : {});
      process.stdout.write(JSON.stringify({ check: method, success: true, actualMethod: result.sourceMethod, jobTitle: result.jobTitle, company: result.company, descriptionLength: result.jobDescription.length, sources: result.sources }) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify({ check: method, success: false, error: error instanceof Error ? error.message : 'unknown' }) + '\n');
      process.exitCode = 1;
    }
  }
}
main().catch(error => { process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }) + '\n'); process.exitCode = 1; });
