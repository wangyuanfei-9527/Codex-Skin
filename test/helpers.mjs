import fs from 'node:fs/promises';

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}

export function pngHeader(width, height, colorType = 6) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.alloc(0)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function writePng(filePath, width, height, colorType = 6) {
  await fs.writeFile(filePath, pngHeader(width, height, colorType));
}

export function sampleSpec(overrides = {}) {
  const spec = {
    schemaVersion: 1,
    name: 'Aurora Harbor',
    summary: 'A calm blue-violet workspace with a matching otter.',
    sourceImageIndex: 0,
    palette: {
      background: '#101525', surface: '#18213A', surfaceAlt: '#202C4A', text: '#F2F5FF',
      mutedText: '#AEB9D6', accent: '#8FA7FF', accentAlt: '#66D9D0', border: '#39496D',
    },
    effects: { blur: 8, surfaceOpacity: 0.82, radius: 14, overlayOpacity: 0.28, backgroundPosition: 'center', focalX: 72, focalY: 28, layout: 'fullscreen' },
    copy: {
      heroTitle: 'Build with the aurora',
      heroSubtitle: 'Write calm, deliberate code beneath the aurora.',
      projectLabel: 'Choose a project',
      composerPlaceholder: 'Build something luminous…',
      cardSubtitles: ['Understand the codebase', 'Shape a new feature', 'Review with confidence', 'Find and repair defects'],
      signature: 'Aurora ✦',
    },
    assets: {
      subject: 'An original aurora harbor guide',
      motifs: ['aurora ribbons', 'water ripples', 'cyan shell'],
      heroPrompt: 'Create a wide aurora harbor illustration with the guide on the right and quiet copy space on the left.',
      iconPrompt: 'Create a 2x2 icon atlas using aurora ribbons, water ripples, a cyan shell, and a repair spark.',
    },
    pet: {
      name: 'Ripple', slug: 'ripple-otter', concept: 'A tiny blue-violet otter with a cyan shell charm.',
      states: {
        idle: 'Breathes gently.', running: 'Paddles through light.', waiting: 'Raises its charm.',
        success: 'Spins with sparkles.', failed: 'Curls around the dimmed charm.',
      },
    },
  };
  return { ...spec, ...overrides };
}
