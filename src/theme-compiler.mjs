import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BUNDLE_SCHEMA_VERSION, paths } from './constants.mjs';
import { assertDesignSpec } from './design-spec.mjs';
import { assertSkinSpec } from './skin-spec.mjs';
import { copyFileAtomic, ensureDir, exists, safeSlug, sha256, writeFileAtomic, writeJsonAtomic } from './io.mjs';
import { inspectImage, validatePetSpritesheet } from './image-info.mjs';

export const BACKGROUND_PLACEHOLDER = '__CODEX_SKIN_BACKGROUND_DATA_URL__';
export const ICONS_PLACEHOLDER = '__CODEX_SKIN_ICONS_DATA_URL__';
export const PET_PLACEHOLDER = '__CODEX_SKIN_PET_DATA_URL__';
const BACKGROUND_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const BACKGROUND_MAX_BYTES = 20 * 1024 * 1024;

function colorScheme(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.45 ? 'light' : 'dark';
}

function hexRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function cssContent(value) {
  return JSON.stringify(String(value).replace(/[\r\n]+/g, ' ').trim());
}

export function codexNativeTokenCss(palette) {
  const p = palette;
  return `:root.codex-skin-studio-active {
  --color-token-foreground: ${p.text};
  --color-token-description-foreground: ${p.mutedText};
  --color-token-disabled-foreground: ${hexRgba(p.mutedText, 0.56)};
  --color-token-text-primary: ${p.text};
  --color-token-text-secondary: ${p.mutedText};
  --color-token-dropdown-background: ${p.surface};
  --color-token-dropdown-foreground: ${p.text};
  --color-token-border: ${hexRgba(p.border, 0.74)};
  --color-token-border-default: ${hexRgba(p.border, 0.82)};
  --color-token-border-heavy: ${p.border};
  --color-token-border-light: ${hexRgba(p.border, 0.48)};
  --color-token-menu-border: ${hexRgba(p.border, 0.68)};
  --color-token-main-surface-primary: ${p.surface};
  --color-token-bg-primary: ${p.background};
  --color-token-bg-secondary: ${p.surface};
  --color-token-bg-tertiary: ${p.surfaceAlt};
  --color-token-editor-background: ${p.background};
  --color-token-editor-foreground: ${p.text};
  --color-token-editor-widget-background: ${p.surface};
  --color-token-input-background: ${p.surface};
  --color-token-input-foreground: ${p.text};
  --color-token-input-placeholder-foreground: ${p.mutedText};
  --color-token-input-border: ${hexRgba(p.border, 0.72)};
  --color-token-list-hover-background: ${hexRgba(p.accent, 0.14)};
  --color-token-list-active-selection-background: ${hexRgba(p.accent, 0.22)};
  --color-token-side-bar-background: ${p.surface};
}`;
}

