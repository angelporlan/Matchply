import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

type FakeNode = {
  tagName: string;
  id: string;
  className: string;
  children: FakeNode[];
  parentElement: FakeNode | null;
  attributes: Record<string, string>;
  classList: { contains(token: string): boolean };
  innerHTML: string;
  hidden: boolean;
  textContent: string;
  innerText: string;
  shadowRoot: FakeNode | null;
  style: Record<string, string>;
  firstElementChild?: FakeNode | null;
  isConnected?: boolean;
  appendChild(child: FakeNode): FakeNode;
  append(...children: FakeNode[]): void;
  insertBefore(child: FakeNode, before: FakeNode | null): FakeNode;
  remove(): void;
  replaceChildren(...children: FakeNode[]): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
  addEventListener(type: string, listener: (...args: any[]) => void): void;
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number };
  attachShadow(): FakeNode;
  querySelector(selector: string): FakeNode | null;
  querySelectorAll(selector: string): FakeNode[];
  focus(): void;
};

function createBrowser() {
  const timers: Array<{ id: number; fn: () => void; at: number; every: number; cleared: boolean }> = [];
  let now = 0;
  let seq = 0;
  const arm = (fn: () => void, ms: number, every: number) => {
    const id = ++seq;
    timers.push({ id, fn, at: now + ms, every, cleared: false });
    return id;
  };
  const clearTimer = (id: number) => {
    const timer = timers.find((item) => item.id === id);
    if (timer) timer.cleared = true;
  };
  const advance = (ms: number) => {
    now += ms;
    for (let guard = 0; guard < 40; guard += 1) {
      const due = timers.filter((item) => !item.cleared && item.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      if (due.every) due.at += due.every;
      else due.cleared = true;
      due.fn();
    }
  };

  function createElement(tagName: string): FakeNode {
    const node: FakeNode = {
      tagName: tagName.toUpperCase(),
      id: '',
      children: [],
      parentElement: null,
      attributes: {},
      classList: {
        contains(token: string) { return classNames(node).includes(token); },
      },
      innerHTML: '',
      hidden: false,
      shadowRoot: null,
      style: {},
    } as unknown as FakeNode;
    const classList = {
      set: new Set<string>(),
      add: (...tokens: string[]) => tokens.forEach((token) => classList.set.add(token)),
      remove: (...tokens: string[]) => tokens.forEach((token) => classList.set.delete(token)),
      toggle: (token: string, force?: boolean) => {
        const next = force === undefined ? !classList.set.has(token) : force;
        if (next) classList.set.add(token);
        else classList.set.delete(token);
        return next;
      },
      contains: (token: string) => classList.set.has(token),
    };
    Object.assign(node, {
      classList,
      dataset: new Proxy({}, {
        get: (_target, key: string) => {
          if (typeof key !== 'string') return undefined;
          const attr = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
          return node.attributes[attr];
        },
        set: (_target, key: string, value) => {
          const attr = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
          node.attributes[attr] = String(value);
          return true;
        },
      }),
      isConnected: false,
      appendChild(child: FakeNode) {
        const index = child.parentElement?.children.indexOf(child) ?? -1;
        if (index >= 0) child.parentElement?.children.splice(index, 1);
        child.parentElement = node;
        node.children.push(child);
        return child;
      },
      append(...children: FakeNode[]) { children.forEach((child) => node.appendChild(child)); },
      insertBefore(child: FakeNode, before: FakeNode | null) {
        const previous = child.parentElement?.children.indexOf(child) ?? -1;
        if (previous >= 0) child.parentElement?.children.splice(previous, 1);
        child.parentElement = node;
        const index = before ? node.children.indexOf(before) : -1;
        if (index < 0) node.children.unshift(child);
        else node.children.splice(index, 0, child);
        return child;
      },
      remove() {
        node.parentElement?.children.splice(node.parentElement.children.indexOf(node), 1);
        node.parentElement = null;
      },
      replaceChildren(...children: FakeNode[]) {
        node.children = [];
        node.innerHTML = '';
        children.forEach((child) => node.appendChild(child));
      },
      setAttribute(name: string, value: string) { node.attributes[name] = String(value); },
      getAttribute(name: string) { return node.attributes[name] ?? null; },
      removeAttribute(name: string) { delete node.attributes[name]; },
      hasAttribute(name: string) { return Object.prototype.hasOwnProperty.call(node.attributes, name); },
      addEventListener() {},
      setPointerCapture() {},
      releasePointerCapture() {},
      hasPointerCapture() { return false; },
      getBoundingClientRect() { return { width: 280, height: 48, top: 8, left: 12, right: 292, bottom: 56 }; },
      click() {},
      scrollIntoView() {},
      attachShadow() {
        node.shadowRoot = createElement('shadow');
        return node.shadowRoot;
      },
      querySelector: (selector: string) => query(node, selector, false) as FakeNode | null,
      querySelectorAll: (selector: string) => query(node, selector, true) as FakeNode[],
      focus() {},
    });
    Object.defineProperty(node, 'isConnected', {
      get() {
        let current: FakeNode | null = node;
        while (current.parentElement) current = current.parentElement;
        return current.tagName === 'DOCUMENT';
      },
    });
    Object.defineProperty(node, 'className', {
      get: () => Array.from(classList.set).join(' '),
      set: (value: string) => {
        classList.set.clear();
        value.split(/\s+/).filter(Boolean).forEach((token) => classList.set.add(token));
      },
    });
    Object.defineProperty(node, 'firstElementChild', {
      get: () => node.children[0] || null,
    });
    let text = '';
    const sibling = (offset: number) => {
      const siblings = node.parentElement?.children || [];
      const index = siblings.indexOf(node);
      return index >= 0 ? siblings[index + offset] || null : null;
    };
    Object.defineProperty(node, 'textContent', {
      get: () => text,
      set: (value: string) => { text = String(value ?? ''); },
    });
    Object.defineProperty(node, 'innerText', {
      get() {
        const nested = node.children.map((child) => child.innerText || '').filter(Boolean);
        return [text, ...nested].filter(Boolean).join('\n');
      },
      set: (value: string) => { text = String(value ?? ''); },
    });
    Object.defineProperty(node, 'nextSibling', { get: () => sibling(1) });
    Object.defineProperty(node, 'previousSibling', { get: () => sibling(-1) });
    Object.defineProperty(node, 'nextElementSibling', { get: () => sibling(1) });
    Object.defineProperty(node, 'previousElementSibling', { get: () => sibling(-1) });
    return node;
  }

  function classNames(node: FakeNode) {
    return Array.from((node.classList as unknown as { set: Set<string> }).set);
  }

  function matches(node: FakeNode, step: string) {
    const tag = step.match(/^[a-z][\w-]*/i)?.[0];
    const id = step.match(/#([\w-]+)/)?.[1];
    const classes = Array.from(step.matchAll(/\.([\w-]+)/g)).map((match) => match[1]);
    const attr = step.match(/\[([\w-]+)\]/)?.[1];
    if (tag && node.tagName !== tag.toUpperCase()) return false;
    if (id && node.id !== id) return false;
    if (classes.some((token) => !node.classList.contains(token))) return false;
    if (attr && !Object.prototype.hasOwnProperty.call(node.attributes, attr)) return false;
    return Boolean(tag || id || classes.length || attr);
  }

  function descendants(node: FakeNode): FakeNode[] {
    return node.children.flatMap((child) => [child, ...descendants(child)]);
  }

  function query(root: FakeNode, selector: string, all: boolean) {
    const found: FakeNode[] = [];
    for (const alternative of selector.split(',').map((part) => part.trim()).filter(Boolean)) {
      const steps = alternative.split(/\s+/);
      const walk = (nodes: FakeNode[], index: number) => {
        for (const node of nodes) {
          for (const candidate of descendants(node)) {
            if (!matches(candidate, steps[index])) continue;
            if (index === steps.length - 1) found.push(candidate);
            else walk([candidate], index + 1);
            if (!all && found.length) return;
          }
        }
      };
      walk([root], 0);
      if (!all && found.length) break;
    }
    return all ? found : (found[0] || null);
  }

  const documentNode = createElement('document');
  const documentElement = createElement('html');
  const body = createElement('body');
  const header = createElement('header');
  header.id = 'global-nav';
  header.className = 'global-nav';
  const nav = createElement('nav');
  nav.className = 'global-nav__nav';
  const list = createElement('ul');
  list.className = 'global-nav__primary-items';
  documentNode.appendChild(documentElement);
  documentElement.appendChild(body);
  body.appendChild(header);
  header.appendChild(nav);
  nav.appendChild(list);

  const location = { href: 'https://www.linkedin.com/feed/' };
  Object.defineProperty(location, 'pathname', { get: () => new URL(location.href).pathname });
  const listeners: Record<string, Array<() => void>> = {};
  let onChanged: (changes: Record<string, { newValue?: unknown }>, area: string) => void = () => {};
  let onMessage: (message: { type?: string }, sender: unknown, sendResponse: (value: unknown) => void) => boolean = () => false;
  const storage: Record<string, unknown> = {};
  const documentApi = {
    documentElement,
    body,
    visibilityState: 'visible',
    createElement,
    getElementById: (id: string) => descendants(documentNode).find((node) => node.id === id) || null,
    querySelector: (selector: string) => query(documentNode, selector, false),
    querySelectorAll: (selector: string) => query(documentNode, selector, true) as FakeNode[],
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); },
  };
  const windowApi = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); },
    navigation: { addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); } },
  };

  return {
    advance,
    location,
    listeners,
    list,
    storage,
    documentApi,
    windowApi,
    onChanged: () => onChanged,
    onMessage: () => onMessage,
    setOnChanged: (fn: typeof onChanged) => { onChanged = fn; },
    chrome: {
      storage: {
        onChanged: { addListener: (fn: typeof onChanged) => { onChanged = fn; } },
        local: {
          get: async (keys: string | string[]) => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map((key) => [key, storage[key]])),
          set: async (values: Record<string, unknown>) => Object.assign(storage, values),
        },
      },
      runtime: {
        getManifest: () => ({ version: '2.3.0' }),
        onMessage: { addListener: (fn: typeof onMessage) => { onMessage = fn; } },
        sendMessage: async (_message?: unknown) => ({ ok: true, result: {} }),
      },
    },
    timers: () => ({ setTimeout: (fn: () => void, ms: number) => arm(fn, ms || 0, 0), clearTimeout: clearTimer, setInterval: (fn: () => void, ms: number) => arm(fn, ms || 0, ms || 0), clearInterval: clearTimer }),
  };
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function card(browser: ReturnType<typeof createBrowser>) {
  const host = (browser.documentApi.querySelectorAll('[data-matchply-capture-host]') as FakeNode[])
    .find((node) => !node.attributes['data-matchply-header-mirror'] && !node.attributes['data-matchply-title-host']);
  return host?.shadowRoot?.children.find((child) => child.classList.contains('card')) || null;
}

