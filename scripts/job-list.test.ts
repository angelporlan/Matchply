import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { load } from 'cheerio';
import { isSeparatorLabel, listStubCanTakeDescription, separatorCompanyCanTakeIdentity } from '@/lib/extension-capture';

const require = createRequire(import.meta.url);
const jobList = require('../chrome-extension/job-list.js');

function dom(html: string) {
  const $ = load(html);
  const wrap = (el: any): any => {
    if (!el || el.type !== 'tag') return null;
    return {
      tagName: String(el.name || '').toUpperCase(),
      textContent: $(el).text(),
      get parentElement() {
        const parent = el.parent;
        return parent && parent.type === 'tag' ? wrap(parent) : null;
      },
      get children() {
        return (el.children || []).filter((child: any) => child.type === 'tag').map(wrap);
      },
      getAttribute: (name: string) => {
        const value = $(el).attr(name);
        return value === undefined ? null : value;
      },
      closest: (selector: string) => {
        const found = $(el).closest(selector)[0];
        return found ? wrap(found) : null;
      },
      querySelector: (selector: string) => {
        const found = $(el).find(selector)[0];
        return found ? wrap(found) : null;
      },
      querySelectorAll: (selector: string) => $(el).find(selector).toArray().map(wrap),
    };
  };
  return { querySelectorAll: (selector: string) => $(selector).toArray().map(wrap) };
}

const semantic = `
  <div data-testid="lazy-column" hidden>
    <div componentkey="job-card-component-ref-111111">
      <p><span aria-hidden="true">Oferta oculta</span></p>
      <p>Oculta SL</p>
      <p>Madrid (Híbrido)</p>
    </div>
  </div>
  <div data-testid="lazy-column">
    <div role="button" componentkey="job-card-component-ref-4477259122">
      <div componentkey="job-card-component-ref-4477259122">
        <p>
          <span>Seleccionado, Software Engineer – AI Product | TOP AI Startup (empleo verificado)</span>
          <span aria-hidden="true">Software Engineer – AI Product | TOP AI Startup</span>
        </p>
        <p>Joppy</p>
        <p>Madrid (Híbrido)</p>
        <p>Visto</p>
        <p>Adelántate a solicitar el empleo</p>
        <p><span>Publicado hace 25 minutos</span><span aria-hidden="true">hace 25 minutos</span></p>
        <p>Promocionado</p>
      </div>
    </div>
    <div role="button" componentkey="job-card-component-ref-4477240958">
      <p><span aria-hidden="true">Full-Stack Developer (ReactJs / NodeJS) | €60K - €80K</span></p>
      <p>Joppy</p>
      <p>Madrid (Híbrido)</p>
      <p>hace 38 minutos</p>
    </div>
    <div role="button" componentkey="job-card-component-ref-555555">
      <p><span aria-hidden="true">Role without a company</span></p>
      <p>Promocionado por técnico de selección</p>
      <p>Madrid (Híbrido)</p>
    </div>
  </div>
  <section class="jobs-details">
    <div componentkey="job-card-component-ref-999999">
      <p><span aria-hidden="true">Similar role that must stay out</span></p>
      <p>Other Co</p>
      <p>Barcelona (Presencial)</p>
    </div>
  </section>
`;

test('visible capture reads mounted semantic cards and ignores hidden, nested and detail cards', () => {
  const { offers, truncated } = jobList.read(dom(semantic));
  assert.equal(truncated, false);
  assert.deepEqual(offers.map((offer: { job_id: string }) => offer.job_id), ['4477259122', '4477240958']);
  assert.equal(offers[0].title, 'Software Engineer – AI Product | TOP AI Startup');
  assert.equal(offers[0].company, 'Joppy');
  assert.equal(offers[0].location, 'Madrid');
  assert.equal(offers[0].workplace_type, 'Híbrido');
  assert.equal(offers[0].sourceMetadata.captureKind, 'list');
  assert.equal(offers[0].sourceMetadata.postedAt, 'hace 25 minutos');
  assert.equal(offers[0].description, '');
  assert.equal(offers[0].url, 'https://www.linkedin.com/jobs/view/4477259122');
  assert.equal(offers[1].title, 'Full-Stack Developer (ReactJs / NodeJS) | €60K - €80K');
  assert.equal(offers[1].company, 'Joppy');
});

test('a verified badge inside the title does not turn the company into the role', () => {
  const html = `
    <div data-testid="lazy-column">
      <div role="button" componentkey="job-card-component-ref-4477203782">
        <p>
          <span>Seleccionado, Graduate AI software engineer (empleo verificado)</span>
          <span aria-hidden="true">Graduate AI software engineer<span> </span><span aria-hidden="true"><svg><path></path></svg></span></span>
        </p>
        <p>Bending Spoons</p>
        <p>Madrid (Híbrido)</p>
        <p>Visto</p>
        <p>·</p>
        <p>Adelántate a solicitar el empleo</p>
      </div>
      <div role="button" componentkey="job-card-component-ref-4400000001">
        <p><span aria-hidden="true">Role without a company<span> </span></span></p>
        <p>·</p>
        <p>Barcelona (Presencial)</p>
      </div>
    </div>
  `;
  const { offers } = jobList.read(dom(html));
  assert.equal(offers.length, 1);
  assert.equal(offers[0].job_id, '4477203782');
  assert.equal(offers[0].title, 'Graduate AI software engineer');
  assert.equal(offers[0].company, 'Bending Spoons');
  assert.equal(offers[0].location, 'Madrid');
  assert.equal(offers[0].workplace_type, 'Híbrido');
  assert.equal(isSeparatorLabel('·'), true);
  assert.equal(isSeparatorLabel('.'), true);
  assert.equal(separatorCompanyCanTakeIdentity('·', { title: 'Graduate AI software engineer', company: 'Bending Spoons' }), true);
  assert.equal(separatorCompanyCanTakeIdentity('Joppy', { title: 'Engineer', company: 'Other' }), false);
  assert.equal(separatorCompanyCanTakeIdentity('·', { title: 'Bending Spoons', company: '·' }), false);
});

