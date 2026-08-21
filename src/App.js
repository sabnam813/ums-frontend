import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import { RequireAuth, RedirectIfAuth } from './components/shared/ProtectedRoute';
import Layout from './components/shared/Layout';
import ChangePassword from './pages/ChangePassword.js';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ApplicationsList from './pages/admin/ApplicationsList';
import AdminUsers from './pages/admin/AdminUsers';
import Departments from './pages/admin/Departments';
import DataTable from './pages/country/DataTable';
import TestTypesManage from './pages/testprep/TestTypesManage';
import TestPrepDataTable from './pages/testprep/TestPrepDataTable';
import DailyReceiptPage from './pages/testprep/DailyReceiptPage';
import ContactsHome from './pages/contacts/ContactsHome';
import ContactGroupPage from './pages/contacts/ContactGroupPage';
import UserDashboard from './pages/UserDashboard';
import InquiryList from './pages/InquiryList';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import DailyReport from './pages/DailyReport';
import ChatPage from './pages/chat/ChatPage';
import Trash from './pages/Trash';
import BackupManager from './pages/admin/BackupManager';
import SystemDashboard from './pages/admin/SystemDashboard';
import ActivityLogs from './pages/admin/ActivityLogs';

import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import InfrastructureDashboard from './pages/superadmin/InfrastructureDashboard';
import DatabaseManagement from './pages/superadmin/DatabaseManagement';
import SystemLogs from './pages/superadmin/SystemLogs';
import CrashErrorMonitoring from './pages/superadmin/CrashErrorMonitoring';
import PerformanceMonitoring from './pages/superadmin/PerformanceMonitoring';
import SecurityCenter from './pages/superadmin/SecurityCenter';
import BackupRecovery from './pages/superadmin/BackupRecovery';
import FeatureManagement from './pages/superadmin/FeatureManagement';
import NotificationCenter from './pages/superadmin/NotificationCenter';
import ApiManagement from './pages/superadmin/ApiManagement';
import CacheManagement from './pages/superadmin/CacheManagement';
import BackgroundJobs from './pages/superadmin/BackgroundJobs';
import StorageManagement from './pages/superadmin/StorageManagement';
import SystemConfiguration from './pages/superadmin/SystemConfiguration';
import DeveloperTools from './pages/superadmin/DeveloperTools';
import AuditCenter from './pages/superadmin/AuditCenter';