function boot(browser: ReturnType<typeof createBrowser>, sandbox: Record<string, unknown> = {}) {
  const timers = browser.timers();
  runInNewContext(readFileSync('chrome-extension/content.js', 'utf8'), Object.assign(sandbox, {
    URL,
    document: browser.documentApi,
    window: browser.windowApi,
    location: browser.location,
    chrome: browser.chrome,
    MutationObserver: class { observe() {} disconnect() {} },
    ...timers,
  }));
}

test('the capture widget stays asleep outside jobs and can dock in the header', async () => {
  const browser = createBrowser();
  boot(browser);
  await settle();
  browser.advance(500);
  await settle();
  assert.equal(browser.documentApi.querySelectorAll('[data-matchply-capture-host]').length, 0);

  browser.location.href = 'https://www.linkedin.com/jobs/view/123456/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();
  const floating = card(browser);
  assert.ok(floating);
  assert.equal(floating.hidden, false);
  assert.match(floating.innerHTML, /Se guarda en/);
  assert.equal(browser.documentApi.getElementById('matchply-header-slot'), null);

  browser.onChanged()({ matchplyWidgetAnchor: { newValue: 'header' } }, 'local');
  const slot = browser.documentApi.getElementById('matchply-header-slot');
  assert.equal(slot?.parentElement, browser.list);
  assert.equal(card(browser)?.classList.contains('docked'), true);

  browser.location.href = 'https://www.linkedin.com/feed/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(300);
  await settle();
  assert.equal(card(browser)?.hidden, true);
  assert.equal(browser.documentApi.getElementById('matchply-header-slot'), null);

  browser.location.href = 'https://www.linkedin.com/jobs/search/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(200);
  await settle();
  browser.advance(800);
  await settle();
  assert.match(card(browser)?.innerHTML || '', /Elige una oferta/);
});

