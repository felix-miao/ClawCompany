/**
 * /office route now redirects to /dashboard.
 * We verify that the redirect helper is called so the route stays thin.
 */

import { redirect } from 'next/navigation';

import OfficePage from '../page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('OfficePage (redirect)', () => {
  it('should redirect to /dashboard', () => {
    // OfficePage calls redirect() which throws in Next.js runtime;
    // in tests the mock just records the call.
    try {
      OfficePage();
    } catch {
      // redirect() in tests may throw — that is fine
    }
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