import FollowUp from './pages/FollowUp';
import Achievements from './pages/admin/Achievements';
import PortalPage from './pages/admin/Portal/PortalPage';
import DiaryPage from './pages/admin/Diary/DiaryPage';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <FiscalYearProvider>
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
              <Route
                path="test-prep"
                element={
                  <RequireAuth adminOnly testPrepOnly>
                    <TestTypesManage />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug"
                element={
                  <RequireAuth adminOnly testPrepOnly>
                    <TestPrepDataTable />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug/daily-receipts"
                element={
                  <RequireAuth adminOnly testPrepOnly>
                    <DailyReceiptPage />
                  </RequireAuth>
                }
              />
              <Route path="contacts" element={<ContactsHome />} />
              <Route path="contacts/:slug" element={<ContactGroupPage />} />
              <Route path="inquiries" element={
                  <RequireAuth adminOnly inquiryOnly>
                    <InquiryList />
                  </RequireAuth>
                } />
              <Route path="follow-up" element={
                  <RequireAuth adminOnly followUpOnly>
                    <FollowUp />
                  </RequireAuth>
                } />
              <Route path="reports" element={
                  <RequireAuth adminOnly reportsOnly>
                    <Reports />
                  </RequireAuth>
                } />
              <Route path="achievements" element={
                  <RequireAuth adminOnly achievementsOnly>
                    <Achievements />
                  </RequireAuth>
                } />
              <Route path="daily-report" element={
                  <RequireAuth adminOnly dailyReportOnly>
                    <DailyReport />
                  </RequireAuth>
                } />
              <Route path="portal" element={
                  <RequireAuth adminOnly portalOnly>
                    <PortalPage />
                  </RequireAuth>
                } />
              <Route
                path="diary"
                element={
                  <RequireAuth superAdminOnly>
                    <DiaryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="users"
                element={
                  <RequireAuth superAdminOnly>
                    <AdminUsers />
                  </RequireAuth>
                }
              />
              <Route
                path="departments"
                element={
                  <RequireAuth superAdminOnly>
                    <Departments />
                  </RequireAuth>
                }
              />
              <Route
                path="trash"
                element={
                  <RequireAuth trashOnly>
                    <Trash />
                  </RequireAuth>
                }
              />
              <Route
                path="backup"
                element={
                  <RequireAuth superAdminOnly>
                    <BackupManager />
                  </RequireAuth>
                }
              />
              <Route
                path="system"
                element={
                  <RequireAuth superAdminOnly>
                    <SystemDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="logs"
                element={
                  <RequireAuth superAdminOnly>
                    <ActivityLogs />
                  </RequireAuth>
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>

                        <Route
              path="/superadmin"
              element={
                <RequireAuth superAdminOnly>
                  <SuperAdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<InfrastructureDashboard />} />
              {}
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="applications/:countryId" element={<DataTable />} />
              <Route path="test-prep" element={<TestTypesManage />} />
              <Route path="test-prep/:slug" element={<TestPrepDataTable />} />
              <Route path="test-prep/:slug/daily-receipts" element={<DailyReceiptPage />} />
              <Route path="contacts" element={<ContactsHome />} />
              <Route path="contacts/:slug" element={<ContactGroupPage />} />
              <Route path="inquiries" element={<InquiryList />} />
              <Route path="follow-up" element={<FollowUp />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="departments" element={<Departments />} />
              <Route path="chat" element={<ChatPage />} />
              <Route
                path="trash"
                element={
                  <RequireAuth trashOnly>
                    <Trash />
                  </RequireAuth>
                }
              />
              <Route path="backup" element={<BackupManager />} />
              <Route path="system" element={<SystemDashboard />} />
              <Route path="logs-activity" element={<ActivityLogs />} />
              <Route path="settings" element={<Settings />} />
              <Route path="reports" element={<Reports />} />
              <Route path="achievements" element={<Achievements />} />
              <Route path="daily-report" element={<DailyReport />} />
              <Route path="portal" element={<PortalPage />} />
              <Route path="diary" element={<DiaryPage />} />
              <Route path="database" element={<DatabaseManagement />} />
              <Route path="logs" element={<SystemLogs />} />
              <Route path="errors" element={<CrashErrorMonitoring />} />
              <Route path="performance" element={<PerformanceMonitoring />} />
              <Route path="security" element={<SecurityCenter />} />
              <Route path="audit" element={<AuditCenter />} />
              <Route path="backups" element={<BackupRecovery />} />
              <Route path="jobs" element={<BackgroundJobs />} />
              <Route path="cache" element={<CacheManagement />} />
              <Route path="storage" element={<StorageManagement />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="features" element={<FeatureManagement />} />
              <Route path="config" element={<SystemConfiguration />} />
              <Route path="api-management" element={<ApiManagement />} />
              <Route path="devtools" element={<DeveloperTools />} />
            </Route>

                        <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="applications/:countryId" element={<DataTable />} />
              <Route
                path="test-prep"
                element={
                  <RequireAuth testPrepOnly>
                    <TestTypesManage />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug"
                element={
                  <RequireAuth testPrepOnly>
                    <TestPrepDataTable />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug/daily-receipts"
                element={
                  <RequireAuth testPrepOnly>
                    <DailyReceiptPage />
                  </RequireAuth>
                }
              />
              <Route path="contacts" element={<ContactsHome />} />
              <Route path="contacts/:slug" element={<ContactGroupPage />} />
              <Route path="inquiries" element={
                  <RequireAuth inquiryOnly>
                    <InquiryList />
                  </RequireAuth>
                } />
              <Route path="follow-up" element={
                  <RequireAuth followUpOnly>
                    <FollowUp />
                  </RequireAuth>
                } />
              <Route path="reports" element={
                  <RequireAuth reportsOnly>
                    <Reports />
                  </RequireAuth>
                } />
              <Route path="achievements" element={
                  <RequireAuth achievementsOnly>
                    <Achievements />
                  </RequireAuth>
                } />
              <Route path="daily-report" element={
                  <RequireAuth dailyReportOnly>
                    <DailyReport />
                  </RequireAuth>
                } />
              <Route
                path="trash"
                element={
                  <RequireAuth trashOnly>
                    <Trash />
                  </RequireAuth>
                }
              />
              <Route path="portal" element={
                  <RequireAuth portalOnly>
                    <PortalPage />
                  </RequireAuth>
                } />
              <Route path="settings" element={<Settings />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </ChatProvider>
        </NotificationProvider>
      </AuthProvider>
      </FiscalYearProvider>
    </BrowserRouter>
  );
}
