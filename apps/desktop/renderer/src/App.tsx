import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@dadei/ui/lib/platform/query/createQueryClient';
import { startClientContextResponder } from '@dadei/ui/lib/assistant/realtime/clientContextResponder';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SystemProvider } from '@dadei/ui/contexts/SystemContext';
import { NotificationProvider } from '@dadei/ui/contexts/NotificationContext';
import { AuthProvider } from '@dadei/ui/contexts/AuthContext';
import { AssistantRuntimeProvider } from '@dadei/ui/contexts/AssistantRuntimeContext';
import { ServiceProvider } from '@dadei/ui/contexts/ServiceContext';
import { CommandProvider } from '@dadei/ui/contexts/CommandContext';
import { AudioProvider } from '@dadei/ui/contexts/AudioContext';
import { TitleBar } from '@dadei/ui/components/TitleBar';
import AssistantLayout from '@dadei/ui/pages/AssistantLayout';
import LoginPage from '@dadei/ui/pages/LoginPage';

export function App() {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    return startClientContextResponder();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SystemProvider>
        <MemoryRouter initialEntries={['/assistant']}>
          <AuthProvider>
            <NotificationProvider>
              <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950">
                <TitleBar />
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
                  <div className="flex h-full min-h-0 flex-1 flex-col bg-zinc-950">
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route
                        path="/assistant"
                        element={
                          <AssistantRuntimeProvider>
                            <ServiceProvider>
                              <CommandProvider>
                                <AudioProvider>
                                  <AssistantLayout />
                                </AudioProvider>
                              </CommandProvider>
                            </ServiceProvider>
                          </AssistantRuntimeProvider>
                        }
                      />
                      <Route path="/app" element={<Navigate to="/assistant" replace />} />
                      <Route path="/" element={<Navigate to="/assistant" replace />} />
                      <Route path="*" element={<Navigate to="/assistant" replace />} />
                    </Routes>
                  </div>
                </div>
              </div>
            </NotificationProvider>
          </AuthProvider>
        </MemoryRouter>
      </SystemProvider>
    </QueryClientProvider>
  );
}