function cssFor(spec, { includePet = true, includeGeneratedIcons = false } = {}) {
  const p = spec.palette;
  const e = spec.effects;
  const c = spec.copy;
  const suggestionButtons = '.codex-skin-home [class~=\"group/home-suggestions\"] button, .codex-skin-home button[data-skin-suggestion-index]';
  const petCss = includePet ? `
#codex-skin-studio-pet {
  position: fixed;
  right: 24px;
  bottom: 20px;
  z-index: 2147483646;
  width: 96px;
  height: 104px;
  pointer-events: none;
  image-rendering: pixelated;
  background-image: url("${PET_PLACEHOLDER}");
  background-size: 768px 936px;
  background-repeat: no-repeat;
  animation: codex-skin-pet-idle 1100ms steps(6) infinite;
  filter: drop-shadow(0 8px 12px rgba(0,0,0,.25));
}
@keyframes codex-skin-pet-idle { from { background-position: 0 0; } to { background-position: -576px 0; } }
@media (prefers-reduced-motion: reduce) { #codex-skin-studio-pet { animation: none; } }
` : '';
  const iconCss = includeGeneratedIcons ? `
:is(${suggestionButtons})::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 14px;
  width: 46px;
  height: 46px;
  transform: translateX(-50%);
  border-radius: 15px;
  background-image: url("${ICONS_PLACEHOLDER}") !important;
  background-size: 200% 200% !important;
  background-repeat: no-repeat !important;
  background-color: var(--codex-skin-surface-alt) !important;
  box-shadow: 0 6px 15px ${hexRgba(p.text, 0.18)}, 0 0 0 4px ${hexRgba(p.accent, 0.12)};
  pointer-events: none;
}
:is(${suggestionButtons}) svg { opacity: 0 !important; }
.codex-skin-home button[data-skin-suggestion-index="0"]::before { background-position: 0 0 !important; }
.codex-skin-home button[data-skin-suggestion-index="1"]::before { background-position: 100% 0 !important; }
.codex-skin-home button[data-skin-suggestion-index="2"]::before { background-position: 0 100% !important; }
.codex-skin-home button[data-skin-suggestion-index="3"]::before { background-position: 100% 100% !important; }
` : '';
  return `/* Generated by Codex Skin Studio. */
:root.codex-skin-studio-active {
  color-scheme: ${colorScheme(p.background)};
  --codex-skin-background: ${p.background};
  --codex-skin-surface: ${p.surface};
  --codex-skin-surface-alt: ${p.surfaceAlt};
  --codex-skin-text: ${p.text};
  --codex-skin-muted-text: ${p.mutedText};
  --codex-skin-accent: ${p.accent};
  --codex-skin-accent-alt: ${p.accentAlt};
  --codex-skin-border: ${p.border};
  --codex-skin-radius: ${e.radius}px;
}
${codexNativeTokenCss(p)}
:root.codex-skin-studio-active body {
  color: var(--codex-skin-text) !important;
  background:
    radial-gradient(circle at 82% 8%, ${hexRgba(p.accentAlt, 0.20)}, transparent 30%),
    radial-gradient(circle at 18% 3%, ${hexRgba(p.accent, 0.16)}, transparent 28%),
    var(--codex-skin-background) !important;
}
:root.codex-skin-studio-active body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: .28;
  background-image: radial-gradient(circle, ${hexRgba(p.accentAlt, 0.42)} 0 1px, transparent 1.5px);
  background-size: 38px 38px;
}
:root.codex-skin-studio-active aside.app-shell-left-panel {
  color: var(--codex-skin-text) !important;
  background: linear-gradient(180deg, ${hexRgba(p.surface, 0.98)}, ${hexRgba(p.surfaceAlt, 0.97)}) !important;
  border-color: var(--codex-skin-border) !important;
  border-left: 0 !important;
  border-radius: 0 calc(var(--codex-skin-radius) + 6px) calc(var(--codex-skin-radius) + 6px) 0 !important;
  box-shadow: 10px 0 30px ${hexRgba(p.accent, 0.09)} !important;
  backdrop-filter: none !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel nav { background: transparent !important; }
:root.codex-skin-studio-active aside.app-shell-left-panel nav :is(button, a, [role="button"], span, p, div),
:root.codex-skin-studio-active aside.app-shell-left-panel button,
:root.codex-skin-studio-active aside.app-shell-left-panel [aria-current="page"] * {
  color: var(--codex-skin-text) !important;
  text-shadow: none !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel nav :is(span, p),
:root.codex-skin-studio-active aside.app-shell-left-panel button :is(span, p) { opacity: 1 !important; }
:root.codex-skin-studio-active aside.app-shell-left-panel nav svg {
  color: var(--codex-skin-accent) !important;
  opacity: .92 !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel nav :is(button, a, [role="button"]) { opacity: 1 !important; }
:root.codex-skin-studio-active aside.app-shell-left-panel button:hover {
  background: linear-gradient(90deg, ${hexRgba(p.accent, 0.18)}, ${hexRgba(p.accentAlt, 0.14)}) !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label^="切换模式"],
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label^="Switch mode"] {
  color: var(--codex-skin-accent) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-weight: 700 !important;
  text-shadow: 0 2px 12px ${hexRgba(p.accentAlt, 0.28)};
}
:root.codex-skin-studio-active aside.app-shell-left-panel button.skin-new-task {
  width: calc(100% - 4px) !important;
  margin: 2px 2px 8px !important;
  border-radius: 999px !important;
  color: ${p.background} !important;
  background: linear-gradient(135deg, var(--codex-skin-accent), var(--codex-skin-accent-alt)) !important;
  box-shadow: 0 7px 18px ${hexRgba(p.accent, 0.28)}, inset 0 1px ${hexRgba(p.text, 0.44)} !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel button.skin-new-task * { color: ${p.background} !important; }
:root.codex-skin-studio-active aside.app-shell-left-panel [class~="group/nav-section-title"] {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed ${hexRgba(p.accent, 0.32)};
}
:root.codex-skin-studio-active aside.app-shell-left-panel [class~="group/nav-section-title"] [class~="group/section-toggle"] {
  color: var(--codex-skin-accent) !important;
  font-size: 11px !important;
  font-weight: 750 !important;
  letter-spacing: .1em !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label="打开个人资料菜单"],
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label="Open profile menu"] {
  position: relative !important;
  padding-right: 72px !important;
  border: 0 !important;
  border-radius: calc(var(--codex-skin-radius) + 2px) !important;
  background: linear-gradient(135deg, ${hexRgba(p.surface, 0.98)}, ${hexRgba(p.accentAlt, 0.18)}) !important;
  box-shadow: 0 6px 16px ${hexRgba(p.text, 0.12)}, inset 0 1px ${hexRgba(p.text, 0.08)} !important;
}
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label="打开个人资料菜单"]::after,
:root.codex-skin-studio-active aside.app-shell-left-panel button[aria-label="Open profile menu"]::after {
  content: ${cssContent(c.profileBadge)};
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--codex-skin-accent-alt);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .06em;
  pointer-events: none;
}
:root.codex-skin-studio-active aside.app-shell-left-panel [class~="bg-token-list-hover-background"],
:root.codex-skin-studio-active aside.app-shell-left-panel [aria-current="page"] {
  background: linear-gradient(90deg, ${hexRgba(p.accent, 0.24)}, ${hexRgba(p.accentAlt, 0.19)}) !important;
  border-color: transparent !important;
}
:root.codex-skin-studio-active main.main-surface {
  position: relative !important;
  color: var(--codex-skin-text) !important;
  background:
    radial-gradient(circle at 84% 10%, ${hexRgba(p.accentAlt, 0.17)}, transparent 31%),
    linear-gradient(180deg, ${hexRgba(p.background, 0.98)}, ${hexRgba(p.surfaceAlt, 0.96)}) !important;
  border-color: var(--codex-skin-border) !important;
  border-right: 0 !important;
  border-bottom: 0 !important;
  border-radius: calc(var(--codex-skin-radius) + 6px) 0 0 0 !important;
  box-shadow: -8px 0 30px ${hexRgba(p.accent, 0.07)} !important;
  overflow: hidden !important;
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell)::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 47px 0 0;
  pointer-events: none;
  opacity: ${Math.max(0.06, Math.min(0.18, e.overlayOpacity * 0.32)).toFixed(2)};
  background: url("${BACKGROUND_PLACEHOLDER}") no-repeat ${e.backgroundPosition} / cover;
  filter: blur(${Math.min(e.blur, 12)}px) saturate(.72) contrast(.94);
  transform: scale(1.025);
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell)::after {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 47px 0 0;
  pointer-events: none;
  background: linear-gradient(90deg, ${hexRgba(p.background, 0.93)}, ${hexRgba(p.background, 0.79)} 54%, ${hexRgba(p.surface, 0.68)});
}
:root.codex-skin-studio-active main.main-surface > * { position: relative; z-index: 1; }
:root.codex-skin-studio-active main.main-surface > header.app-header-tint {
  background: linear-gradient(90deg, ${hexRgba(p.surface, 0.96)}, ${hexRgba(p.surfaceAlt, 0.90)}, ${hexRgba(p.accentAlt, 0.13)}) !important;
  border-bottom: 1px solid var(--codex-skin-border) !important;
  backdrop-filter: none !important;
}
:root.codex-skin-studio-active [role="main"] {
  color: var(--codex-skin-text) !important;
  background: transparent !important;
  scrollbar-color: ${hexRgba(p.accent, 0.48)} transparent;
}
#codex-skin-studio-chrome {
  position: fixed;
  z-index: 31;
  overflow: hidden;
  border-radius: calc(var(--codex-skin-radius) + 6px) 0 0 0;
  pointer-events: none;
}
#codex-skin-studio-chrome .skin-brand {
  position: absolute;
  left: 24px;
  top: 5px;
  display: none;
  align-items: center;
  gap: 9px;
  color: var(--codex-skin-accent);
  text-shadow: 0 1px ${hexRgba(p.surface, 0.75)};
}
#codex-skin-studio-chrome.skin-home-shell .skin-brand { display: flex; }
#codex-skin-studio-chrome .skin-brand-mark { font-size: 24px; }
#codex-skin-studio-chrome .skin-brand b { display: block; max-width: 360px; font-size: 14px; letter-spacing: .03em; }
#codex-skin-studio-chrome .skin-brand small { display: block; max-width: 460px; margin-top: 1px; color: var(--codex-skin-muted-text); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#codex-skin-studio-chrome .skin-signature {
  position: absolute;
  right: 28px;
  top: 8px;
  display: none;
  color: var(--codex-skin-accent);
  font: italic 18px/1 Georgia, "Times New Roman", serif;
  letter-spacing: .04em;
  text-shadow: 0 2px 12px ${hexRgba(p.accentAlt, 0.30)};
}
#codex-skin-studio-chrome.skin-home-shell .skin-signature { display: block; }
#codex-skin-studio-chrome .skin-sparkles { position: absolute; inset: 48px 0 0; display: none; opacity: .65; }
#codex-skin-studio-chrome.skin-home-shell .skin-sparkles { display: block; }
#codex-skin-studio-chrome .skin-sparkles i { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: white; box-shadow: 0 0 10px 3px ${hexRgba(p.accentAlt, 0.56)}; }
#codex-skin-studio-chrome .skin-sparkles i:nth-child(1) { left: 9%; top: 12%; }
#codex-skin-studio-chrome .skin-sparkles i:nth-child(2) { left: 34%; top: 7%; }
#codex-skin-studio-chrome .skin-sparkles i:nth-child(3) { left: 61%; top: 18%; }
#codex-skin-studio-chrome .skin-sparkles i:nth-child(4) { left: 86%; top: 10%; }
#codex-skin-studio-chrome .skin-polaroid {
  position: absolute;
  right: clamp(14px, 1.5vw, 28px);
  top: clamp(150px, calc(var(--codex-skin-composer-top, 100%) - 150px), calc(100% - 142px));
  width: clamp(84px, 6.3vw, 112px);
  aspect-ratio: 4 / 5;
  display: none;
  background-image: url("${BACKGROUND_PLACEHOLDER}");
  background-size: cover;
  background-position: ${e.focalX}% ${e.focalY}%;
  border: 7px solid ${hexRgba(p.surface, 0.97)};
  border-bottom-width: 18px;
  box-shadow: 0 9px 20px ${hexRgba(p.text, 0.20)}, 0 0 0 1px var(--codex-skin-border);
  transform: rotate(-4deg);
  transform-origin: 100% 100%;
  transition: opacity .18s ease-out, transform .18s ease-out;
}
#codex-skin-studio-chrome.skin-home-shell .skin-polaroid { display: block; }
.codex-skin-home {
  --thread-content-max-width: min(950px, calc(100cqw - 44px)) !important;
  overflow-x: hidden !important;
}
.codex-skin-home > div:first-child { padding-top: 15px !important; min-height: 100% !important; }
.codex-skin-home > div:first-child > div:first-child {
  flex: 0 0 470px !important;
  min-height: 470px !important;
  align-items: flex-start !important;
  padding-bottom: 0 !important;
}
.codex-skin-home > div:first-child > div:first-child > div:first-child {
  position: relative !important;
  isolation: isolate;
  width: calc(100% - 44px) !important;
  max-width: none !important;
  height: 292px !important;
  min-height: 292px !important;
  flex: 0 1 auto !important;
  padding: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: calc(var(--codex-skin-radius) + 10px) !important;
  background-image:
    linear-gradient(90deg, ${hexRgba(p.background, 0.98)} 0%, ${hexRgba(p.background, 0.88)} 42%, ${hexRgba(p.background, 0.24)} 72%, transparent 100%),
    url("${BACKGROUND_PLACEHOLDER}") !important;
  background-repeat: no-repeat !important;
  background-size: 100% 100%, auto 118% !important;
  background-position: center, right ${e.focalY}% !important;
  box-shadow: 0 14px 34px ${hexRgba(p.text, 0.17)}, inset 0 0 0 4px ${hexRgba(p.surface, 0.18)} !important;
}
.codex-skin-home > div:first-child > div:first-child > div:first-child > div:first-child {
  position: relative;
  z-index: 1;
  height: 100%;
  align-items: center !important;
  justify-content: flex-start !important;
  padding-left: 38px;
}
.codex-skin-home > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child {
  width: 54% !important;
  align-items: flex-start !important;
  gap: 0 !important;
}
.codex-skin-home [data-testid="home-icon"] { display: none !important; }
.codex-skin-home [data-feature="game-source"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  max-width: 100% !important;
  color: var(--codex-skin-text) !important;
  font-size: 0 !important;
  line-height: 1.3 !important;
  font-weight: 760 !important;
  text-align: left !important;
  text-shadow: 0 2px 13px ${hexRgba(p.surface, 0.55)};
  opacity: 1 !important;
}
.codex-skin-home [data-feature="game-source"]::before {
  content: ${cssContent(c.heroTitle)};
  display: block;
  max-width: 640px;
  color: var(--codex-skin-text);
  font-size: clamp(24px, 2.25vw, 34px);
  line-height: 1.22;
  font-weight: 780;
}
.codex-skin-home [data-feature="game-source"]::after {
  content: ${cssContent(c.heroSubtitle)};
  display: block;
  max-width: 640px;
  margin-top: 13px;
  color: var(--codex-skin-muted-text);
  font-size: clamp(12px, 1.05vw, 16px);
  font-weight: 500;
  letter-spacing: .01em;
  text-shadow: none;
}
.codex-skin-home [data-feature="game-source"] button { display: none !important; }
.codex-skin-home > div:first-child > div:first-child > div:first-child > div:nth-child(2) {
  left: 14px !important;
  right: 14px !important;
  top: 100% !important;
  margin-top: 13px !important;
}
.codex-skin-home [class~="group/home-suggestions"] { overflow: visible !important; }
:is(${suggestionButtons}) {
  position: relative !important;
  min-height: 126px !important;
  padding: 66px 13px 12px !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  border: 0 !important;
  border-radius: calc(var(--codex-skin-radius) + 7px) !important;
  background:
    radial-gradient(circle at 50% 24%, ${hexRgba(p.surface, 0.98)}, transparent 35%),
    linear-gradient(145deg, ${hexRgba(p.surface, 0.98)}, ${hexRgba(p.surfaceAlt, 0.96)}) !important;
  color: var(--codex-skin-text) !important;
  font-weight: 620 !important;
  line-height: 1.45 !important;
  box-shadow: 0 8px 18px ${hexRgba(p.text, 0.10)}, inset 0 0 0 3px ${hexRgba(p.surface, 0.45)} !important;
  transition: transform .18s ease, box-shadow .18s ease !important;
}
:is(${suggestionButtons}):hover { transform: translateY(-4px) !important; box-shadow: 0 13px 26px ${hexRgba(p.accent, 0.18)} !important; }
:is(${suggestionButtons}) > * {
  width: 100% !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
  color: var(--codex-skin-text) !important;
}
:is(${suggestionButtons}) > :not(.skin-card-copy) { opacity: 0 !important; }
:is(${suggestionButtons}) > .skin-card-copy {
  position: absolute !important;
  left: 12px !important;
  right: 12px !important;
  top: 69px !important;
  bottom: 10px !important;
  z-index: 2;
  display: flex !important;
  width: auto !important;
  flex-direction: column !important;
  justify-content: center !important;
  gap: 3px !important;
  opacity: 1 !important;
  pointer-events: none;
}
:is(${suggestionButtons}) > .skin-card-copy b {
  color: var(--codex-skin-text) !important;
  font-size: 13px !important;
  font-weight: 720 !important;
  line-height: 1.25 !important;
}
:is(${suggestionButtons}) > .skin-card-copy small {
  color: var(--codex-skin-muted-text) !important;
  font-size: 10.5px !important;
  font-weight: 520 !important;
  line-height: 1.3 !important;
  opacity: .96 !important;
}
:is(${suggestionButtons}):not(:has(> .skin-card-copy))::after {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 11px;
  color: var(--codex-skin-muted-text);
  font-size: 9.5px;
  font-weight: 500;
  line-height: 1.35;
  text-align: center;
  pointer-events: none;
}
.codex-skin-home button[data-skin-suggestion-index="0"]:not(:has(> .skin-card-copy))::after { content: ${cssContent(c.cardSubtitles[0])}; }
.codex-skin-home button[data-skin-suggestion-index="1"]:not(:has(> .skin-card-copy))::after { content: ${cssContent(c.cardSubtitles[1])}; }
.codex-skin-home button[data-skin-suggestion-index="2"]:not(:has(> .skin-card-copy))::after { content: ${cssContent(c.cardSubtitles[2])}; }
.codex-skin-home button[data-skin-suggestion-index="3"]:not(:has(> .skin-card-copy))::after { content: ${cssContent(c.cardSubtitles[3])}; }
:root.codex-skin-studio-active .composer-surface-chrome {
  border: 0 !important;
  border-radius: calc(var(--codex-skin-radius) + 8px) !important;
  background:
    radial-gradient(circle at 88% 22%, ${hexRgba(p.surface, 0.93)}, transparent 24%),
    linear-gradient(145deg, ${hexRgba(p.surface, 0.98)}, ${hexRgba(p.surfaceAlt, 0.96)}) !important;
  box-shadow: 0 10px 25px ${hexRgba(p.text, 0.13)}, inset 0 0 0 4px ${hexRgba(p.surface, 0.32)} !important;
  backdrop-filter: none !important;
  overflow: visible !important;
}
:root.codex-skin-studio-active .composer-surface-chrome button[class~="size-token-button-composer"] {
  color: ${p.background} !important;
  background: linear-gradient(135deg, var(--codex-skin-accent), var(--codex-skin-accent-alt)) !important;
  box-shadow: 0 4px 13px ${hexRgba(p.accent, 0.32)} !important;
}
:root.codex-skin-studio-active .codex-skin-home .ProseMirror p[data-placeholder]::after {
  content: ${cssContent(c.composerPlaceholder)} !important;
  color: var(--codex-skin-muted-text) !important;
}
:is(.codex-skin-home .skin-project-toolbar, .codex-skin-home div:has(> .horizontal-scroll-fade-mask [class~="group/project-selector"])) {
  position: relative;
  padding-top: 28px !important;
  border: 0 !important;
  background: linear-gradient(180deg, ${hexRgba(p.surface, 0.96)}, ${hexRgba(p.surfaceAlt, 0.92)}) !important;
  color: var(--codex-skin-text) !important;
  box-shadow: inset 0 1px ${hexRgba(p.accent, 0.16)} !important;
}
:is(.codex-skin-home .skin-project-toolbar, .codex-skin-home div:has(> .horizontal-scroll-fade-mask [class~="group/project-selector"]))::before {
  content: ${cssContent(`✦  ${c.projectLabel}`)};
  position: absolute;
  left: 13px;
  top: 6px;
  color: var(--codex-skin-accent);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.codex-skin-home .skin-project-toolbar * { color: var(--codex-skin-text) !important; }
.codex-skin-home [class~="group/project-selector"] > button {
  border: 0 !important;
  background: linear-gradient(135deg, ${hexRgba(p.surface, 0.96)}, ${hexRgba(p.surfaceAlt, 0.90)}) !important;
  color: var(--codex-skin-text) !important;
}
:root.codex-skin-studio-active a,
:root.codex-skin-studio-active [aria-current="page"] {
  color: var(--codex-skin-accent) !important;
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell) pre {
  color: var(--codex-skin-text) !important;
  background: ${hexRgba(p.surface, 0.94)} !important;
  border-color: ${hexRgba(p.border, 0.72)} !important;
  box-shadow: 0 8px 24px ${hexRgba(p.background, 0.22)} !important;
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell) :is(code, kbd) { color: var(--codex-skin-text) !important; }
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell) :is(article, [data-message-author-role]) {
  color: var(--codex-skin-text) !important;
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell) blockquote {
  color: var(--codex-skin-muted-text) !important;
  border-color: var(--codex-skin-accent) !important;
}
:root.codex-skin-studio-active main.main-surface:not(.skin-home-shell) ::selection { background: ${hexRgba(p.accent, 0.34)}; }
:root.skin-layout-fullscreen.codex-skin-studio-active main.main-surface.skin-home-shell {
  background: linear-gradient(145deg, var(--codex-skin-background), var(--codex-skin-surface-alt)) !important;
}
:root.skin-layout-fullscreen .codex-skin-home { position: relative !important; --thread-content-max-width: min(1040px, calc(100cqw - 64px)) !important; }
:root.skin-layout-fullscreen .codex-skin-home > div:first-child { position: relative !important; display: block !important; min-height: 100% !important; padding: 0 !important; }
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:first-child {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
}
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:first-child > div:first-child {
  position: absolute !important;
  inset: 14px 16px 16px !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  background-image:
    linear-gradient(90deg, ${hexRgba(p.background, Math.max(0.72, e.overlayOpacity + 0.45))} 0%, ${hexRgba(p.background, Math.max(0.42, e.overlayOpacity))} 48%, ${hexRgba(p.background, 0.08)} 78%, transparent 100%),
    url("${BACKGROUND_PLACEHOLDER}") !important;
  background-size: cover !important;
  background-position: ${e.focalX}% ${e.focalY}% !important;
}
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:first-child > div:first-child > div:first-child {
  height: auto !important;
  inset: 0 !important;
  align-items: flex-start !important;
  padding: clamp(74px, 13cqh, 122px) 0 0 clamp(32px, 4.6cqw, 72px) !important;
}
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child { width: min(49%, 640px) !important; }
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:first-child > div:first-child > div:nth-child(2) {
  left: clamp(18px, 2.2cqw, 34px) !important;
  right: clamp(18px, 2.2cqw, 34px) !important;
  top: 49% !important;
  z-index: 4;
  margin-top: 0 !important;
}
:root.skin-layout-fullscreen :is(${suggestionButtons}) {
  background: linear-gradient(150deg, ${hexRgba(p.surface, 0.92)}, ${hexRgba(p.surfaceAlt, 0.86)}) !important;
  backdrop-filter: blur(${Math.max(10, e.blur)}px) !important;
}
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:nth-child(2) {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 8;
  flex: none !important;
  min-height: 0 !important;
  justify-content: flex-end !important;
  margin: 0 !important;
  padding: 0 !important;
}
:root.skin-layout-fullscreen .codex-skin-home > div:first-child > div:nth-child(2) > div:last-child { padding-top: 0 !important; padding-bottom: 16px !important; }
:root.skin-layout-fullscreen #codex-skin-studio-chrome .skin-polaroid { display: none !important; }
@media (max-width: 1120px) {
  #codex-skin-studio-chrome .skin-polaroid { opacity: 0; transform: rotate(-2deg) scale(.84); }
  .codex-skin-home { --thread-content-max-width: min(860px, calc(100cqw - 30px)) !important; }
  .codex-skin-home > div:first-child > div:first-child > div:first-child { width: calc(100% - 28px) !important; }
}
@media (max-width: 900px) {
  .codex-skin-home > div:first-child > div:first-child { flex-basis: 430px !important; min-height: 430px !important; }
  .codex-skin-home > div:first-child > div:first-child > div:first-child { height: 260px !important; min-height: 260px !important; }
  :is(${suggestionButtons}) { min-height: 114px !important; font-size: 12px !important; }
}
${petCss}
${iconCss}
`;
}

