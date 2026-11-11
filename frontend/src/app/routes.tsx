import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/Login/LoginPage';
import { HomePage } from '../pages/Home/HomePage';
import { ProjectDetailsPage } from '../pages/ProjectDetails/ProjectDetailsPage';
import { ProjectCreatePage } from '../pages/ProjectCreate/ProjectCreatePage';
import { ProjectUpdatePage } from '../pages/ProjectUpdate/ProjectUpdatePage';
import { PublicProjectPage } from '../pages/PublicProject/PublicProjectPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex items-center justify-center">
        <p className="text-xs text-[#888888]">Initializing session...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/project/:token" element={<PublicProjectPage />} />

      {/* Protected Routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/create"
        element={
          <ProtectedRoute>
            <ProjectCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <ProjectDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/update"
        element={
          <ProtectedRoute>
            <ProjectUpdatePage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

