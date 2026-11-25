import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import { StudentFollowUpProvider } from './context/StudentFollowUpContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import { ConfigProvider } from './context/ConfigContext';
import { RequireAuth, RedirectIfAuth } from './components/shared/ProtectedRoute';
import Layout from './components/shared/Layout';
import FollowUpReminderBanner from './components/shared/FollowUpReminderBanner';
import NameAlign from './components/shared/NameAlign';

import Login from './pages/Login';


import './styles/global.css';
import './styles/admin-ui.css';
import './styles/ui-polish.css';

function RouteFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--gray-200)', borderTopColor: 'var(--uca-blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}

const ConfigCenter = lazy(() => import('./pages/superadmin/ConfigCenter'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.js'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ApplicationsList = lazy(() => import('./pages/admin/ApplicationsList'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const Departments = lazy(() => import('./pages/admin/Departments'));
const DataTable = lazy(() => import('./pages/country/DataTable'));
const TestTypesManage = lazy(() => import('./pages/testprep/TestTypesManage'));
const TestPrepDataTable = lazy(() => import('./pages/testprep/TestPrepDataTable'));
const DailyReceiptPage = lazy(() => import('./pages/testprep/DailyReceiptPage'));
const DailyReceiptsHome = lazy(() => import('./pages/testprep/DailyReceiptsHome'));
const ContactsHome = lazy(() => import('./pages/contacts/ContactsHome'));
const ContactGroupPage = lazy(() => import('./pages/contacts/ContactGroupPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const InquiryList = lazy(() => import('./pages/InquiryList'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));
const DailyReport = lazy(() => import('./pages/DailyReport'));
const ChatPage = lazy(() => import('./pages/chat/ChatPage'));
const Trash = lazy(() => import('./pages/Trash'));
const BackupManager = lazy(() => import('./pages/admin/BackupManager'));
const SystemDashboard = lazy(() => import('./pages/admin/SystemDashboard'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const SuperAdminLayout = lazy(() => import('./pages/superadmin/SuperAdminLayout'));
const InfrastructureDashboard = lazy(() => import('./pages/superadmin/InfrastructureDashboard'));
const DatabaseManagement = lazy(() => import('./pages/superadmin/DatabaseManagement'));
const SystemLogs = lazy(() => import('./pages/superadmin/SystemLogs'));
const CrashErrorMonitoring = lazy(() => import('./pages/superadmin/CrashErrorMonitoring'));
const PerformanceMonitoring = lazy(() => import('./pages/superadmin/PerformanceMonitoring'));
const SecurityCenter = lazy(() => import('./pages/superadmin/SecurityCenter'));
const BackupRecovery = lazy(() => import('./pages/superadmin/BackupRecovery'));
const FeatureManagement = lazy(() => import('./pages/superadmin/FeatureManagement'));
const NotificationCenter = lazy(() => import('./pages/superadmin/NotificationCenter'));
const ApiManagement = lazy(() => import('./pages/superadmin/ApiManagement'));
const CacheManagement = lazy(() => import('./pages/superadmin/CacheManagement'));
const BackgroundJobs = lazy(() => import('./pages/superadmin/BackgroundJobs'));
const StorageManagement = lazy(() => import('./pages/superadmin/StorageManagement'));
const SystemConfiguration = lazy(() => import('./pages/superadmin/SystemConfiguration'));
const DeveloperTools = lazy(() => import('./pages/superadmin/DeveloperTools'));
const AuditCenter = lazy(() => import('./pages/superadmin/AuditCenter'));
const FollowUp = lazy(() => import('./pages/FollowUp'));
const StudentFollowUp = lazy(() => import('./pages/StudentFollowUp'));
const Achievements = lazy(() => import('./pages/admin/Achievements'));
const TPAchievements = lazy(() => import('./pages/admin/TPAchievements'));
const PortalPage = lazy(() => import('./pages/admin/Portal/PortalPage'));
const HallBookingPage = lazy(() => import('./pages/admin/HallBooking/HallBookingPage'));
const TrainingSchedulePage = lazy(() => import('./pages/admin/TrainingSchedule/TrainingSchedulePage'));
const CounsellorPage = lazy(() => import('./pages/admin/Counsellor/CounsellorPage'));
const TPMarginPage = lazy(() => import('./pages/admin/TPMargin/TPMarginPage'));
const AssociateDetailsPage = lazy(() => import('./pages/admin/AssociateDetails/AssociateDetailsPage'));
const CommissionHome = lazy(() => import('./pages/commission/CommissionHome'));
const CommissionCountryIntakes = lazy(() => import('./pages/commission/CommissionCountryIntakes'));
const CommissionCountryPage = lazy(() => import('./pages/commission/CommissionCountryPage'));
const CommissionSectionPage = lazy(() => import('./pages/commission/CommissionSectionPage'));
const UnicommissionHome = lazy(() => import('./pages/unicommission/UnicommissionHome'));
const UnicommissionCountryPage = lazy(() => import('./pages/unicommission/UnicommissionCountryPage'));
const DiaryPage = lazy(() => import('./pages/admin/Diary/DiaryPage'));

export default function App() {
  return (
    <BrowserRouter>
      <FiscalYearProvider>
      <AuthProvider>
        <ConfigProvider>
        <NotificationProvider>
          <ChatProvider>
          <StudentFollowUpProvider>
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
          <FollowUpReminderBanner />
          <NameAlign />

          <Suspense fallback={<RouteFallback />}>
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
                path="daily-receipts"
                element={
                  <RequireAuth adminOnly dailyReceiptOnly>
                    <DailyReceiptsHome />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug/daily-receipts"
                element={
                  <RequireAuth adminOnly dailyReceiptOnly>
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
              <Route path="student-follow-up" element={
                  <RequireAuth adminOnly studentFollowUpOnly>
                    <StudentFollowUp />
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
              <Route path="tp-achievements" element={
                  <RequireAuth adminOnly tpAchievementsOnly>
                    <TPAchievements />
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
              <Route path="hall-booking" element={
                  <RequireAuth adminOnly hallBookingOnly>
                    <HallBookingPage />
                  </RequireAuth>
                } />
              <Route path="training-schedule" element={
                  <RequireAuth adminOnly trainingScheduleOnly>
                    <TrainingSchedulePage />
                  </RequireAuth>
                } />
              <Route path="tp-margin" element={
                  <RequireAuth adminOnly tpMarginOnly>
                    <TPMarginPage />
                  </RequireAuth>
                } />
              <Route path="counsellor-details" element={
                  <RequireAuth adminOnly counsellorOnly>
                    <CounsellorPage />
                  </RequireAuth>
                } />
              <Route path="associate-details" element={
                  <RequireAuth adminOnly associateDetailsOnly>
                    <AssociateDetailsPage />
                  </RequireAuth>
                } />
              <Route path="commission" element={
                  <RequireAuth commissionOnly>
                    <CommissionHome />
                  </RequireAuth>
                } />
              <Route path="commission/country/:countryId" element={
                  <RequireAuth commissionOnly>
                    <CommissionCountryIntakes />
                  </RequireAuth>
                } />
              <Route path="commission/:intakeId/:countryId" element={
                  <RequireAuth commissionOnly>
                    <CommissionCountryPage />
                  </RequireAuth>
                } />
              <Route path="commission/:intakeId/:countryId/:section" element={
                  <RequireAuth commissionOnly>
                    <CommissionSectionPage />
                  </RequireAuth>
                } />
              <Route path="unicommission" element={
                  <RequireAuth adminOnly unicommissionOnly>
                    <UnicommissionHome />
                  </RequireAuth>
                } />
              <Route path="unicommission/:countryId" element={
                  <RequireAuth adminOnly unicommissionOnly>
                    <UnicommissionCountryPage />
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
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="applications/:countryId" element={<DataTable />} />
              <Route path="test-prep" element={<TestTypesManage />} />
              <Route path="test-prep/:slug" element={<TestPrepDataTable />} />
              <Route path="daily-receipts" element={<DailyReceiptsHome />} />
              <Route path="test-prep/:slug/daily-receipts" element={<DailyReceiptPage />} />
              <Route path="contacts" element={<ContactsHome />} />
              <Route path="contacts/:slug" element={<ContactGroupPage />} />
              <Route path="inquiries" element={<InquiryList />} />
              <Route path="follow-up" element={<FollowUp />} />
              <Route path="student-follow-up" element={<StudentFollowUp />} />
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
              <Route path="tp-achievements" element={<TPAchievements />} />
              <Route path="daily-report" element={<DailyReport />} />
              <Route path="portal" element={<PortalPage />} />
              <Route path="hall-booking" element={<HallBookingPage />} />
              <Route path="training-schedule" element={<TrainingSchedulePage />} />
              <Route path="tp-margin" element={<TPMarginPage />} />
              <Route path="counsellor-details" element={<CounsellorPage />} />
              <Route path="associate-details" element={<AssociateDetailsPage />} />
              <Route path="commission" element={<CommissionHome />} />
              <Route path="commission/country/:countryId" element={<CommissionCountryIntakes />} />
              <Route path="commission/:intakeId/:countryId" element={<CommissionCountryPage />} />
              <Route path="commission/:intakeId/:countryId/:section" element={<CommissionSectionPage />} />
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
              <Route path="config-center" element={<ConfigCenter />} />
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
                path="daily-receipts"
                element={
                  <RequireAuth dailyReceiptOnly>
                    <DailyReceiptsHome />
                  </RequireAuth>
                }
              />
              <Route
                path="test-prep/:slug/daily-receipts"
                element={
                  <RequireAuth dailyReceiptOnly>
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
              <Route path="student-follow-up" element={
                  <RequireAuth studentFollowUpOnly>
                    <StudentFollowUp />
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
              <Route path="tp-achievements" element={
                  <RequireAuth tpAchievementsOnly>
                    <TPAchievements />
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
              <Route path="hall-booking" element={
                  <RequireAuth hallBookingOnly>
                    <HallBookingPage />
                  </RequireAuth>
                } />
              <Route path="training-schedule" element={
                  <RequireAuth trainingScheduleOnly>
                    <TrainingSchedulePage />
                  </RequireAuth>
                } />
              <Route path="tp-margin" element={
                  <RequireAuth tpMarginOnly>
                    <TPMarginPage />
                  </RequireAuth>
                } />
              <Route path="counsellor-details" element={
                  <RequireAuth counsellorOnly>
                    <CounsellorPage />
                  </RequireAuth>
                } />
              <Route path="associate-details" element={
                  <RequireAuth associateDetailsOnly>
                    <AssociateDetailsPage />
                  </RequireAuth>
                } />
              <Route path="commission" element={
                  <RequireAuth commissionOnly>
                    <CommissionHome />
                  </RequireAuth>
                } />
              <Route path="commission/country/:countryId" element={
                  <RequireAuth commissionOnly>
                    <CommissionCountryIntakes />
                  </RequireAuth>
                } />
              <Route path="commission/:intakeId/:countryId" element={
                  <RequireAuth commissionOnly>
                    <CommissionCountryPage />
                  </RequireAuth>
                } />
              <Route path="commission/:intakeId/:countryId/:section" element={
                  <RequireAuth commissionOnly>
                    <CommissionSectionPage />
                  </RequireAuth>
                } />
              <Route path="unicommission" element={
                  <RequireAuth unicommissionOnly>
                    <UnicommissionHome />
                  </RequireAuth>
                } />
              <Route path="unicommission/:countryId" element={
                  <RequireAuth unicommissionOnly>
                    <UnicommissionCountryPage />
                  </RequireAuth>
                } />
              <Route path="settings" element={<Settings />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
          </StudentFollowUpProvider>
          </ChatProvider>
        </NotificationProvider>
        </ConfigProvider>
      </AuthProvider>
      </FiscalYearProvider>
    </BrowserRouter>
  );
}
