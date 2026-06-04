import { useEffect, useState } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from '@dadei/ui/lib/query/createQueryClient';

import { startClientContextResponder } from '@dadei/ui/lib/realtime/clientContextResponder';

import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

import { SystemProvider } from '@dadei/ui/contexts/SystemContext';

import { NotificationProvider } from '@dadei/ui/contexts/NotificationContext';

import { AuthProvider } from '@dadei/ui/contexts/AuthContext';

import { ServiceProvider } from '@dadei/ui/contexts/ServiceContext';

import { CommandProvider } from '@dadei/ui/contexts/CommandContext';

import { AudioProvider } from '@dadei/ui/contexts/AudioContext';


import { DesktopAppShell } from '@dadei/ui/components/DesktopAppShell';

import AssistantLayout from '@dadei/ui/pages/AssistantLayout';

import LoginPage from '@dadei/ui/pages/LoginPage';
import SubscribePage from '@dadei/ui/pages/SubscribePage';



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

              <DesktopAppShell>

                <div className="flex h-full min-h-0 flex-1 flex-col">

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

                    <Route path="/subscribe" element={<SubscribePage />} />

                    <Route path="/app" element={<Navigate to="/assistant" replace />} />

                    <Route path="/" element={<Navigate to="/assistant" replace />} />

                    <Route path="*" element={<Navigate to="/assistant" replace />} />

                  </Routes>

                </div>

              </DesktopAppShell>

            </NotificationProvider>

          </AuthProvider>

        </MemoryRouter>

      </SystemProvider>

    </QueryClientProvider>

  );

}


