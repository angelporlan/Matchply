import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAiPromptsDebugEnabled,
  formatPromptForClipboard,
} from '@/lib/ai-prompts-debug';
import { AIService } from '@/lib/ai-service';

test('isAiPromptsDebugEnabled reads AI_PROMPTS_DEBUG environment variable', () => {
  const originalEnv = process.env.AI_PROMPTS_DEBUG;
  const originalPublicEnv = process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG;

  try {
    delete process.env.AI_PROMPTS_DEBUG;
    delete process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG;
    assert.equal(isAiPromptsDebugEnabled(), false);

    process.env.AI_PROMPTS_DEBUG = 'true';
    assert.equal(isAiPromptsDebugEnabled(), true);

    process.env.AI_PROMPTS_DEBUG = 'false';
    assert.equal(isAiPromptsDebugEnabled(), false);

    delete process.env.AI_PROMPTS_DEBUG;
    process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG = 'true';
    assert.equal(isAiPromptsDebugEnabled(), true);
  } finally {
    if (originalEnv !== undefined) process.env.AI_PROMPTS_DEBUG = originalEnv;
    else delete process.env.AI_PROMPTS_DEBUG;

    if (originalPublicEnv !== undefined) process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG = originalPublicEnv;
    else delete process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG;
  }
});

test('formatPromptForClipboard outputs structured markdown for clipboard', () => {
  const formatted = formatPromptForClipboard({
    actionTitle: 'Optimización de CV con IA',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    systemPrompt: 'Eres un redactor experto...',
    userPrompt: 'CV Base:\nContenido del CV...',
  });

  assert.match(formatted, /# ⚡ PROMPT DE IA \[Optimización de CV con IA\]/);
  assert.match(formatted, /\*\*Proveedor:\*\* gemini/);
  assert.match(formatted, /\*\*Modelo:\*\* gemini-2.5-flash/);
  assert.match(formatted, /## SYSTEM PROMPT/);
  assert.match(formatted, /Eres un redactor experto\.\.\./);
  assert.match(formatted, /## USER PROMPT/);
  assert.match(formatted, /CV Base:\nContenido del CV\.\.\./);
});

test('AIService.buildDebugPrompt resolves optimize_cv prompt with CV and job data', async () => {
  const result = await AIService.buildDebugPrompt('optimize_cv', {
    baseCvMarkdown: '# Carlos García\n\nDesarrollador Full Stack',
    jobDescription: 'Buscamos desarrollador React y Node.js',
    candidateName: 'Carlos García',
  }, {
    subscriptionStatus: 'active',
  });

  assert.equal(result.actionTitle, 'Optimización de CV con IA');
  assert.ok(result.provider);
  assert.ok(result.model);
  assert.match(result.systemPrompt, /Carlos García/);
  assert.match(result.systemPrompt, /REGLAS DE FIDELIDAD DEL CV/);
  assert.match(result.userPrompt, /Buscamos desarrollador React y Node\.js/);
});

test('AIService.buildDebugPrompt resolves curate_offers prompt with offers list', async () => {
  const result = await AIService.buildDebugPrompt('curate_offers', {
    targetThreshold: 75,
    baseCvMarkdown: '# Perfil del candidato',
    offers: [
      {
        id: 'off-1',
        title: 'Tech Lead',
        company: 'Innovatech',
        description: 'Liderar equipo de desarrollo backend',
        platform: 'linkedin',
      },
    ],
  }, {
    subscriptionStatus: 'none',
    careerProfile: {
      curationCriteria: 'Solo trabajo en remoto y salario superior a 50k',
    },
  });

  assert.match(result.actionTitle, /Curar y calcular Match con IA/);
  assert.match(result.systemPrompt, /tech_stack/);
  assert.match(result.systemPrompt, /DATOS/);
  assert.doesNotMatch(result.systemPrompt, /"score": 85/);
  assert.doesNotMatch(result.systemPrompt, /Solo trabajo en remoto/);
  assert.match(result.userPrompt, /Innovatech/);
  assert.match(result.userPrompt, /Tech Lead/);
  assert.match(result.userPrompt, /remoto/i);
});

test('AIService.buildDebugPrompt resolves outreach and import_cv prompts', async () => {
  const outreach = await AIService.buildDebugPrompt('outreach', {
    cvContent: '# Mi CV',
    jobTitle: 'Senior Frontend',
    company: 'NextCorp',
    jobDescription: 'Experiencia con Next.js y Tailwind',
  });

  assert.match(outreach.actionTitle, /Carta de Presentación y Contacto/);
  assert.match(outreach.systemPrompt, /cover letter/i);
  assert.match(outreach.userPrompt, /NextCorp/);

  const importCv = await AIService.buildDebugPrompt('import_cv', {
    rawText: '# Elena Gómez\nIngeniera de Software',
  });

  assert.equal(importCv.actionTitle, 'Importar y Formatear CV con IA');
  assert.match(importCv.systemPrompt, /Elena Gómez/);
  assert.match(importCv.userPrompt, /Elena Gómez/);
});