test('classic job cards dedupe and keep the company off the promotion label', () => {
  const html = `
    <ul class="scaffold-layout__list-container">
      <li data-occludable-job-id="123456">
        <div class="job-card-container" data-job-id="123456">
          <a class="job-card-list__title" href="/jobs/view/backend-engineer-123456/"><strong>Backend Engineer</strong></a>
          <div class="artdeco-entity-lockup__subtitle"><span>Acme</span></div>
          <ul><li class="job-card-container__metadata-item">Lisboa (En remoto)</li></ul>
        </div>
      </li>
      <li data-occludable-job-id="123456">
        <div class="job-card-container" data-job-id="123456">
          <a class="job-card-list__title" href="/jobs/view/123456/">Backend Engineer</a>
          <div class="job-card-container__primary-description">Promocionado por técnico de selección</div>
        </div>
      </li>
    </ul>
  `;
  const { offers } = jobList.read(dom(html));
  assert.equal(offers.length, 1);
  assert.equal(offers[0].job_id, '123456');
  assert.equal(offers[0].company, 'Acme');
  assert.equal(offers[0].location, 'Lisboa');
  assert.equal(offers[0].workplace_type, 'Remoto');
});

test('without a results list, detail-pane cards stay out and a loose card is kept', () => {
  const html = `
    <main>
      <div componentkey="job-card-component-ref-424242">
        <p><span aria-hidden="true">Visible role</span></p>
        <p>Acme</p>
        <p>Madrid, España</p>
      </div>
    </main>
    <section class="jobs-details">
      <div componentkey="job-card-component-ref-777777">
        <p><span aria-hidden="true">Similar role</span></p>
        <p>Other Co</p>
        <p>Barcelona (Presencial)</p>
      </div>
    </section>
  `;
  const { offers } = jobList.read(dom(html));
  assert.deepEqual(offers.map((offer: { job_id: string }) => offer.job_id), ['424242']);
  assert.equal(offers[0].location, 'Madrid, España');
});

test('a painted list stops at 25 cards and says there are more', () => {
  const cards = Array.from({ length: 30 }, (_, index) => {
    const id = String(100000 + index);
    return `<div componentkey="job-card-component-ref-${id}"><p><span aria-hidden="true">Role ${index}</span></p><p>Acme ${index}</p><p>Madrid (Híbrido)</p></div>`;
  }).join('');
  const { offers, truncated } = jobList.read(dom(`<div data-testid="lazy-column">${cards}</div>`));
  assert.equal(offers.length, 25);
  assert.equal(truncated, true);
  assert.equal(offers[0].job_id, '100000');
  assert.equal(offers[24].job_id, '100024');
  assert.match(jobList.summary({ created: 25, existing: 0, failed: 0, truncated: true }), /Hay más en la lista/);
});

test('the list reader never clicks, scrolls or calls LinkedIn', () => {
  const source = readFileSync('chrome-extension/job-list.js', 'utf8');
  const content = readFileSync('chrome-extension/content.js', 'utf8');
  assert.equal(source.includes('.click('), false);
  assert.equal(source.includes('scrollIntoView'), false);
  assert.equal(source.includes('scrollTop'), false);
  assert.equal(source.includes('fetch('), false);
  assert.match(content, /data-action="capture-visible"/);
  assert.match(content, /No se abre ninguna/);
  assert.equal(content.includes('openVisibleCard'), false);
  assert.match(readFileSync('chrome-extension/manifest.json', 'utf8'), /job-list\.js/);
});

test('summary and stub fill keep a real description in place', () => {
  assert.equal(jobList.summary({ created: 1, existing: 2, failed: 0 }), '1 oferta nueva y 2 ya estaban en Matchply. La descripción completa entra al abrir cada oferta.');
  assert.equal(jobList.summary({ created: 0, existing: 1, failed: 0 }), '1 ya estaba en Matchply.');
  assert.equal(jobList.summary({ created: 0, existing: 0, failed: 0 }), 'No hay ofertas visibles en la lista.');
  assert.equal(listStubCanTakeDescription({ description: 'Madrid\nJoppy', sourceMetadata: { captureKind: 'list' } }, 'x'.repeat(80)), true);
  assert.equal(listStubCanTakeDescription({ description: 'DESCRIPTION_SENTINEL', sourceMetadata: {} }, 'x'.repeat(90)), false);
  assert.equal(listStubCanTakeDescription({ description: '', sourceMetadata: {} }, 'x'.repeat(80)), true);
  assert.equal(listStubCanTakeDescription({ description: null, sourceMetadata: { captureKind: 'list' } }, 'corta'), false);
});
