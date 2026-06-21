import { describe, expect, it } from 'vitest';
import { workspaceServiceDisplayName } from '@dadei/ui/components/settings/integrations/serviceDisplayNames';

describe('workspaceServiceDisplayName', () => {
  it('uses Microsoft ecosystem product names', () => {
    expect(workspaceServiceDisplayName('mail', 'microsoft')).toBe('Outlook');
    expect(workspaceServiceDisplayName('files', 'microsoft')).toBe('OneDrive');
    expect(workspaceServiceDisplayName('docs', 'microsoft')).toBe('Word');
    expect(workspaceServiceDisplayName('sheets', 'microsoft')).toBe('Excel');
    expect(workspaceServiceDisplayName('tasks', 'microsoft')).toBe('To Do');
  });

  it('uses Google ecosystem product names', () => {
    expect(workspaceServiceDisplayName('files', 'google')).toBe('Drive');
    expect(workspaceServiceDisplayName('docs', 'google')).toBe('Docs');
    expect(workspaceServiceDisplayName('gmail', 'google')).toBe('Gmail');
    expect(workspaceServiceDisplayName('sheets', 'google')).toBe('Sheets');
  });
});
