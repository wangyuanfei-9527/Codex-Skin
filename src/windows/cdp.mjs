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
      shellMain?.classList.remove('skin-settings-shell');
      document.querySelectorAll('.codex-skin-home').forEach(node => node.classList.remove('codex-skin-home'));
      document.querySelectorAll('.skin-home-shell').forEach(node => node.classList.remove('skin-home-shell'));
      document.querySelectorAll('.skin-new-task').forEach(node => node.classList.remove('skin-new-task'));
      document.querySelectorAll('.skin-project-toolbar').forEach(node => node.classList.remove('skin-project-toolbar'));
      document.querySelectorAll('.skin-thread-header').forEach(node => node.classList.remove('skin-thread-header'));
      document.querySelectorAll('.skin-thread-header-layout').forEach(node => node.classList.remove('skin-thread-header-layout'));
      document.querySelectorAll('.skin-thread-title-row').forEach(node => node.classList.remove('skin-thread-title-row'));
      document.querySelectorAll('.skin-thread-title').forEach(node => node.classList.remove('skin-thread-title'));
      document.querySelectorAll('.skin-thread-actions').forEach(node => node.classList.remove('skin-thread-actions'));
      document.querySelectorAll('.skin-thread-location-group').forEach(node => node.classList.remove('skin-thread-location-group'));
      document.querySelectorAll('.skin-window-topbar').forEach(node => node.classList.remove('skin-window-topbar'));
      document.querySelectorAll('.skin-rail-section-header').forEach(node => node.classList.remove('skin-rail-section-header'));
      document.querySelectorAll('.skin-rail-action').forEach(node => node.classList.remove('skin-rail-action'));
      document.querySelectorAll('.skin-card-copy').forEach(node => node.remove());
      document.querySelectorAll('[data-skin-generated-aria-label]').forEach(node => {
        node.removeAttribute('aria-label');
        node.removeAttribute('data-skin-generated-aria-label');
      });
      document.querySelectorAll('[data-skin-suggestion-index]').forEach(node => node.removeAttribute('data-skin-suggestion-index'));
      document.querySelectorAll('diffs-container').forEach(node => node.shadowRoot?.getElementById('codex-skin-review-diff-shadow')?.remove());
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

    let home = null;
    let resizeObserver = null;
    const refreshPageContext = () => {
      home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
      document.querySelectorAll('[role="main"].codex-skin-home').forEach(node => {
        if (node !== home) node.classList.remove('codex-skin-home');
      });
      if (home) home.classList.add('codex-skin-home');
      shellMain.classList.toggle('skin-home-shell', Boolean(home));
      document.getElementById('codex-skin-studio-chrome')?.classList.toggle('skin-home-shell', Boolean(home));
      if (home && resizeObserver) resizeObserver.observe(home);
    };

    const suggestionLabels = [
      ['探索并理解代码', 'Explore and understand code'],
      ['构建新功能', 'Build a new feature', 'Build new features'],
      ['审查代码', 'Review code'],
      ['修复问题', 'Fix an issue', 'Fix issues'],
    ];
    const newTaskLabels = ['新建任务', 'New task'];
    const settingsReturnLabels = ['返回应用', 'Back to app'];
    const railActionLabels = ['创建文件或站点', '附加文件或连接应用', 'Create file or site', 'Attach files or connect apps'];
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
      refreshPageContext();
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
      document.querySelectorAll('.skin-thread-header, .skin-thread-header-layout, .skin-thread-title-row, .skin-thread-title, .skin-thread-actions, .skin-thread-location-group, .skin-window-topbar, .skin-rail-section-header, .skin-rail-action').forEach(node => {
        node.classList.remove('skin-thread-header', 'skin-thread-header-layout', 'skin-thread-title-row', 'skin-thread-title', 'skin-thread-actions', 'skin-thread-location-group', 'skin-window-topbar', 'skin-rail-section-header', 'skin-rail-action');
      });
      const settingsVisible = settingsReturnLabels.some(label => (shellSidebar.textContent || '').includes(label));
      const settingsContent = settingsVisible
        ? shellMain.querySelector('.scrollbar-stable.flex-1.overflow-y-auto.p-panel')
        : null;
      shellMain.classList.toggle('skin-settings-shell', Boolean(settingsContent));
      for (const diffContainer of document.querySelectorAll('diffs-container')) {
        const shadowRoot = diffContainer.shadowRoot;
        if (!shadowRoot) continue;
        let reviewStyle = shadowRoot.getElementById('codex-skin-review-diff-shadow');
        if (!payload.reviewDiffCss) {
          reviewStyle?.remove();
          continue;
        }
        if (!reviewStyle) {
          reviewStyle = document.createElement('style');
          reviewStyle.id = 'codex-skin-review-diff-shadow';
          shadowRoot.appendChild(reviewStyle);
        }
        reviewStyle.textContent = payload.reviewDiffCss;
      }
      document.querySelector('[class~="group/application-menu-top-bar"]')?.classList.add('skin-window-topbar');
      for (const button of document.querySelectorAll('button[aria-label]')) {
        const label = button.getAttribute('aria-label') || '';
        if (!railActionLabels.some(candidate => label.includes(candidate))) continue;
        button.classList.add('skin-rail-action');
        button.closest('.sticky')?.classList.add('skin-rail-section-header');
      }
      const threadHeader = shellMain.querySelector(':scope > header.app-header-tint');
      const threadHeaderLayout = threadHeader?.querySelector('.draggable.grid.w-full');
      const threadTitleRow = threadHeaderLayout?.firstElementChild;
      const threadTitle = threadTitleRow?.firstElementChild;
      const locationLabels = ['打开位置', 'Open location'];
      const locationButton = [...(threadHeader?.querySelectorAll('button') || [])]
        .find(button => locationLabels.some(label => (button.textContent || '').includes(label)));
      const locationGroup = locationButton?.closest('.inline-flex');
      const threadActions = locationGroup?.closest('.ms-auto') || threadHeader?.querySelector('.ms-auto');
      threadHeader?.classList.add('skin-thread-header');
      threadHeaderLayout?.classList.add('skin-thread-header-layout');
      threadTitleRow?.classList.add('skin-thread-title-row');
      threadTitle?.classList.add('skin-thread-title');
      threadActions?.classList.add('skin-thread-actions');
      locationGroup?.classList.add('skin-thread-location-group');
    };
    markNativeControls();
    const scheduler = { timer: null };
    const observer = new MutationObserver(() => {
      if (scheduler.timer) clearTimeout(scheduler.timer);
      scheduler.timer = setTimeout(() => {
        markNativeControls();
        syncChromeGeometry();
      }, 120);
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
    resizeObserver = new ResizeObserver(syncChromeGeometry);
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

export function buildDocumentReadyExpression(expression) {
  return `(() => {
    const bootstrapKey = '__CODEX_SKIN_STUDIO_BOOTSTRAP__';
    const previousBootstrap = window[bootstrapKey];
    previousBootstrap?.observer?.disconnect();
    if (previousBootstrap?.timer) clearTimeout(previousBootstrap.timer);
    const applyWhenReady = () => {
      if (!document.querySelector('main.main-surface') || !document.querySelector('aside.app-shell-left-panel')) return false;
      return (${expression}) === 'injected';
    };
    if (applyWhenReady()) {
      delete window[bootstrapKey];
      return 'injected';
    }
    const bootstrapObserver = new MutationObserver(() => {
      if (!applyWhenReady()) return;
      bootstrapObserver.disconnect();
      clearTimeout(timer);
      delete window[bootstrapKey];
    });
    bootstrapObserver.observe(document.documentElement || document, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      bootstrapObserver.disconnect();
      delete window[bootstrapKey];
    }, 30_000);
    window[bootstrapKey] = { observer: bootstrapObserver, timer };
    return 'waiting-for-codex-shell';
  })()`;
}

export async function prepareTarget(webSocketUrl, expression, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Set([1, 2]);
    let currentResult;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(currentResult);
    };
    const timer = setTimeout(() => finish(new Error('CDP target preparation timed out')), timeoutMs);
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true },
      }));
      socket.send(JSON.stringify({
        id: 2,
        method: 'Page.addScriptToEvaluateOnNewDocument',
        params: { source: expression },
      }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!pending.has(message.id)) return;
      if (message.error || message.result?.exceptionDetails) {
        finish(new Error('CDP rejected the skin preparation'));
        return;
      }
      if (message.id === 1) currentResult = message.result?.result?.value;
      pending.delete(message.id);
      if (pending.size === 0) finish();
    });
    socket.addEventListener('error', () => finish(new Error('Could not connect to the Codex CDP target')));
  });
}
