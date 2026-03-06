/**
 * T008 [US2]: Unit tests for SN_THEME brand constants.
 * Verifies all required keys, correct values, semantic color preservation,
 * and WCAG 2.1 AA contrast ratios for key color pairings.
 */

import { describe, it, expect } from 'vitest';
import { SN_THEME } from '../../src/renderer/theme';

/** Calculate relative luminance of a hex color per WCAG 2.1 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Calculate contrast ratio between two hex colors */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('SN_THEME — brand token values', () => {
  it('exports navBackground as ServiceNow dark teal #293e40', () => {
    expect(SN_THEME.navBackground).toBe('#293e40');
  });

  it('exports navActiveBackground as ServiceNow Now Green #62d84e', () => {
    expect(SN_THEME.navActiveBackground).toBe('#62d84e');
  });

  it('exports navActiveText as dark navy #293e40 (dark text on green)', () => {
    expect(SN_THEME.navActiveText).toBe('#293e40');
  });

  it('exports navText as white #ffffff', () => {
    expect(SN_THEME.navText).toBe('#ffffff');
  });

  it('exports primaryButton as #62d84e', () => {
    expect(SN_THEME.primaryButton).toBe('#62d84e');
  });

  it('exports primaryButtonText as #293e40', () => {
    expect(SN_THEME.primaryButtonText).toBe('#293e40');
  });
});

describe('SN_THEME — semantic tokens preserved (FR-006)', () => {
  it('statusConnected is still #10b981 (not overridden by brand green)', () => {
    expect(SN_THEME.statusConnected).toBe('#10b981');
  });

  it('statusFailed is #ef4444', () => {
    expect(SN_THEME.statusFailed).toBe('#ef4444');
  });

  it('statusUnknown is #9ca3af', () => {
    expect(SN_THEME.statusUnknown).toBe('#9ca3af');
  });

  it('statusConnecting is #f59e0b', () => {
    expect(SN_THEME.statusConnecting).toBe('#f59e0b');
  });

  it('statusDegraded is #f97316', () => {
    expect(SN_THEME.statusDegraded).toBe('#f97316');
  });
});

describe('SN_THEME — WCAG 2.1 AA contrast ratios', () => {
  it('navText (#ffffff) on navBackground (#293e40) meets WCAG AA (≥4.5:1)', () => {
    const ratio = contrastRatio(SN_THEME.navText, SN_THEME.navBackground);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('navActiveText (#293e40) on navActiveBackground (#62d84e) meets WCAG AA (≥4.5:1)', () => {
    const ratio = contrastRatio(SN_THEME.navActiveText, SN_THEME.navActiveBackground);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