test('the floating indicator can hide while the header pill stays', async () => {
  const browser = createBrowser();
  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/123456/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();

  browser.onChanged()({
    matchplyShowFloating: { newValue: true },
    matchplyShowHeader: { newValue: true },
  }, 'local');
  const hosts = browser.documentApi.querySelectorAll('[data-matchply-capture-host]') as FakeNode[];
  const mirror = hosts.find((node) => node.attributes['data-matchply-header-mirror']);
  const floating = card(browser);
  assert.equal(hosts.length, 2);
  assert.equal(mirror?.parentElement?.id, 'matchply-header-slot');
  assert.equal(browser.documentApi.getElementById('matchply-header-slot')?.parentElement, browser.list);
  assert.equal(floating?.classList.contains('docked'), false);
  assert.match(floating?.innerHTML || '', /Se guarda en/);
  assert.match(mirror?.shadowRoot?.children.find((child) => child.classList.contains('mirror'))?.innerHTML || '', /Ocultar libre/);

  browser.onChanged()({ matchplyShowFloating: { newValue: false } }, 'local');
  const remaining = browser.documentApi.querySelectorAll('[data-matchply-capture-host]') as FakeNode[];
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.attributes['data-matchply-header-mirror'], undefined);
  assert.equal(card(browser)?.classList.contains('docked'), true);
  assert.match(card(browser)?.innerHTML || '', /Se guarda en/);
  assert.equal(browser.documentApi.getElementById('matchply-header-slot')?.parentElement, browser.list);
});

