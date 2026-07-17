import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLoopbackDebuggerUrl, buildDocumentReadyExpression, buildInjectionExpression } from '../src/windows/cdp.mjs';

test('accepts only the selected loopback CDP endpoint', () => {
  assert.equal(assertLoopbackDebuggerUrl('ws://127.0.0.1:9222/devtools/page/1', 9222), 'ws://127.0.0.1:9222/devtools/page/1');
  assert.throws(() => assertLoopbackDebuggerUrl('ws://192.168.1.2:9222/devtools/page/1', 9222), /non-loopback/);
  assert.throws(() => assertLoopbackDebuggerUrl('ws://127.0.0.1:9333/devtools/page/1', 9222), /non-loopback/);
});

test('encodes untrusted labels instead of interpolating them as JavaScript', () => {
  const dangerous = '`); globalThis.compromised = true; (`';
  const expression = buildInjectionExpression({ bundleId: 'test', css: 'body{}', petName: dangerous });
  assert.equal(expression.includes(dangerous), false);
  assert.equal(expression.includes('atob('), true);
});

test('marks the real suggestion cards and keeps their labels whitespace tolerant', () => {
  const expression = buildInjectionExpression({ bundleId: 'test', css: 'body{}' });
  assert.match(expression, /group\/home-suggestions/);
  assert.match(expression, /data-skin-suggestion-index/);
  assert.match(expression, /skin-card-copy/);
  assert.match(expression, /skin-project-toolbar/);
  assert.match(expression, /skin-thread-header/);
  assert.match(expression, /skin-thread-title/);
  assert.match(expression, /skin-thread-actions/);
  assert.match(expression, /skin-thread-location-group/);
  assert.match(expression, /Open location/);
  assert.match(expression, /skin-window-topbar/);
  assert.match(expression, /skin-rail-action/);
  assert.match(expression, /refreshPageContext/);
  assert.match(expression, /replace\(\/\\s\+\/g/);
  assert.match(expression, /MutationObserver/);
  assert.match(expression, /ResizeObserver/);
  const documentReadyExpression = buildDocumentReadyExpression(expression);
  assert.match(documentReadyExpression, /waiting-for-codex-shell/);
  assert.match(documentReadyExpression, /bootstrapObserver/);
  assert.doesNotThrow(() => new Function(documentReadyExpression));
});
