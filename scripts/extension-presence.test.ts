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
    return node;
  }

  function classNames(node: FakeNode) {
    return Array.from((node.classList as unknown as { set: Set<string> }).set);
  }

  function matches(node: FakeNode, step: string) {
    const tag = step.match(/^[a-z]+/i)?.[0];
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
        onMessage: { addListener: () => {} },
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
