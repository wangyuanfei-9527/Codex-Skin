import net from 'node:net';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function findLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

export function assertLoopbackDebuggerUrl(value, port) {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || Number(url.port) !== port) {
    throw new Error('CDP returned a non-loopback WebSocket endpoint');
  }
  return url.href;
}

export async function waitForDebugger(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const response = await fetch(`http://${host}:${port}/json/version`, { signal: AbortSignal.timeout(1_500) });
        if (!response.ok) throw new Error(`CDP status ${response.status}`);
        const version = await response.json();
        if (!/(Chrome|Chromium|Electron)/i.test(String(version.Browser))) throw new Error('Unexpected CDP browser identity');
        assertLoopbackDebuggerUrl(version.webSocketDebuggerUrl, port);
        return version;
      } catch (error) {
        lastError = error;
      }
    }
    await delay(400);
  }
  throw new Error(`Codex debugging endpoint did not become ready: ${lastError?.message || 'timeout'}`);
}

export async function listPageTargets(port) {
  let lastError;
  for (const host of ['127.0.0.1', '[::1]']) {
    try {
      const response = await fetch(`http://${host}:${port}/json/list`, { signal: AbortSignal.timeout(1_500) });
      if (!response.ok) throw new Error(`Could not list CDP targets (${response.status})`);
      const targets = await response.json();
      return targets.filter((target) => target.type === 'page' && target.webSocketDebuggerUrl).map((target) => ({
        ...target,
        webSocketDebuggerUrl: assertLoopbackDebuggerUrl(target.webSocketDebuggerUrl, port),
      }));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Could not list CDP targets');
}

export function buildInjectionExpression(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `(() => {
    const stateKey = '__CODEX_SKIN_STUDIO_STATE__';
    const previousState = window[stateKey];
    previousState?.observer?.disconnect();
    previousState?.resizeObserver?.disconnect();
    if (previousState?.timer) clearTimeout(previousState.timer);
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), character => character.charCodeAt(0))));
    const root = document.documentElement;
    const shellMain = document.querySelector('main.main-surface');
    const shellSidebar = document.querySelector('aside.app-shell-left-panel');
    const clear = () => {
      root?.classList.remove('codex-skin-studio-active');
      root?.classList.remove('skin-layout-banner', 'skin-layout-fullscreen');
      document.querySelectorAll('.codex-skin-home').forEach(node => node.classList.remove('codex-skin-home'));
      document.querySelectorAll('.skin-home-shell').forEach(node => node.classList.remove('skin-home-shell'));
      document.querySelectorAll('.skin-new-task').forEach(node => node.classList.remove('skin-new-task'));
      document.querySelectorAll('.skin-project-toolbar').forEach(node => node.classList.remove('skin-project-toolbar'));
      document.querySelectorAll('.skin-card-copy').forEach(node => node.remove());
      document.querySelectorAll('[data-skin-generated-aria-label]').forEach(node => {
        node.removeAttribute('aria-label');
        node.removeAttribute('data-skin-generated-aria-label');
      });
      document.querySelectorAll('[data-skin-suggestion-index]').forEach(node => node.removeAttribute('data-skin-suggestion-index'));
      document.getElementById('codex-skin-studio-style')?.remove();
      document.getElementById('codex-skin-studio-chrome')?.remove();
      document.getElementById('codex-skin-studio-background')?.remove();
      document.getElementById('codex-skin-studio-pet')?.remove();
      delete window[stateKey];
    };
    if (!root || !document.body || !shellMain || !shellSidebar) {
      clear();
      return 'ignored-non-codex-shell';
    }

    document.getElementById('codex-skin-studio-background')?.remove();
    let style = document.getElementById('codex-skin-studio-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'codex-skin-studio-style';
      document.head.appendChild(style);
    }
    style.dataset.bundle = payload.bundleId;
    style.textContent = payload.css;
    root.classList.add('codex-skin-studio-active');
    root.classList.toggle('skin-layout-banner', payload.layout === 'banner');
    root.classList.toggle('skin-layout-fullscreen', payload.layout !== 'banner');

    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    document.querySelectorAll('[role="main"].codex-skin-home').forEach(node => {
      if (node !== home) node.classList.remove('codex-skin-home');
    });
    if (home) home.classList.add('codex-skin-home');
    shellMain.classList.toggle('skin-home-shell', Boolean(home));

    const suggestionLabels = [
      ['探索并理解代码', 'Explore and understand code'],
      ['构建新功能', 'Build a new feature', 'Build new features'],
      ['审查代码', 'Review code'],
      ['修复问题', 'Fix an issue', 'Fix issues'],
    ];
    const newTaskLabels = ['新建任务', 'New task'];
    const applyCardCopy = (button, index) => {
      const title = payload.cardTitles?.[index];
      const subtitle = payload.cardSubtitles?.[index];
      if (!title || !subtitle) return;
      if (!button.hasAttribute('aria-label')) {
        const nativeLabel = (button.textContent || '').replace(/\\s+/g, ' ').trim();
        if (nativeLabel) {
          button.setAttribute('aria-label', nativeLabel);
          button.setAttribute('data-skin-generated-aria-label', 'true');
        }
      }
      let copy = button.querySelector(':scope > .skin-card-copy');
      if (!copy) {
        copy = document.createElement('span');
        copy.className = 'skin-card-copy';
        copy.setAttribute('aria-hidden', 'true');
        copy.append(document.createElement('b'), document.createElement('small'));
        button.appendChild(copy);
      }
      copy.querySelector('b').textContent = title;
      copy.querySelector('small').textContent = subtitle;
    };
    const markNativeControls = () => {
      home?.querySelectorAll('[data-skin-suggestion-index]').forEach(node => node.removeAttribute('data-skin-suggestion-index'));
      if (home) {
        const groupButtons = [...home.querySelectorAll('[class~="group/home-suggestions"] button')];
        if (groupButtons.length >= 2 && groupButtons.length <= 4) {
          groupButtons.forEach((button, index) => {
            button.setAttribute('data-skin-suggestion-index', String(index));
            applyCardCopy(button, index);
          });
        } else {
          for (const button of home.querySelectorAll('button')) {
            const label = (button.textContent || '').replace(/\\s+/g, ' ').trim();
            const index = suggestionLabels.findIndex(variants => variants.some(variant => label.includes(variant)));
            if (index >= 0) {
              button.setAttribute('data-skin-suggestion-index', String(index));
              applyCardCopy(button, index);
            }
          }
        }
        home.querySelectorAll('.skin-project-toolbar').forEach(node => node.classList.remove('skin-project-toolbar'));
        const projectSelector = home.querySelector('[class~="group/project-selector"]');
        const fadeMask = projectSelector?.closest('.horizontal-scroll-fade-mask, [class*="horizontal-scroll-fade-mask"]');
        fadeMask?.parentElement?.classList.add('skin-project-toolbar');
      }
      for (const button of shellSidebar.querySelectorAll('nav button')) {
        const isNewTask = newTaskLabels.some(label => (button.textContent || '').includes(label));
        button.classList.toggle('skin-new-task', isNewTask);
      }
    };
    markNativeControls();
    const scheduler = { timer: null };
    const observer = new MutationObserver(() => {
      if (scheduler.timer) clearTimeout(scheduler.timer);
      scheduler.timer = setTimeout(markNativeControls, 120);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const state = { observer, get timer() { return scheduler.timer; } };
    window[stateKey] = state;

    let chrome = document.getElementById('codex-skin-studio-chrome');
    if (!chrome) {
      chrome = document.createElement('div');
      chrome.id = 'codex-skin-studio-chrome';
      chrome.setAttribute('aria-hidden', 'true');
      chrome.innerHTML = '<div class="skin-brand"><span class="skin-brand-mark">✦</span><span><b></b><small></small></span></div><div class="skin-signature"></div><div class="skin-sparkles"><i></i><i></i><i></i><i></i></div><div class="skin-polaroid"></div>';
      document.body.appendChild(chrome);
    }
    chrome.querySelector('.skin-brand b').textContent = payload.name;
    chrome.querySelector('.skin-brand small').textContent = payload.summary;
    chrome.querySelector('.skin-signature').textContent = payload.signature || '';
    chrome.classList.toggle('skin-home-shell', Boolean(home));
    const syncChromeGeometry = () => {
      const shellBox = shellMain.getBoundingClientRect();
      chrome.style.left = Math.round(shellBox.left) + 'px';
      chrome.style.top = Math.round(shellBox.top) + 'px';
      chrome.style.width = Math.round(shellBox.width) + 'px';
      chrome.style.height = Math.round(shellBox.height) + 'px';
      const composer = home?.querySelector('.composer-surface-chrome');
      if (composer) {
        const composerBox = composer.getBoundingClientRect();
        chrome.style.setProperty('--codex-skin-composer-top', Math.round(composerBox.top - shellBox.top) + 'px');
      } else {
        chrome.style.removeProperty('--codex-skin-composer-top');
      }
    };
    syncChromeGeometry();
    const resizeObserver = new ResizeObserver(syncChromeGeometry);
    resizeObserver.observe(shellMain);
    if (home) resizeObserver.observe(home);
    state.resizeObserver = resizeObserver;

    const existingPet = document.getElementById('codex-skin-studio-pet');
    if (payload.petName) {
      const pet = existingPet || document.createElement('div');
      pet.id = 'codex-skin-studio-pet';
      pet.setAttribute('role', 'img');
      pet.setAttribute('aria-label', payload.petName);
      if (!pet.parentElement) document.body.appendChild(pet);
    } else {
      existingPet?.remove();
    }
    return 'injected';
  })()`;
}

export async function evaluateTarget(webSocketUrl, expression, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('CDP evaluation timed out'));
    }, timeoutMs);
    socket.addEventListener('open', () => socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true },
    })));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      socket.close();
      if (message.error || message.result?.exceptionDetails) reject(new Error('CDP rejected the skin injection'));
      else resolve(message.result?.result?.value);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Could not connect to the Codex CDP target'));
    });
  });
}
