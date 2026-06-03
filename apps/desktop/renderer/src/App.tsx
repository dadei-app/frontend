import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from '@dadei/ui/contexts/NotificationContext';
import { AuthProvider } from '@dadei/ui/contexts/AuthContext';
import { ServiceProvider } from '@dadei/ui/contexts/ServiceContext';
import { CommandProvider } from '@dadei/ui/contexts/CommandContext';
import { AudioProvider } from '@dadei/ui/contexts/AudioContext';
import { AppQueryProvider } from '@dadei/ui/contexts/QueryProvider';
import { HotkeyProvider } from '@dadei/ui/contexts/HotkeyContext';
import AssistantLayout from '@dadei/ui/pages/AssistantLayout';
import LoginPage from '@dadei/ui/pages/LoginPage';

export function App() {
  return (
    <AppQueryProvider>
      <HotkeyProvider>
      <MemoryRouter initialEntries={['/assistant']}>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/assistant"
                element={
                  <ServiceProvider>
                    <CommandProvider>
                      <AudioProvider>
                        <AssistantLayout />
                      </AudioProvider>
                    </CommandProvider>
                  </ServiceProvider>
                }
              />
              <Route path="/app" element={<Navigate to="/assistant" replace />} />
              <Route path="/" element={<Navigate to="/assistant" replace />} />
              <Route path="*" element={<Navigate to="/assistant" replace />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
      </HotkeyProvider>
    </AppQueryProvider>
  );
}
