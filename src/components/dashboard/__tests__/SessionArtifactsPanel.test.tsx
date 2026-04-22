import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

import { SessionArtifactsPanel } from '../SessionArtifactsPanel';

import type { OpenClawArtifact, OpenClawSessionDetails } from '@/lib/gateway/openclaw-snapshot';

function createSessionWithArtifacts(
  artifacts: OpenClawArtifact[],
  overrides: Partial<OpenClawSessionDetails> = {}
): OpenClawSessionDetails {
  return {
    sessionKey: 'sess-1',
    agentId: 'dev-claw',
    agentName: 'Dev Claw',
    role: 'dev',
    label: 'Test session',
    status: 'completed',
    startedAt: '2026-04-14T05:00:00Z',
    endedAt: '2026-04-14T05:30:00Z',
    currentWork: null,
    latestThought: null,
    latestResultSummary: 'Created test files',
    model: 'gpt-5.4',
    latestMessage: 'Done',
    latestMessageRole: 'assistant',
    latestMessageStatus: 'completed',
    history: [],
    artifacts,
    finalDeliveryArtifacts: artifacts,
    category: 'completed',
    ...overrides,
  };
}

describe('SessionArtifactsPanel', () => {
  describe('artifact info display', () => {
    it('shows source agent name for each artifact', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText('Dev Claw')).toBeInTheDocument();
    });

    it('shows generation time for each artifact', () => {
      const producedAt = '2026-04-14T05:15:00Z';
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt,
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      const timeElement = screen.getByText(/\d{2}:\d{2}:\d{2}/);
      expect(timeElement).toBeInTheDocument();
    });

    it('shows local file path', () => {
      const path = '/Users/test/project/index.html';
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path,
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getAllByTitle(path)).toHaveLength(2);
    });

    it('shows browser URL for artifacts with url field', () => {
      const url = 'file:///Users/test/index.html';
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          url,
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText(/file:\/\/\//)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'open', {
        value: jest.fn(),
        writable: true,
      });
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('has Copy Path button for all artifacts', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'code',
          path: '/Users/test/file.txt',
          title: 'file.txt',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('copies file path to clipboard when Copy button is clicked', async () => {
      const path = '/Users/test/project/index.html';
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path,
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Copy'));
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(path);
    });

    it('has Open File button for non-URL artifacts', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'code',
          path: '/Users/test/code.ts',
          title: 'code.ts',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('has Open in Browser button for HTML artifacts', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          url: 'file:///Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText('Browser')).toBeInTheDocument();
    });

    it('has Open Result button for HTML/page files', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          url: 'file:///Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      expect(screen.getByText('Open Result')).toBeInTheDocument();
    });
  });

  describe('compact action buttons', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'open', {
        value: jest.fn(),
        writable: true,
      });
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('displays action buttons in a compact inline layout', () => {
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          url: 'file:///Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      const actionContainer = screen.getByRole('group');
      expect(actionContainer).toBeInTheDocument();
    });
  });

  describe('Open Result button behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'open', {
        value: jest.fn(),
        writable: true,
      });
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('opens first HTML artifact in browser when Open Result is clicked', async () => {
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Open Result'));
      });
      expect(window.open).toHaveBeenCalledWith('file:///Users/test/index.html', '_blank', 'noopener,noreferrer');
    });

    it('calls onOpenResult callback when provided', async () => {
      const onOpenResult = jest.fn();
      const session = createSessionWithArtifacts([
        {
          type: 'html',
          path: '/Users/test/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:15:00Z',
        },
      ]);
      render(<SessionArtifactsPanel sessions={[session]} onOpenResult={onOpenResult} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Open Result'));
      });
      expect(onOpenResult).toHaveBeenCalledTimes(1);
      expect(onOpenResult).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'html', path: '/Users/test/index.html' }),
        expect.objectContaining({ sessionKey: 'sess-1' })
      );
    });

    it('prefers finalDeliveryArtifacts over intermediate artifacts when opening results', async () => {
      const session = createSessionWithArtifacts([
        {
          type: 'code',
          path: '/Users/test/draft.ts',
          title: 'draft.ts',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:10:00Z',
        },
      ], {
        artifacts: [
          {
            type: 'code',
            path: '/Users/test/draft.ts',
            title: 'draft.ts',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T05:10:00Z',
          },
        ],
        finalDeliveryArtifacts: [
          {
            type: 'html',
            path: '/Users/test/index.html',
            url: 'file:///Users/test/index.html',
            title: 'index.html',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T05:20:00Z',
          },
        ],
      });

      render(<SessionArtifactsPanel sessions={[session]} />);

      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.queryByText('draft.ts')).not.toBeInTheDocument();
      expect(screen.getByText('Open Result')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Open Result'));
      });

      expect(window.open).toHaveBeenCalledWith('file:///Users/test/index.html', '_blank', 'noopener,noreferrer');
    });
  });

  describe('session sorting by most recent result', () => {
    it('displays sessions sorted by most recent artifact timestamp', () => {
      const olderSession = createSessionWithArtifacts(
        [
          {
            type: 'html',
            path: '/Users/old/page.html',
            title: 'old.html',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T05:00:00Z',
          },
        ],
        { sessionKey: 'sess-old', label: 'Old task' }
      );
      const newerSession = createSessionWithArtifacts(
        [
          {
            type: 'html',
            path: '/Users/new/page.html',
            title: 'new.html',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T06:00:00Z',
          },
        ],
        { sessionKey: 'sess-new', label: 'New task' }
      );
      render(<SessionArtifactsPanel sessions={[olderSession, newerSession]} />);

      const sessionHeaders = document.querySelectorAll('[class*="text-xs text-gray-500 truncate"]');
      expect(sessionHeaders[0]).toHaveTextContent('New task');
      expect(sessionHeaders[1]).toHaveTextContent('Old task');
    });

    it('uses endedAt for sorting when artifacts exist', () => {
      const olderSession = createSessionWithArtifacts(
        [
          {
            type: 'html',
            path: '/Users/old/page.html',
            title: 'old.html',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T05:00:00Z',
          },
        ],
        { sessionKey: 'sess-old', label: 'Older session' }
      );
      const newerSession = createSessionWithArtifacts(
        [
          {
            type: 'html',
            path: '/Users/new/page.html',
            title: 'new.html',
            producedBy: 'dev-claw',
            producedAt: '2026-04-14T07:00:00Z',
          },
        ],
        { sessionKey: 'sess-new', label: 'Newer session' }
      );
      render(<SessionArtifactsPanel sessions={[newerSession, olderSession]} />);

      const sessionHeaders = document.querySelectorAll('[class*="text-xs text-gray-500 truncate"]');
      expect(sessionHeaders[0]).toHaveTextContent('Newer session');
      expect(sessionHeaders[1]).toHaveTextContent('Older session');
    });
  });
});
