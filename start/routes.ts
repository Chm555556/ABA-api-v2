/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

// Import controllers
const AuthController = () => import('#controllers/auth_controller')
const AdminController = () => import('#controllers/admin_controller')
const ParentController = () => import('#controllers/parent_controller')
const BCBAController = () => import('#controllers/bcba_controller')
const RBTController = () => import('#controllers/rbt_controller')
const ClinicController = () => import('#controllers/clinic_controller')
const MessagesController = () => import('#controllers/messages_controller')
const SchedulesController = () => import('#controllers/schedules_controller')
const TreatmentGoalsController = () => import('#controllers/treatment_goals_controller')
const DocumentsController = () => import('#controllers/documents_controller')
const SessionsController = () => import('#controllers/sessions_controller')
const SchedulerController = () => import('#controllers/scheduler_controller')

// Health check route
router.get('/health', async ({ response }) => {
  return response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ABA Connect API',
    version: '1.0.0',
  })
})

// API routes group
router.group(() => {
  // Authentication routes (public)
  router.group(() => {
    router.post('/register', [AuthController, 'register'])
    router.post('/login', [AuthController, 'login'])
    router.post('/forgot-password', [AuthController, 'forgotPassword'])
    router.post('/reset-password', [AuthController, 'resetPassword'])
  }).prefix('/auth')

  // Protected routes
  router.group(() => {
    // Auth routes (authenticated users)
    router.group(() => {
      router.get('/me', [AuthController, 'me'])
      router.post('/logout', [AuthController, 'logout'])
      router.post('/refresh', [AuthController, 'refresh'])
    }).prefix('/auth')

    // Admin routes
    router.group(() => {
      router.get('/dashboard', [AdminController, 'dashboard'])
      router.get('/stats', [AdminController, 'getStats'])
      
      // Clinic management
      router.get('/clinics', [AdminController, 'getClinics'])
      router.post('/clinics', [AdminController, 'createClinic'])
      router.put('/clinics/:id', [AdminController, 'updateClinic'])
      
      // User management
      router.get('/users', [AdminController, 'getUsers'])
      router.post('/users', [AdminController, 'createUser'])
      router.put('/users/:id', [AdminController, 'updateUser'])
      router.delete('/users/:id', [AdminController, 'deleteUser'])
      
      // Client management
      router.get('/clients', [AdminController, 'getClients'])
      router.post('/clients', [AdminController, 'createClient'])
      
      // Session management
      router.get('/sessions', [AdminController, 'getSessions'])
      router.get('/sessions/:id', [AdminController, 'getSession'])
      router.post('/sessions', [AdminController, 'createSession'])
    }).prefix('/admin').use(middleware.role({ roles: ['ADMIN'] }))

    // Parent routes
    router.group(() => {
      router.get('/dashboard', [ParentController, 'dashboard'])
      router.post('/children', [ParentController, 'addChild'])
      router.get('/messages', [ParentController, 'getMessages'])
      router.post('/messages', [ParentController, 'sendMessage'])
      router.put('/messages/:id/read', [ParentController, 'markMessageAsRead'])
      router.get('/clients/:clientId/schedule', [ParentController, 'getSchedule'])
      router.get('/clients/:clientId/progress-reports', [ParentController, 'getProgressReports'])
      router.get('/clients/:clientId/documents', [ParentController, 'getDocuments'])
      router.post('/documents', [ParentController, 'uploadDocument'])
    }).prefix('/parent').use(middleware.role({ roles: ['PARENT'] }))

    // BCBA routes
    router.group(() => {
      router.get('/dashboard', [BCBAController, 'dashboard'])
      router.get('/clients', [BCBAController, 'getClients'])
      router.get('/clients/:id', [BCBAController, 'getClient'])
      router.post('/clients', [BCBAController, 'createClient'])
      router.put('/clients/:id', [BCBAController, 'updateClient'])
      router.delete('/clients/:id', [BCBAController, 'deleteClient'])
      router.get('/clinics', [ClinicController, 'getClinics'])
      router.get('/schedule', [BCBAController, 'getSchedule'])
      router.get('/sessions/pending', [BCBAController, 'getPendingSessions'])
      router.get('/sessions/:id', [BCBAController, 'getSessionDetails'])
      router.post('/sessions', [BCBAController, 'createSession'])
      router.put('/sessions/:id/review', [BCBAController, 'reviewSession'])
      router.get('/treatment-goals', [BCBAController, 'getTreatmentGoals'])
      router.post('/treatment-goals', [BCBAController, 'createTreatmentGoal'])
      router.post('/treatment-goals/bulk', [TreatmentGoalsController, 'bulkCreate'])
      router.get('/progress-reports', [BCBAController, 'getProgressReports'])
      router.get('/progress-reports/:id', [BCBAController, 'getProgressReport'])
      router.post('/progress-reports', [BCBAController, 'generateProgressReport'])
      router.get('/supervision', [BCBAController, 'getSupervisionSchedule'])
      router.post('/supervision', [BCBAController, 'createSupervisionSession'])
      router.get('/users', [BCBAController, 'getUsers'])
      router.get('/parents', [BCBAController, 'getParents'])
      router.post('/parents', [BCBAController, 'createParent'])
    }).prefix('/bcba').use(middleware.role({ roles: ['BCBA'] }))

    // RBT routes
    router.group(() => {
      router.get('/dashboard', [RBTController, 'dashboard'])
      router.get('/clients', [RBTController, 'getAssignedClients'])
      router.get('/schedule', [RBTController, 'getSchedule'])
      router.get('/sessions/history', [RBTController, 'getSessionHistory'])
      
      // Enhanced session management (specific routes first)
      router.get('/sessions/active', [RBTController, 'getActiveSession'])
      router.get('/sessions/:id/status', [RBTController, 'getSessionStatus'])
      router.get('/sessions/:id/analytics', [RBTController, 'getSessionAnalytics'])
      
      // Generic session detail (must come after specific routes)
      router.get('/sessions/:id', [RBTController, 'getSessionDetail'])
      
      // Session management
      router.post('/sessions/start', [RBTController, 'startSession'])
      router.put('/sessions/:id/end', [RBTController, 'endSession'])
      router.post('/sessions/behavior-data', [RBTController, 'logBehaviorData'])
      router.post('/sessions/incidents', [RBTController, 'logIncident'])
      router.post('/sessions/record-trial', [RBTController, 'recordTrial'])
      router.post('/sessions/record-enhanced-trial', [RBTController, 'recordEnhancedTrial'])
      router.post('/sessions/record-behavior', [RBTController, 'recordBehavior'])
      router.post('/sessions/:id/calculate-analytics', [RBTController, 'calculateSessionAnalytics'])
      router.put('/sessions/:id/auto-save', [RBTController, 'autoSaveSession'])
      router.put('/sessions/:id/submit-for-review', [RBTController, 'submitSessionForReview'])
      
      // Clinical Analytics routes
      router.post('/clinical-analytics/feedback', [RBTController, 'submitClinicalFeedback'])
      router.get('/clinical-analytics/metrics', [RBTController, 'getClinicalAnalyticsMetrics'])
      
      // Progress Insights routes
      router.get('/progress-insights/metrics', [RBTController, 'getProgressInsightsMetrics'])
      router.post('/progress-insights/feedback', [RBTController, 'submitProgressFeedback'])
      
      // Treatment Goals routes
      router.post('/treatment-goals', [RBTController, 'createTreatmentGoal'])
    }).prefix('/rbt').use(middleware.role({ roles: ['RBT'] }))

    // Scheduler routes
    router.group(() => {
      router.get('/dashboard', [SchedulerController, 'dashboard'])
      
      // Calendar and schedules
      router.get('/calendar', [SchedulerController, 'getCalendar'])
      router.get('/schedules', [SchedulerController, 'getSchedules'])
      router.post('/schedules', [SchedulerController, 'createSchedule'])
      router.put('/schedules/:id', [SchedulerController, 'updateSchedule'])
      router.delete('/schedules/:id', [SchedulerController, 'deleteSchedule'])
      
      // Resource management
      router.get('/users', [SchedulerController, 'getUsers'])
      router.get('/clients', [SchedulerController, 'getClients'])
      router.get('/rbts', [SchedulerController, 'getRBTs'])
      router.get('/bcbas', [SchedulerController, 'getBCBAs'])
      router.get('/clinics', [SchedulerController, 'getClinics'])
      
      // Availability and sessions
      router.post('/check-availability', [SchedulerController, 'checkAvailability'])
      router.get('/sessions', [SchedulerController, 'getSessions'])
      router.post('/sessions', [SchedulerController, 'createSession'])
      router.get('/sessions/:id', [SchedulerController, 'getSession'])
    }).prefix('/scheduler').use(middleware.role({ roles: ['SCHEDULER', 'ADMIN'] }))

    // Clinic routes
    router.group(() => {
      router.get('/dashboard', [ClinicController, 'dashboard'])
      
      // Clinic list
      router.get('/clinics', [ClinicController, 'getClinics'])
      
      // Client management
      router.get('/clients', [ClinicController, 'getClients'])
      router.post('/clients', [ClinicController, 'createClient'])
      router.get('/test', [ClinicController, 'testClient'])
      
      // Staff management
      router.get('/users', [ClinicController, 'getStaff'])
      router.get('/staff', [ClinicController, 'getAllStaff'])
      router.post('/staff', [ClinicController, 'createStaff'])
      router.put('/staff/:id', [ClinicController, 'updateStaff'])
      router.get('/staff-performance', [ClinicController, 'getStaffPerformance'])
      
      // Patient details
      router.get('/patients-detailed', [ClinicController, 'getPatientsDetailed'])
      router.get('/documents/:id/download', [ClinicController, 'downloadDocument'])
      
      // Session management
      router.get('/sessions', [ClinicController, 'getSessions'])
      
      // Scheduling
      router.get('/schedules', [ClinicController, 'getSchedule'])
      router.post('/schedules', [ClinicController, 'createSchedule'])
      router.put('/schedules/:id', [ClinicController, 'updateSchedule'])
      router.delete('/schedules/:id', [ClinicController, 'deleteSchedule'])
      
      // Billing
      router.get('/billing', [ClinicController, 'getBilling'])
      router.post('/invoices', [ClinicController, 'generateInvoice'])
      
      // Reports
      router.get('/reports', [ClinicController, 'getReports'])
    }).prefix('/clinic').use(middleware.role({ roles: ['CLINIC'] }))

    // Common routes for all authenticated users
    router.group(() => {
      // Sessions health check (for debugging)
      router.get('/sessions/health', [SessionsController, 'healthCheck'])
      
      // Sessions (all roles can manage sessions)
      router.get('/sessions/clients-for-group', [SessionsController, 'getClientsForGroupSession'])
      router.get('/sessions/rbt/schedule', [SessionsController, 'getRbtSchedule'])
      router.post('/sessions/check-overlap', [SessionsController, 'checkOverlap'])
      router.post('/sessions', [SessionsController, 'create'])
      router.get('/sessions/:id', [SessionsController, 'show'])
      
      // Messages (all roles can send/receive messages)
      router.get('/messages', [MessagesController, 'index'])
      router.post('/messages', [MessagesController, 'store'])
      router.put('/messages/:id/read', [MessagesController, 'markAsRead'])
      router.get('/messages/unread-count', [MessagesController, 'unreadCount'])
      
      // Schedules (role-based access)
      router.get('/schedules', [SchedulesController, 'index'])
      router.post('/schedules', [SchedulesController, 'store'])
      router.put('/schedules/:id', [SchedulesController, 'update'])
      router.delete('/schedules/:id', [SchedulesController, 'destroy'])
      router.get('/schedules/calendar', [SchedulesController, 'calendar'])
      
      // Treatment Goals (role-based access)
      router.get('/treatment-goals', [TreatmentGoalsController, 'index'])
      router.post('/treatment-goals', [TreatmentGoalsController, 'store'])
      router.post('/treatment-goals/bulk', [TreatmentGoalsController, 'bulkCreate'])
      router.put('/treatment-goals/:id', [TreatmentGoalsController, 'update'])
      router.delete('/treatment-goals/:id', [TreatmentGoalsController, 'destroy'])
      router.get('/treatment-goals/:id/progress', [TreatmentGoalsController, 'progress'])
      
      // Documents (role-based access)
      router.get('/documents', [DocumentsController, 'index'])
      router.post('/documents', [DocumentsController, 'store'])
      router.delete('/documents/:id', [DocumentsController, 'destroy'])
      router.get('/documents/:id/download', [DocumentsController, 'download'])
    }).prefix('/common')

  }).use(middleware.auth())

}).prefix('/api')

// Catch-all route for API
router.any('/api/*', async ({ response }) => {
  return response.status(404).json({
    message: 'API endpoint not found',
  })
})

// Default route
router.get('/', async ({ response }) => {
  return response.json({
    message: 'Welcome to ABA Connect API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
  })
})