export async function compileBundle({ spec, images, backgroundImage, iconSheet, petSpritesheet, outputDirectory, skinOnly = false }) {
  if (skinOnly) assertSkinSpec(spec);
  else assertDesignSpec(spec);
  if (!Array.isArray(images) || !images[spec.sourceImageIndex]) throw new Error('The selected background image is missing');
  const selectedImage = path.resolve(backgroundImage || images[spec.sourceImageIndex]);
  const selectedExtension = path.extname(selectedImage).toLowerCase();
  if (!BACKGROUND_EXTENSIONS.has(selectedExtension)) throw new Error('Background must be PNG, JPEG, or WebP');
  const backgroundStat = await fs.stat(selectedImage);
  if (!backgroundStat.isFile() || backgroundStat.size > BACKGROUND_MAX_BYTES) throw new Error('Background must be a file no larger than 20 MiB');
  const id = `${safeSlug(spec.name)}-${crypto.randomUUID().slice(0, 8)}`;
  const target = path.resolve(outputDirectory || path.join(paths().bundles, id));
  if (await exists(target)) throw new Error(`Output directory already exists: ${target}`);
  await ensureDir(path.dirname(target));
  const staging = `${target}.stage.${process.pid}.${crypto.randomUUID().slice(0, 8)}`;
  await ensureDir(staging);

  try {
    const designRelative = 'design.json';
    const cssRelative = 'theme.css';
    const backgroundExtension = selectedExtension;
    const backgroundRelative = `assets/background${backgroundExtension}`;
    await copyFileAtomic(selectedImage, path.join(staging, backgroundRelative));
    await writeJsonAtomic(path.join(staging, designRelative), spec);
    await writeFileAtomic(path.join(staging, cssRelative), cssFor(spec, { includePet: !skinOnly, includeGeneratedIcons: Boolean(iconSheet) }));

    let icons = null;
    if (iconSheet) {
      const sourceIcons = path.resolve(iconSheet);
      const iconInfo = await inspectImage(sourceIcons);
      if (iconInfo.width < 768 || iconInfo.height < 768) throw new Error('Generated icon atlas must be at least 768x768');
      const extension = iconInfo.format === 'png' ? '.png' : '.webp';
      const relative = `assets/icons${extension}`;
      await copyFileAtomic(sourceIcons, path.join(staging, relative));
      icons = { path: relative, sha256: await sha256(path.join(staging, relative)), width: iconInfo.width, height: iconInfo.height };
    }

    let pet = null;
    if (!skinOnly) {
      if (!petSpritesheet) {
        throw new Error('A real validated pet spritesheet is required; generate it in Pet Studio before compiling a combined bundle');
      }
      const info = await validatePetSpritesheet(petSpritesheet);
      const extension = info.format === 'png' ? '.png' : '.webp';
      const relative = `pet/spritesheet${extension}`;
      const stagedSpritesheet = path.join(staging, relative);
      await copyFileAtomic(path.resolve(petSpritesheet), stagedSpritesheet);
      const metadataRelative = 'pet/pet.json';
      await writeJsonAtomic(path.join(staging, metadataRelative), {
        id: spec.pet.slug,
        displayName: spec.pet.name,
        description: spec.pet.concept,
        spritesheetPath: `spritesheet${extension}`,
      });
      pet = {
        slug: spec.pet.slug,
        name: spec.pet.name,
        metadata: metadataRelative,
        metadataSha256: await sha256(path.join(staging, metadataRelative)),
        spritesheet: relative,
        sha256: await sha256(path.join(staging, relative)),
        width: info.width,
        height: info.height,
        format: info.format,
        generated: false,
        archetype: null,
      };
    }

    const manifest = {
      schemaVersion: BUNDLE_SCHEMA_VERSION,
      kind: skinOnly ? 'skin' : 'skin-pet',
      id,
      name: spec.name,
      summary: spec.summary,
      createdAt: new Date().toISOString(),
      ready: true,
      design: designRelative,
      theme: {
        css: cssRelative,
        background: backgroundRelative,
        backgroundSha256: await sha256(path.join(staging, backgroundRelative)),
        icons,
      },
      pet,
    };
    await writeJsonAtomic(path.join(staging, 'manifest.json'), manifest);
    await fs.rename(staging, target);
    return { directory: target, manifest };
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}
