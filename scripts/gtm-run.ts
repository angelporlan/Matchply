import path from 'node:path';
import { createGtmRun, finishGtmRun } from '@/lib/gtm-runner';

type ParsedArgs = Record<string, string | boolean> & { command?: string };

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const result: ParsedArgs = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      result[rawKey] = inlineValue;
      continue;
    }
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      result[rawKey] = next;
      index += 1;
    } else {
      result[rawKey] = true;
    }
  }
  return result;
}

function stringArg(args: ParsedArgs, name: string) {
  const value = args[name];
  return typeof value === 'string' ? value : undefined;
}

function workspaceRoot() {
  return path.resolve(process.env.GTM_WORKSPACE_ROOT || path.join(process.cwd(), 'docs/gtm'));
}

function printUsage() {
  console.error([
    'Uso:',
    '  npm run gtm:run -- start --bot "Captador" [--title "DM research"]',
    '  npm run gtm:run -- finish --run RUN_ID [--status completed|failed] [--summary "..."]',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot();

  if (args.command === 'start') {
    const botName = stringArg(args, 'bot');
    if (!botName) {
      printUsage();
      process.exitCode = 2;
      return;
    }
    const created = await createGtmRun({
      root,
      botName,
      title: stringArg(args, 'title'),
      summary: stringArg(args, 'summary'),
    });
    console.log(`runId=${created.manifest.runId}`);
    console.log(`runDirectory=${created.runDirectory}`);
    console.log(`outputDirectory=${created.outputDirectory}`);
    return;
  }

  if (args.command === 'finish') {
    const runId = stringArg(args, 'run');
    const rawStatus = stringArg(args, 'status') || 'completed';
    if (!runId || !['completed', 'failed'].includes(rawStatus)) {
      printUsage();
      process.exitCode = 2;
      return;
    }
    const finished = await finishGtmRun({
      root,
      runId,
      status: rawStatus as 'completed' | 'failed',
      summary: stringArg(args, 'summary'),
    });
    console.log(`runId=${finished.manifest.runId}`);
    console.log(`status=${finished.manifest.status}`);
    console.log(`outputCount=${finished.manifest.outputs.length}`);
    console.log(`runDirectory=${finished.runDirectory}`);
    return;
  }

  printUsage();
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
