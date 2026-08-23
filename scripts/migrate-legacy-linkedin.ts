import { readFile } from 'node:fs/promises';

type LegacyJob = Record<string, unknown>;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function readJobs(content: string): LegacyJob[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return content.split('\n').map(line => line.trim()).filter(Boolean).flatMap(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === 'object' ? [parsed as LegacyJob] : [];
      } catch {
        return [];
      }
    });
  }
}

async function main() {
  const file = argument('--file');
  const apiKey = argument('--api-key') || process.env.MATCHPLY_API_KEY;
  const baseUrl = (argument('--base-url') || process.env.MATCHPLY_URL || 'https://matchply.com').replace(/\/$/, '');
  const email = argument('--email') || process.env.MATCHPLY_USER_EMAIL;
  if (!file || !apiKey) {
    console.error('Uso: npx tsx scripts/migrate-legacy-linkedin.ts --file export.json --api-key matchply_usr_... [--email usuario@dominio.com] [--base-url https://matchply.com]');
    process.exitCode = 2;
    return;
  }

  const jobs = readJobs(await readFile(file, 'utf8'));
  let imported = 0;
  for (const legacy of jobs) {
    const externalId = asText(legacy.sourceJobId || legacy.source_job_id || legacy.job_id || legacy.id);
    const title = asText(legacy.title || legacy.job_title);
    const company = asText(legacy.company || legacy.company_name);
    if (!externalId || !title || !company) continue;
    const response = await fetch(`${baseUrl}/api/external/applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(email ? { 'x-matchply-user-email': email } : {}),
      },
      body: JSON.stringify({
        title,
        company,
        url: asText(legacy.canonicalUrl || legacy.url) || undefined,
        platform: 'linkedin',
        description: asText(legacy.description || legacy.rawText) || undefined,
        source: 'legacy_linkedin_bridge',
        externalSource: 'legacy_linkedin_bridge',
        externalId,
        sourceMetadata: { payloadVersion: 1, migratedFrom: 'teng' },
      }),
    });
    if (!response.ok) throw new Error(`Error importando ${externalId}: ${response.status} ${await response.text()}`);
    imported += 1;
  }
  console.log(JSON.stringify({ imported, total: jobs.length, researchStarted: false }));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
