import { ConvexError } from "convex/values";

export function requiredText(value: string, label: string, maxLength: number) {
  const text = value.trim();
  if (!text) throw new ConvexError(`${label} cannot be empty.`);
  if (text.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalText(value: string | undefined, maxLength: number) {
  const text = value?.trim();
  if (!text) return undefined;
  if (text.length > maxLength) {
    throw new ConvexError(`Value must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalHttpUrl(value: string | undefined) {
  const text = optionalText(value, 2048);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new ConvexError("Pull request link must be a valid HTTP or HTTPS URL.");
  }
}

export function validDeadline(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError("Choose a valid deadline.");
  }
  return value;
}
