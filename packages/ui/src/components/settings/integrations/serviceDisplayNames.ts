/** Provider-aware product names for integration tiles (settings + marketing). */

const GOOGLE_SERVICE_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  calendar: 'Calendar',
  contacts: 'Contacts',
  tasks: 'Tasks',
  files: 'Drive',
  sheets: 'Sheets',
  docs: 'Docs',
  drive: 'Drive',
};

const MICROSOFT_SERVICE_NAMES: Record<string, string> = {
  mail: 'Outlook',
  calendar: 'Calendar',
  contacts: 'Contacts',
  tasks: 'To Do',
  files: 'OneDrive',
  docs: 'Word',
  sheets: 'Excel',
  onedrive: 'OneDrive',
  excel: 'Excel',
};

const APPLE_SERVICE_NAMES: Record<string, string> = {
  calendar: 'Calendar',
  contacts: 'Contacts',
};

function titleCaseId(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function workspaceServiceDisplayName(serviceId: string, provider: string): string {
  const id = serviceId.toLowerCase();
  const p = provider.toLowerCase();

  if (p === 'microsoft') {
    return MICROSOFT_SERVICE_NAMES[id] ?? titleCaseId(id);
  }
  if (p === 'google') {
    return GOOGLE_SERVICE_NAMES[id] ?? titleCaseId(id);
  }
  if (p === 'apple' || p === 'apple_caldav') {
    return APPLE_SERVICE_NAMES[id] ?? titleCaseId(id);
  }

  return titleCaseId(id);
}
