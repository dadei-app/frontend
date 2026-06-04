import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@dadei/ui/lib/query/createQueryClient';
import { startClientContextResponder } from '@dadei/ui/lib/realtime/clientContextResponder';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SystemProvider } from '@dadei/ui/contexts/SystemContext';
import { AuthProvider } from '@dadei/ui/contexts/AuthContext';
import { ServiceProvider } from '@dadei/ui/contexts/ServiceContext';
import { CommandProvider } from '@dadei/ui/contexts/CommandContext';
import { AudioProvider } from '@dadei/ui/contexts/AudioContext';
import { NotificationProvider } from '@dadei/ui/contexts/NotificationContext';
import AssistantLayout from '@dadei/ui/pages/AssistantLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@dadei/ui/pages/LoginPage';
import AuthOAuthCallbackPage from '@/pages/AuthOAuthCallbackPage';

export function App() {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    return startClientContextResponder();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SystemProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthOAuthCallbackPage />} />
              <Route path="/app" element={<Navigate to="/assistant" replace />} />
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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </SystemProvider>
    </QueryClientProvider>
  );
}
