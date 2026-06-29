import type { SiteStyleVariant } from './variant';

export type VariantText = Readonly<Record<SiteStyleVariant, string>>;

export type StyleText = string | VariantText;

export function defineStyleCopy<T extends Record<string, StyleText>>(copy: T): T {
  return copy;
}

export function selectStyleText(text: StyleText, variant: SiteStyleVariant): string {
  return typeof text === 'string' ? text : text[variant];
}

export function selectStyleTextList(
  texts: readonly StyleText[],
  variant: SiteStyleVariant,
): string[] {
  return texts.map((text) => selectStyleText(text, variant));
}
