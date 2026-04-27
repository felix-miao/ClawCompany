/**
 * @jest-environment node
 */

import React from 'react';
import { renderToString } from 'react-dom/server';

jest.mock('phaser', () => {
  throw new Error('Phaser must not be imported while rendering dashboard on the server');
});

describe('DashboardPage SSR', () => {
  it('renders without a browser window or Phaser import side effects', async () => {
    expect(typeof window).toBe('undefined');

    const { default: DashboardPage } = await import('../page');

    expect(() => renderToString(<DashboardPage />)).not.toThrow();
  });
});
