// Vitest setup file
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (for React testing)
afterEach(() => {
  cleanup();
});

// Custom matchers can be added here
expect.extend({});
