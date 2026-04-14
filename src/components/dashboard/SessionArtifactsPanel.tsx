'use client';

import { OpenClawSessionDetails } from '@/hooks/useOpenClawSnapshot';

const ARTIFACT_TYPE_ICONS: Record<string, string> = {
  html: '📄',
  code: '💻',
  image: '🖼️',
  markdown: '📝',
  json: '📋',
  file: '📁',
  url: '🔗',
};

interface SessionArtifactsPanelProps {
  sessions: OpenClawSessionDetails[];
}

export function SessionArtifactsPanel({ sessions }: SessionArtifactsPanelProps) {
  const sessionsWithArtifacts = sessions.filter(s => s.artifacts && s.artifacts.length > 0);

  if (sessionsWithArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-3">
      <h2 className="text-sm font-bold gradient-text mb-2">Session Outputs</h2>
      <div className="space-y-2">
        {sessionsWithArtifacts.map(session => (
          <div key={session.sessionKey} className="bg-dark-50/50 rounded-lg p-2.5 border border-dark-100/20">
            <div className="text-xs text-gray-500 mb-1 truncate">{session.label}</div>
            <div className="space-y-1">
              {session.artifacts.map((artifact, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span>{ARTIFACT_TYPE_ICONS[artifact.type] ?? '📄'}</span>
                  <span className="text-gray-300 truncate" title={artifact.path}>
                    {artifact.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}