test('a second content-script world does not mount another widget', async () => {
  const browser = createBrowser();
  boot(browser, {});
  boot(browser, {});
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/123456/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();
  assert.equal(browser.documentApi.querySelectorAll('[data-matchply-capture-host]').length, 1);
});

test('the title pill sits beside the job name and can be hidden', async () => {
  const browser = createBrowser();
  const titleBox = browser.documentApi.createElement('div');
  titleBox.className = 'job-details-jobs-unified-top-card__job-title';
  const link = browser.documentApi.createElement('a');
  const heading = browser.documentApi.createElement('h1');
  heading.className = 't-24 t-bold inline';
  link.appendChild(heading);
  titleBox.appendChild(link);
  browser.documentApi.body.appendChild(titleBox);
  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/123456/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();

  const titleHost = browser.documentApi.querySelector('[data-matchply-title-host]') as FakeNode | null;
  const pill = titleHost?.shadowRoot?.children.find((child) => child.classList.contains('title-pill'));
  assert.equal(titleBox.children[0], link);
  assert.equal(titleBox.children[1], titleHost);
  assert.match(pill?.innerHTML || '', /Sin guardar/);
  assert.match(pill?.innerHTML || '', /Se guarda en/);
  assert.match(pill?.innerHTML || '', /Capturar ahora/);
  assert.equal(card(browser)?.hidden, false);

  browser.onChanged()({ matchplyShowTitle: { newValue: false } }, 'local');
  assert.equal(browser.documentApi.querySelector('[data-matchply-title-host]'), null);
  assert.equal(card(browser)?.hidden, false);
  assert.match(card(browser)?.innerHTML || '', /Se guarda en/);
});

