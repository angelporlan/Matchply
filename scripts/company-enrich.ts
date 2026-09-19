import { readFile } from 'node:fs/promises';
import path from 'node:path';

type Command = 'list' | 'apply';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function printUsage() {
  console.error(`Uso:
  npx tsx scripts/company-enrich.ts list [--limit 50]
  npx tsx scripts/company-enrich.ts apply --id <uuid> [--website URL] [--location TEXT] [--sector TEXT] [--icon /ruta.png] [--overwrite]
`);
}

async function main() {
  const command = (process.argv[2] || 'list') as Command;
  if (command !== 'list' && command !== 'apply') {
    printUsage();
    process.exit(1);
  }

  const { applyCompanyEnrichment, listIncompleteCompanies, saveCompanyIcon } = await import('@/lib/company-service');

  if (command === 'list') {
    const limit = Number(argValue('--limit') || 100);
    const rows = await listIncompleteCompanies(limit);
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }

  const id = argValue('--id');
  if (!id) {
    printUsage();
    process.exit(1);
  }

  const overwrite = hasFlag('--overwrite');
  const website = argValue('--website');
  const location = argValue('--location');
  const sector = argValue('--sector');
  const iconPath = argValue('--icon');

  const updated = await applyCompanyEnrichment(
    id,
    {
      ...(website !== undefined ? { website } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(sector !== undefined ? { sector } : {}),
    },
    { overwrite },
  );

  let iconHash = updated.iconHash;
  if (iconPath) {
    const bytes = await readFile(path.resolve(iconPath));
    const withIcon = await saveCompanyIcon(id, bytes, null, { overwrite });
    iconHash = withIcon.iconHash;
  }

  process.stdout.write(`${JSON.stringify({ ...updated, iconHash }, null, 2)}\n`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
