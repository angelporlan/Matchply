/** Local-only layout verification of a synthetic CV produced by the real worker. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { cvs, cvOptimizations, cvVariants } from '@/db/schema';
import { generatePdfBuffer } from '@/lib/pdf-engine';
import { countPdfPages } from '@/lib/pdf-pages';

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!['localhost','127.0.0.1','[::1]'].includes(host)) throw new Error('LOCAL_DATABASE_REQUIRED');
  const cvId = process.env.CV_OPTIMIZATION_SMOKE_CV_ID;
  if (!cvId) throw new Error('CV_OPTIMIZATION_SMOKE_CV_ID_REQUIRED');
  const [cv] = await db.select().from(cvs).where(eq(cvs.id,cvId)).limit(1);
  const [run] = cv?.optimizationId ? await db.select().from(cvOptimizations).where(eq(cvOptimizations.id,cv.optimizationId)).limit(1) : [];
  if (!cv || !run || !run.sourceMarkdown.startsWith('# Ana Pérez\n') || !run.sourceMarkdown.includes('ana@example.test')) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
  const variants = await db.select().from(cvVariants).where(and(eq(cvVariants.optimizationId,run.id),eq(cvVariants.status,'ready')));
  if (variants.length !== 3) throw new Error('THREE_READY_VARIANTS_REQUIRED');
  const folder = '/tmp/matchply-cv-variants-pdfs'; await mkdir(folder,{recursive:true});
  for (const variant of variants) {
    const {buffer}=await generatePdfBuffer(variant.content,{template:cv.templateName,fontFamily:cv.fontFamily,accentColor:cv.accentColor,pageMargin:cv.pageMargin,fontSize:(cv.scale||1)*9});
    await writeFile(path.join(folder,variant.modeId+'.pdf'),buffer);
    console.log(JSON.stringify({mode:variant.modeId,pages:countPdfPages(buffer),bytes:buffer.length}));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