test('a direct job page is read and the title pill sits beside its heading', async () => {
  const browser = createBrowser();
  const main = browser.documentApi.createElement('main');
  const section = browser.documentApi.createElement('section');
  const company = browser.documentApi.createElement('a');
  company.textContent = 'Fynity';
  company.setAttribute('href', '/company/fynity-png');
  const heading = browser.documentApi.createElement('h1');
  heading.textContent = 'Technical Lead';
  const meta = browser.documentApi.createElement('span');
  meta.textContent = 'Londres y alrededores, Reino Unido · Híbrido · Jornada completa';
  const about = browser.documentApi.createElement('h2');
  about.textContent = 'Acerca del empleo';
  const description = browser.documentApi.createElement('p');
  description.textContent = 'Ruby on Rails Tech Lead in London. This hands-on role builds and scales production platforms, owns architecture, and works with the managing director.';
  const aside = browser.documentApi.createElement('aside');
  const other = browser.documentApi.createElement('h1');
  other.textContent = 'Another Technical Lead';
  aside.appendChild(other);
  section.append(company, heading, meta, about, description);
  main.appendChild(section);
  browser.documentApi.body.appendChild(main);
  browser.documentApi.body.appendChild(aside);

  let captured: any = null;
  browser.chrome.runtime.sendMessage = async (message: any) => {
    captured = message;
    return { ok: true, result: {} };
  };

  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/4473662086/?trackingId=abc';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();

  const titleHost = browser.documentApi.querySelector('[data-matchply-title-host]') as FakeNode | null;
  const siblings = heading.parentElement?.children || [];
  assert.equal(siblings[siblings.indexOf(heading) + 1], titleHost);
  assert.equal(titleHost?.parentElement, section);
  assert.equal(company.children.includes(titleHost as FakeNode), false);

  let response: any = null;
  browser.onMessage()({ type: 'trigger-manual-capture' }, {}, (value) => { response = value; });
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(response?.ok, true);
  assert.equal(captured?.payload?.title, 'Technical Lead');
  assert.equal(captured?.payload?.company, 'Fynity');
  assert.equal(captured?.payload?.location, 'Londres y alrededores, Reino Unido');
  assert.equal(captured?.payload?.workplace_type, 'Híbrido');
  assert.equal(captured?.payload?.employment_type, 'Jornada completa');
  assert.match(captured?.payload?.description || '', /Ruby on Rails Tech Lead/);

  browser.onChanged()({ matchplyExtensionEnabled: { newValue: false } }, 'local');
  assert.equal(browser.documentApi.querySelector('[data-matchply-title-host]'), null);
  assert.equal(card(browser)?.hidden, true);

  browser.onChanged()({ matchplyExtensionEnabled: { newValue: true } }, 'local');
  browser.advance(80);
  await settle();
  assert.equal(card(browser)?.hidden, false);
  assert.ok(browser.documentApi.querySelector('[data-matchply-title-host]'));
});

test('a logged-in job page is read from the sticky title and the visible bullets', async () => {
  const browser = createBrowser();
  const main = browser.documentApi.createElement('main');
  const title = browser.documentApi.createElement('div');
  title.textContent = 'Technical Lead';
  const meta = browser.documentApi.createElement('span');
  meta.textContent = 'Fynity · Londres y alrededores, Reino Unido (Híbrido)';
  const otherJob = browser.documentApi.createElement('div');
  otherJob.className = 'jobs-unified-top-card__job-title';
  const otherLink = browser.documentApi.createElement('a');
  otherLink.setAttribute('href', '/jobs/view/999');
  otherLink.textContent = 'Other role';
  otherJob.appendChild(otherLink);
  const list = browser.documentApi.createElement('ul');
  const first = browser.documentApi.createElement('li');
  first.textContent = 'Solving complex challenges around scalability, performance and architecture for the core platform.';
  const second = browser.documentApi.createElement('li');
  second.textContent = 'Working closely with the MD as a trusted technical partner and shaping the technical direction of the products.';
  list.append(first, second);
  const paragraph = browser.documentApi.createElement('div');
  paragraph.textContent = 'You will need to be a genuinely hands-on Engineer with deep Ruby on Rails expertise across the core platform.';
  main.append(otherJob, title, meta, list, paragraph);
  browser.documentApi.body.appendChild(main);
  (browser.documentApi as { title?: string }).title = 'Technical Lead | Fynity | LinkedIn';

  let captured: any = null;
  browser.chrome.runtime.sendMessage = async (message: any) => {
    captured = message;
    return { ok: true, result: {} };
  };

  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/4473662086/?trackingId=abc';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();
  browser.advance(20);
  await settle();

  const titleHost = browser.documentApi.querySelector('[data-matchply-title-host]') as FakeNode | null;
  const siblings = title.parentElement?.children || [];
  assert.equal(siblings[siblings.indexOf(title) + 1], titleHost);

  let response: any = null;
  browser.onMessage()({ type: 'trigger-manual-capture' }, {}, (value) => { response = value; });
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(response?.ok, true);
  assert.equal(captured?.payload?.title, 'Technical Lead');
  assert.equal(captured?.payload?.company, 'Fynity');
  assert.equal(captured?.payload?.location, 'Londres y alrededores, Reino Unido');
  assert.equal(captured?.payload?.workplace_type, 'Híbrido');
  assert.match(captured?.payload?.description || '', /scalability, performance and architecture/);
  assert.match(captured?.payload?.description || '', /trusted technical partner/);
  assert.match(captured?.payload?.description || '', /genuinely hands-on Engineer/);
  assert.doesNotMatch(captured?.payload?.description || '', /Other role/);
});

