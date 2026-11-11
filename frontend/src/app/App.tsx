import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { UIConfigProvider } from '../context/UIConfigContext';
import { NotificationProvider } from '../context/NotificationContext';
import { AppRoutes } from './routes';
import { DirectUIInspector } from '../components/dev-editor/DirectUIInspector';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIConfigProvider>
          <NotificationProvider>
            <AppRoutes />
            <DirectUIInspector />
          </NotificationProvider>
        </UIConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

