const SENTENCE_END = /[.!?。！？]["'”’」』】）》]*$/u;

export function characterLength(value) {
  return [...value].length;
}

export function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && characterLength(value) <= max;
}

export function validateAssetPrompt(value, max, label, errors) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${label} must not be empty`);
    return;
  }
  const length = characterLength(value);
  if (length > max) errors.push(`${label} contains ${length} characters; maximum is ${max}`);
  if (!SENTENCE_END.test(value.trim())) {
    const finalCharacter = [...value.trim()].at(-1);
    errors.push(`${label} must end with sentence punctuation (. ! ? 。！？); final character is ${JSON.stringify(finalCharacter)}`);
  }
}
