import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import { RequireAuth, RedirectIfAuth } from './components/shared/ProtectedRoute';
import Layout from './components/shared/Layout';
import ChangePassword from './pages/ChangePassword.js';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ApplicationsList from './pages/admin/ApplicationsList';
import AdminUsers from './pages/admin/AdminUsers';
import DataTable from './pages/country/DataTable';
import UserDashboard from './pages/UserDashboard';
import InquiryList from './pages/InquiryList';
import Settings from './pages/Settings';
import ChatPage from './pages/chat/ChatPage';

import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ChatProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              className: 'toast-custom',
              style: { maxWidth: 380 },
              success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
              error: { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
            }}
          />

          <Routes>
                        <Route
              path="/login"
              element={
                <RedirectIfAuth>
                  <Login />
                </RedirectIfAuth>
              }
            />

                        <Route path="/change-password" element={<ChangePassword />} />

                        <Route
              path="/admin"
              element={
                <RequireAuth adminOnly>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="applications/:countryId" element={<DataTable />} />
              <Route path="inquiries" element={<InquiryList />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<Settings />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>

                        <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="applications/:countryId" element={<DataTable />} />
              <Route path="inquiries" element={<InquiryList />} />
              <Route path="settings" element={<Settings />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>

                        <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </ChatProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}