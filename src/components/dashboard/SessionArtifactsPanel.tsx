'use client';

import { useState, useCallback } from 'react';

import type { OpenClawArtifact, OpenClawSessionDetails } from '@/lib/gateway/openclaw-snapshot';

const ARTIFACT_TYPE_ICONS: Record<string, string> = {
  html: '📄',
  tsx: '⚛️',
  code: '💻',
  image: '🖼️',
  markdown: '📝',
  json: '📋',
  'test-report': '🧪',
  file: '📁',
  url: '🔗',
};

const PREVIEWABLE_TYPES = ['html', 'htm'];

interface SessionArtifactsPanelProps {
  sessions: OpenClawSessionDetails[];
  onOpenResult?: (artifact: OpenClawArtifact, session: OpenClawSessionDetails) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function canPreview(artifact: OpenClawArtifact): boolean {
  return artifact.type === 'html'
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function openInBrowser(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openFile(filePath: string): void {
  window.open(`file://${filePath}`, '_blank', 'noopener,noreferrer');
}

interface ArtifactItemProps {
  artifact: OpenClawArtifact;
  agentName: string;
}

function ArtifactItem({ artifact, agentName }: ArtifactItemProps) {
  const [copied, setCopied] = useState(false);
  const isPreviewable = canPreview(artifact);
  const browserUrl = artifact.url || (artifact.path && isPreviewable ? `file://${artifact.path}` : null);

  const handleCopyPath = useCallback(() => {
    const pathToCopy = artifact.path || artifact.url || '';
    copyToClipboard(pathToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [artifact.path, artifact.url]);

  const handleOpenBrowser = useCallback(() => {
    if (browserUrl) {
      openInBrowser(browserUrl);
    }
  }, [browserUrl]);

  const handleOpenFile = useCallback(() => {
    if (artifact.path) {
      openFile(artifact.path);
    }
  }, [artifact.path]);

  return (
    <div className="bg-dark-50/50 rounded-lg p-2.5 border border-dark-100/20">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{ARTIFACT_TYPE_ICONS[artifact.type] ?? '📄'}</span>
          <span className="text-xs text-gray-300 truncate font-medium" title={artifact.path || artifact.url}>
            {artifact.title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-gray-500" title={`By ${agentName}`}>
            {agentName}
          </span>
          <span className="text-[10px] text-gray-600 ml-1">
            {formatTime(artifact.producedAt)}
          </span>
        </div>
      </div>

      {(artifact.path || artifact.url) && (
        <div className="text-[10px] text-gray-500 truncate mb-2 ml-6" title={artifact.path || artifact.url}>
          {artifact.path && <span className="mr-2">📍 {artifact.path}</span>}
          {browserUrl && artifact.url && <span className="text-blue-400/70">→ {artifact.url}</span>}
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-6" role="group" aria-label="Artifact actions">
        {artifact.path && (
          <button
            type="button"
            onClick={handleOpenFile}
            className="px-2 py-0.5 text-[10px] bg-dark-100/50 hover:bg-dark-100 text-gray-300 hover:text-white rounded transition-colors"
            title="Open file"
          >
            Open
          </button>
        )}

        {isPreviewable && (
          <button
            type="button"
            onClick={handleOpenBrowser}
            className="px-2 py-0.5 text-[10px] bg-primary-600/30 hover:bg-primary-600 text-primary-200 hover:text-white rounded transition-colors"
            title="Open in browser"
          >
            Browser
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyPath}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            copied
              ? 'bg-green-600/30 text-green-300'
              : 'bg-dark-100/50 hover:bg-dark-100 text-gray-300 hover:text-white'
          }`}
          title="Copy path"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

interface SessionHeaderProps {
  session: OpenClawSessionDetails;
  onOpenResult?: (artifact: OpenClawArtifact, session: OpenClawSessionDetails) => void;
}

function SessionHeader({ session, onOpenResult }: SessionHeaderProps) {
  const hasPreviewable = session.artifacts.some(a => canPreview(a));

  const handleOpenResult = () => {
    if (onOpenResult) {
      const firstPreviewable = session.artifacts.find(a => canPreview(a));
      if (firstPreviewable) {
        onOpenResult(firstPreviewable, session);
      }
    } else {
      const firstPreviewable = session.artifacts.find(a => canPreview(a));
      if (firstPreviewable) {
        const browserUrl = firstPreviewable.url || (firstPreviewable.path ? `file://${firstPreviewable.path}` : null);
        if (browserUrl) {
          openInBrowser(browserUrl);
        }
      }
    }
  };

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-gray-500 truncate" title={session.label}>
        {session.label || 'Untitled session'}
      </div>
      {hasPreviewable && (
        <button
          type="button"
          onClick={handleOpenResult}
          className="px-2 py-0.5 text-[10px] bg-primary-600 hover:bg-primary-500 text-white rounded transition-colors shrink-0"
        >
          Open Result
        </button>
      )}
    </div>
  );
}

export function SessionArtifactsPanel({ sessions, onOpenResult }: SessionArtifactsPanelProps) {
  const sessionsWithArtifacts = sessions.filter(s => s.artifacts && s.artifacts.length > 0);

  if (sessionsWithArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-3">
      <h2 className="text-sm font-bold gradient-text mb-2">Session Outputs</h2>
      <div className="space-y-3">
        {sessionsWithArtifacts.map(session => (
          <div key={session.sessionKey}>
            <SessionHeader session={session} onOpenResult={onOpenResult} />
            <div className="space-y-1">
              {session.artifacts.map((artifact, idx) => (
                <ArtifactItem
                  key={`${session.sessionKey}-${idx}`}
                  artifact={artifact}
                  agentName={session.agentName}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
