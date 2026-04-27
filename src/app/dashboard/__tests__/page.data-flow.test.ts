import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.join(process.cwd(), 'src');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

describe('Dashboard data flow', () => {
  it('uses the OpenClaw snapshot as the dashboard state source', () => {
    const source = readSource('app/dashboard/DashboardClient.tsx');

    expect(source).toContain('useSnapshotStream');
    expect(source).not.toContain('useEventStream');
    expect(source).not.toContain('useDashboardStore');
  });

  it('does not import useEventStream from dashboard production code', () => {
    const dashboardSources = [
      'app/dashboard/page.tsx',
      'app/dashboard/DashboardClient.tsx',
      'components/dashboard/DashboardGameBridge.tsx',
    ].map(readSource);

    expect(dashboardSources.join('\n')).not.toMatch(/@\/hooks\/useEventStream|useEventStream\s*\(/);
  });
});
