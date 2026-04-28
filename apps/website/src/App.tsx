import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@dadei/ui/contexts/AuthContext';
import { ServiceProvider } from '@dadei/ui/contexts/ServiceContext';
import { CommandProvider } from '@dadei/ui/contexts/CommandContext';
import { AudioProvider } from '@dadei/ui/contexts/AudioContext';
import { NotificationProvider } from '@dadei/ui/contexts/NotificationContext';
import { AppQueryProvider } from '@dadei/ui/contexts/QueryProvider';
import AssistantLayout from '@dadei/ui/pages/AssistantLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@dadei/ui/pages/LoginPage';
import AuthOAuthCallbackPage from '@/pages/AuthOAuthCallbackPage';

export function App() {
  return (
    <AppQueryProvider>
      <NotificationProvider>
        <AuthProvider>
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
        </AuthProvider>
      </NotificationProvider>
    </AppQueryProvider>
  );
}
