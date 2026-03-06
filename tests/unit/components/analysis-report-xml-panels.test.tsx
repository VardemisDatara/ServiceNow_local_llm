/**
 * Unit tests for:
 *   - isXmlPayloadField() helper (T014)
 *   - ResultCard XML panel rendering (T015)
 * US3 — Expandable XML Sections on Security Tab
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── isXmlPayloadField — T014 ─────────────────────────────────────────────────

// We import the helper through the module. Since it's not exported, we test
// indirectly via ResultCard rendering, and also expose it for direct testing
// by importing from the module path (the function will be exported as named).
// If the function is module-private, all coverage comes from ResultCard tests.

describe('isXmlPayloadField', () => {
  // We'll test via dynamic import once the function is exported
  it('returns true for raw_xml key with XML value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', '<root><item/></root>')).toBe(true);
  });

  it('returns true for xml_payload key with XML value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('xml_payload', '<response>data</response>')).toBe(true);
  });

  it('returns true for work_notes_xml key with XML value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('work_notes_xml', '<notes>text</notes>')).toBe(true);
  });

  it('returns true for description_xml key with XML value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('description_xml', '<desc>blah</desc>')).toBe(true);
  });

  it('returns true for any key ending in _xml with XML value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('custom_payload_xml', '<data/>')).toBe(true);
  });

  it('returns false for known xml key but value does NOT start with <', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', 'plain text content')).toBe(false);
  });

  it('returns false for non-xml key even if value starts with <', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('description', '<b>bold text</b>')).toBe(false);
  });

  it('returns false for known xml key but empty string value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', '')).toBe(false);
  });

  it('returns false for known xml key but non-string value (number)', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', 42)).toBe(false);
  });

  it('returns false for known xml key but null value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', null)).toBe(false);
  });

  it('returns false for known xml key but undefined value', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', undefined)).toBe(false);
  });

  it('returns true for XML value with leading whitespace before <', async () => {
    const { isXmlPayloadField } = await import('../../../src/renderer/components/AnalysisReport');
    expect(isXmlPayloadField('raw_xml', '  <root/>')).toBe(true);
  });
});

// ─── ResultCard XML panel rendering — T015 ────────────────────────────────────

function makeResult(resultData: Record<string, unknown>, success = true) {
  return {
    id: 1,
    sessionId: 'session-1',
    incidentId: 1,
    toolName: 'test_tool',
    toolCategory: 'test',
    result: JSON.stringify(resultData),
    success,
    executionTimeMs: 100,
    confidence: 90,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };
}

describe('AnalysisReport — XML collapsible panels', () => {
  it('renders a <details> element for a raw_xml field containing XML', async () => {
    const { AnalysisReport } = await import('../../../src/renderer/components/AnalysisReport');
    const incident = {
      id: 1,
      sessionId: 'session-1',
      incidentId: 'SIR001',
      title: 'Test Incident',
      description: 'desc',
      severity: 'high' as const,
      status: 'analyzing' as const,
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    };
    const result = makeResult({ raw_xml: '<incident><id>SIR001</id></incident>', state: 'Open' });

    render(<AnalysisReport incident={incident} results={[result]} />);

    // Should render a details element (collapsed by default)
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    // Should NOT have open attribute by default
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('renders descriptive summary label for raw_xml field', async () => {
    const { AnalysisReport } = await import('../../../src/renderer/components/AnalysisReport');
    const incident = {
      id: 1,
      sessionId: 'session-1',
      incidentId: 'SIR001',
      title: 'Test Incident',
      description: 'desc',
      severity: 'high' as const,
      status: 'analyzing' as const,
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    };
    const result = makeResult({ raw_xml: '<data/>' });

    render(<AnalysisReport incident={incident} results={[result]} />);

    // Summary should contain a human-readable label
    expect(screen.getByText(/raw xml/i)).toBeTruthy();
  });

  it('renders no nested <details> for XML fields when result has no XML payload fields', async () => {
    const { AnalysisReport } = await import('../../../src/renderer/components/AnalysisReport');
    const incident = {
      id: 1,
      sessionId: 'session-1',
      incidentId: 'INC001',
      title: 'Test Incident',
      description: 'desc',
      severity: 'low' as const,
      status: 'new' as const,
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    };
    const result = makeResult({ state: 'Open', priority: '2 - High' });

    render(<AnalysisReport incident={incident} results={[result]} />);

    // The outer card is a <details>, but no nested <details> for XML fields should be present
    const detailsElements = document.querySelectorAll('details');
    expect(detailsElements.length).toBe(1); // only the card-level details, no XML sub-panels
  });

  it('renders multiple independent <details> panels for multiple XML fields', async () => {
    const { AnalysisReport } = await import('../../../src/renderer/components/AnalysisReport');
    const incident = {
      id: 1,
      sessionId: 'session-1',
      incidentId: 'SIR001',
      title: 'Test Incident',
      description: 'desc',
      severity: 'critical' as const,
      status: 'analyzing' as const,
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    };
    const result = makeResult({
      raw_xml: '<root/>',
      work_notes_xml: '<notes/>',
      state: 'Open',
    });

    render(<AnalysisReport incident={incident} results={[result]} />);

    const detailsElements = document.querySelectorAll('details');
    expect(detailsElements.length).toBeGreaterThanOrEqual(2);

    // All are collapsed by default
    detailsElements.forEach((el) => {
      expect(el.hasAttribute('open')).toBe(false);
    });
  });

  it('renders summary label for work_notes_xml as "Work Notes Xml" or similar', async () => {
    const { AnalysisReport } = await import('../../../src/renderer/components/AnalysisReport');
    const incident = {
      id: 1,
      sessionId: 'session-1',
      incidentId: 'SIR001',
      title: 'Test Incident',
      description: 'desc',
      severity: 'high' as const,
      status: 'analyzing' as const,
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    };
    const result = makeResult({ work_notes_xml: '<notes>test</notes>' });

    render(<AnalysisReport incident={incident} results={[result]} />);

    expect(screen.getByText(/work notes/i)).toBeTruthy();
  });
});