test('a promoted job does not use the recruiter label as the company', async () => {
  const browser = createBrowser();
  const main = browser.documentApi.createElement('main');
  const promoted = browser.documentApi.createElement('div');
  promoted.textContent = 'Promocionado por técnico de selección · 1.er';
  const heading = browser.documentApi.createElement('h1');
  heading.textContent = 'Technical Lead';
  const badge = browser.documentApi.createElement('div');
  badge.textContent = 'Promocionado por técnico de selección';
  const meta = browser.documentApi.createElement('span');
  meta.textContent = 'Fynity · Londres y alrededores, Reino Unido (Híbrido)';
  const description = browser.documentApi.createElement('p');
  description.textContent = 'Hands-on Ruby on Rails tech lead who owns architecture, scales the platform and works with the managing director.';
  main.append(promoted, badge, heading, meta, description);
  browser.documentApi.body.appendChild(main);
  (browser.documentApi as { title?: string }).title = 'Technical Lead | Fynity | LinkedIn';

  let captured: any = null;
  browser.chrome.runtime.sendMessage = async (message: any) => {
    captured = message;
    return { ok: true, result: {} };
  };
  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/view/4473662086/';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();

  let response: any = null;
  browser.onMessage()({ type: 'trigger-manual-capture' }, {}, (value) => { response = value; });
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(response?.ok, true);
  assert.equal(captured?.payload?.company, 'Fynity');
  assert.equal(captured?.payload?.location, 'Londres y alrededores, Reino Unido');
});

test('a search pane that still shows another job is not captured', async () => {
  const browser = createBrowser();
  const pane = browser.documentApi.createElement('div');
  pane.className = 'job-details-jobs-unified-top-card__job-title';
  const link = browser.documentApi.createElement('a');
  link.setAttribute('href', '/jobs/view/222');
  const heading = browser.documentApi.createElement('h1');
  heading.textContent = 'Other role';
  link.appendChild(heading);
  const description = browser.documentApi.createElement('p');
  description.textContent = 'This description belongs to the previous offer and must stay unsaved while the selected card is still loading.';
  pane.append(link, description);
  browser.documentApi.body.appendChild(pane);

  let captured: any = null;
  browser.chrome.runtime.sendMessage = async (message: any) => {
    captured = message;
    return { ok: true, result: {} };
  };
  boot(browser);
  await settle();
  browser.location.href = 'https://www.linkedin.com/jobs/search/?currentJobId=111';
  browser.listeners.navigatesuccess?.forEach((fn) => fn());
  browser.advance(400);
  await settle();

  let response: any = null;
  browser.onMessage()({ type: 'trigger-manual-capture' }, {}, (value) => { response = value; });
  for (let i = 0; i < 20 && !response; i += 1) {
    for (let j = 0; j < 10; j += 1) await Promise.resolve();
    browser.advance(400);
  }
  for (let j = 0; j < 10; j += 1) await Promise.resolve();
  assert.equal(response?.ok, false);
  assert.equal(captured, null);
});
