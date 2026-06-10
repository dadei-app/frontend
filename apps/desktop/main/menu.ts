import {
  Menu,
  app,
  shell,
  BrowserWindow,
  dialog,
  type MenuItemConstructorOptions,
} from 'electron';

const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const isWindows = process.platform === 'win32';
const isDev = process.env.NODE_ENV === 'development';

function sendToMain(channel: string, payload?: unknown) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

export function openSettings(section?: string, action?: string) {
  sendToMain('app:open-settings-section', { section: section ?? 'account', action });
}

export function showAboutDialog() {
  void dialog.showMessageBox({
    type: 'info',
    title: 'About dadei',
    message: 'dadei',
    detail: `Version ${app.getVersion()}\n\nAmbient AI assistant.\nhttps://dadei.app`,
    buttons: ['OK'],
  });
}

function helpLinkItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Privacy Policy',
      click: () => shell.openExternal('https://dadei.app/privacy'),
    },
    {
      label: 'Terms of Service',
      click: () => shell.openExternal('https://dadei.app/terms'),
    },
    {
      label: 'Report an Issue',
      click: () => shell.openExternal('https://github.com/dadei-app/frontend/issues/new'),
    },
  ];
}

function settingsAndAboutItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Settings…',
      accelerator: 'CmdOrCtrl+,',
      click: () => openSettings('account'),
    },
    {
      label: 'Check for Updates…',
      click: () => openSettings('about', 'check-updates'),
    },
    { type: 'separator' },
    { label: 'About dadei', click: showAboutDialog },
  ];
}

/** Tray / compact menus: show window plus the common app actions. */
export function buildTrayMenuTemplate(showMainWindow: () => void): MenuItemConstructorOptions[] {
  return [
    { label: 'Show dadei', click: showMainWindow },
    { type: 'separator' },
    ...settingsAndAboutItems(),
    { type: 'separator' },
    ...helpLinkItems(),
    { type: 'separator' },
    { role: 'quit' },
  ];
}

export function buildApplicationMenu(): Menu | null {
  if (!isMac && !isLinux && !isWindows) {
    return null;
  }

  if (isWindows) {
    return Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [...settingsAndAboutItems(), { type: 'separator' }, ...helpLinkItems(), { type: 'separator' }, { role: 'quit' }],
      },
    ]);
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => openSettings('account'),
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click: () => openSettings('about', 'check-updates'),
        },
        { type: 'separator' as const },
        ...(isMac
          ? []
          : [
              { label: 'About dadei', click: showAboutDialog },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => openSettings('account'),
              },
              { type: 'separator' as const },
            ]),
        ...helpLinkItems(),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
