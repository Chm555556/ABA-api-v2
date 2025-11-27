import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import User from '#models/user'
import TreatmentGoal from '#models/treatment_goal'
import ProgressReport from '#models/progress_report'
import GoalProgress from '#models/goal_progress'
import BehaviorData from '#models/behavior_data'

export default class BCBAController {
  /**
   * Get BCBA dashboard data
   */
  async dashboard({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Get assigned clients
      const assignedClients = await Client.query()
        .where('assigned_bcba', user.id)
        .where('status', 'active')
        .preload('assignedRbts')

      // Get supervised RBTs
      const supervisedRbts = await User.query()
        .where('supervisor_id', user.id)
        .where('role', 'RBT')
        .where('is_active', true)

      // Get pending session reviews
      const pendingReviews = await SessionLog.query()
        .where('bcba_id', user.id)
        .where('status', 'submitted')
        .count('* as total')

      // Get recent sessions for review
      const recentSessions = await SessionLog.query()
        .where('bcba_id', user.id)
        .whereIn('status', ['submitted', 'bcba_approved'])
        .preload('client')
        .preload('rbt')
        .orderBy('created_at', 'desc')
        .limit(10)

      // Calculate average quality score (mock calculation)
      const approvedSessions = await SessionLog.query()
        .where('bcba_id', user.id)
        .where('bcba_approved', true)

      const averageQualityScore = approvedSessions.length > 0 ? 4.2 : 0

      // Get monthly session statistics
      const currentMonth = new Date()
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      const monthlySessionStats = await SessionLog.query()
        .where('bcba_id', user.id)
        .whereBetween('created_at', [monthStart, monthEnd])
        .groupBy('status')
        .count('* as total')
        .select('status')

      const monthlyStats = {
        submitted: 0,
        bcba_approved: 0,
        rejected: 0,
      }

      monthlySessionStats.forEach(stat => {
        if (stat.status in monthlyStats) {
          monthlyStats[stat.status as keyof typeof monthlyStats] = stat.$extras.total
        }
      })

      return response.json({
        summary: {
          activeClients: assignedClients.length,
          supervisedRbts: supervisedRbts.length,
          pendingReviews: pendingReviews[0].$extras.total,
          averageQualityScore,
        },
        assignedClients: assignedClients.map(client => ({
          id: client.id,
          fullName: client.fullName,
          age: client.age,
          status: client.status,
          assignedRbts: client.assignedRbts.map(rbt => rbt.name),
          admissionDate: client.admissionDate.toISODate(),
        })),
        supervisedRbts: supervisedRbts.map(rbt => ({
          id: rbt.id,
          name: rbt.name,
          email: rbt.email,
          hourlyRate: rbt.hourlyRate,
          isActive: rbt.isActive,
        })),
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          clientName: session.client.fullName,
          rbtName: session.rbt.name,
          date: session.date.toISODate(),
          duration: session.duration,
          status: session.status,
          createdAt: session.createdAt.toISO(),
        })),
        monthlyStats,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch BCBA dashboard',
        error: error.message,
      })
    }
  }

  /**
   * Get assigned clients
   */
  async getClients({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const clients = await Client.query()
        .where('assigned_bcba', user.id)
        .preload('assignedRbts')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.where('status', 'active')
        })
        .orderBy('first_name', 'asc')

      return response.json({
        data: clients.map(client => ({
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          age: client.age,
          dateOfBirth: client.dateOfBirth.toISODate(),
          status: client.status,
          insuranceType: client.insuranceType,
          assignedRbts: client.assignedRbts.map(rbt => ({
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
          })),
          treatmentGoals: client.treatmentGoals.map(goal => ({
            id: goal.id,
            title: goal.title,
            status: goal.status,
            measurementType: goal.measurementType,
          })),
          admissionDate: client.admissionDate.toISODate(),
          createdAt: client.createdAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch clients',
        error: error.message,
      })
    }
  }

  /**
   * Get pending sessions for review
   */
  async getPendingSessions({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const sessions = await SessionLog.query()
        .where('bcba_id', user.id)
        .where('status', 'submitted')
        .preload('client')
        .preload('rbt')
        .orderBy('created_at', 'asc')
        .paginate(page, limit)

      return response.json({
        data: sessions.all().map(session => ({
          id: session.id,
          clientId: session.clientId,
          clientName: session.client.fullName,
          rbtId: session.rbtId,
          rbtName: session.rbt.name,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          location: session.location,
          sessionNotes: session.sessionNotes,
          status: session.status,
          createdAt: session.createdAt.toISO(),
        })),
        meta: sessions.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch pending sessions',
        error: error.message,
      })
    }
  }

  /**
   * Approve or reject a session
   */
  async reviewSession({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id
      const { approved, notes } = request.only(['approved', 'notes'])

      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('bcba_id', user.id)
        .where('status', 'submitted')
        .firstOrFail()

      session.bcbaApproved = approved
      session.bcbaApprovedBy = user.id
      session.bcbaApprovedAt = DateTime.now()
      session.bcbaNotes = notes
      session.status = approved ? 'bcba_approved' : 'rejected'

      await session.save()

      return response.json({
        message: `Session ${approved ? 'approved' : 'rejected'} successfully`,
        data: {
          id: session.id,
          status: session.status,
          bcbaApproved: session.bcbaApproved,
          bcbaApprovedAt: session.bcbaApprovedAt?.toISO(),
          bcbaNotes: session.bcbaNotes,
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to review session',
        error: error.message,
      })
    }
  }

  /**
   * Create treatment goal
   */
  async createTreatmentGoal({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        clientId,
        title,
        description,
        targetBehavior,
        measurementType,
        masteryCriteria,
      } = request.only([
        'clientId',
        'title',
        'description',
        'targetBehavior',
        'measurementType',
        'masteryCriteria',
      ])

      // Verify BCBA has access to this client
      const client = await Client.query()
        .where('id', clientId)
        .where('assigned_bcba', user.id)
        .firstOrFail()

      const goal = await TreatmentGoal.create({
        clientId: client.id,
        title,
        description,
        targetBehavior,
        measurementType,
        masteryCriteria,
        status: 'active',
        createdBy: user.id,
      })

      return response.status(201).json({
        message: 'Treatment goal created successfully',
        data: {
          id: goal.id,
          clientId: goal.clientId,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          createdBy: goal.createdBy,
          createdAt: goal.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create treatment goal',
        error: error.message,
      })
    }
  }

  /**
   * Get progress reports
   */
  async getProgressReports({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = request.input('clientId')

      console.log('📊 Fetching progress reports for user:', user.id)

      let query = ProgressReport.query()
        .where('generated_by', user.id)
        .preload('client')
        .orderBy('created_at', 'desc')

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      const reports = await query
      console.log('✅ Found reports:', reports.length)

      const mappedReports = reports.map(report => {
        console.log('📝 Processing report:', report.id, 'Client:', report.client?.firstName)
        return {
          id: report.id,
          clientId: report.clientId,
          clientName: report.client 
            ? `${report.client.firstName} ${report.client.lastName}` 
            : 'Unknown Client',
          generatedBy: report.generatedBy,
          startDate: report.startDate.toISODate(),
          endDate: report.endDate.toISODate(),
          overallSummary: report.overallSummary,
          recommendations: report.recommendations,
          createdAt: report.createdAt.toISO(),
        }
      })

      console.log('✅ Returning reports:', mappedReports.length)

      return response.json({
        data: mappedReports
      })
    } catch (error) {
      console.error('❌ Get progress reports error:', error)
      console.error('Stack:', error.stack)
      return response.status(500).json({
        message: 'Failed to fetch progress reports',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 5).join('\n')
      })
    }
  }

  /**
   * Get single progress report with full details
   */
  async getProgressReport({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const reportId = params.id

      console.log('📊 Fetching progress report:', reportId, 'for user:', user.id)

      const report = await ProgressReport.query()
        .where('id', reportId)
        .where('generated_by', user.id)
        .preload('client', (clientQuery) => {
          clientQuery.preload('assignedRbts')
          clientQuery.preload('bcba')
        })
        .preload('generator')
        .firstOrFail()

      // Load goal progress with treatment goals
      const goalProgressEntries = await GoalProgress.query()
        .where('progress_report_id', report.id)
      
      const goalIds = goalProgressEntries.map(gp => gp.goalId)
      const goals = await TreatmentGoal.query().whereIn('id', goalIds)
      const goalsMap = new Map(goals.map(g => [g.id, g]))

      console.log('✅ Report loaded with', goalProgressEntries.length, 'goals')

      return response.json({
        data: {
          id: report.id,
          clientId: report.clientId,
          client: {
            id: report.client.id,
            firstName: report.client.firstName,
            lastName: report.client.lastName,
            fullName: `${report.client.firstName} ${report.client.lastName}`,
            dateOfBirth: report.client.dateOfBirth.toISODate(),
            status: report.client.status,
            insuranceType: report.client.insuranceType,
            assignedRbts: report.client.assignedRbts.map(rbt => ({
              id: rbt.id,
              name: rbt.name,
              email: rbt.email,
            })),
            bcba: report.client.bcba ? {
              id: report.client.bcba.id,
              name: report.client.bcba.name,
              email: report.client.bcba.email,
            } : null,
          },
          generatedBy: report.generatedBy,
          generator: {
            id: report.generator.id,
            name: report.generator.name,
            email: report.generator.email,
          },
          startDate: report.startDate.toISODate(),
          endDate: report.endDate.toISODate(),
          overallSummary: report.overallSummary,
          recommendations: report.recommendations,
          goals: goalProgressEntries.map(goalProgress => {
            const goal = goalsMap.get(goalProgress.goalId)
            return {
              id: goalProgress.id,
              goalId: goalProgress.goalId,
              goalTitle: goal?.title || 'Unknown Goal',
              goalDescription: goal?.description || '',
              targetBehavior: goal?.targetBehavior || '',
              measurementType: goal?.measurementType || '',
              currentLevel: goalProgress.currentLevel,
              targetLevel: goalProgress.targetLevel,
              progress: goalProgress.progress,
              notes: goalProgress.notes,
            }
          }),
          createdAt: report.createdAt.toISO(),
        }
      })
    } catch (error) {
      console.error('❌ Get progress report error:', error)
      return response.status(404).json({
        message: 'Progress report not found',
        error: error.message
      })
    }
  }

  /**
   * Generate progress report
   */
  async generateProgressReport({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { clientId, startDate, endDate, overallSummary, recommendations } = request.only([
        'clientId',
        'startDate',
        'endDate',
        'overallSummary',
        'recommendations',
      ])

      console.log('📊 Generate Progress Report Request:', {
        clientId,
        startDate,
        endDate,
        overallSummary: overallSummary?.substring(0, 50),
        recommendations: recommendations?.substring(0, 50),
        userId: user.id,
        userRole: user.role
      })

      // Verify BCBA has access to this client
      const client = await Client.find(clientId)
      
      if (!client) {
        console.log('❌ Client not found:', clientId)
        return response.status(404).json({
          message: `Client with ID ${clientId} not found`
        })
      }

      console.log('✅ Client found:', {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        assignedBcba: client.assignedBcba
      })

      if (client.assignedBcba !== user.id) {
        console.log('❌ BCBA access denied:', {
          clientBcba: client.assignedBcba,
          requestingBcba: user.id
        })
        return response.status(403).json({
          message: 'You do not have access to this client'
        })
      }

      // Get treatment goals for this client
      const treatmentGoals = await TreatmentGoal.query()
        .where('client_id', client.id)
        .where('status', 'active')

      console.log('📋 Treatment goals found:', treatmentGoals.length)

      // Convert dates to DateTime
      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      console.log('📅 Date range:', {
        start: startDateTime.toISODate(),
        end: endDateTime.toISODate()
      })

      // Create progress report
      const report = await ProgressReport.create({
        clientId: client.id,
        generatedBy: user.id,
        startDate: startDateTime,
        endDate: endDateTime,
        overallSummary: overallSummary || 'No summary provided',
        recommendations: recommendations || 'No recommendations provided',
        graphData: [],
      })

      console.log('✅ Progress report created:', report.id)

      // Create goal progress entries
      for (const goal of treatmentGoals) {
        console.log(`📊 Processing goal: ${goal.id} - ${goal.title}`)
        
        // Get behavior data for this goal
        const behaviorData = await BehaviorData.query()
          .where('goal_id', goal.id)

        console.log(`  Found ${behaviorData.length} behavior data entries`)

        // Calculate average (simplified - no date filtering for now)
        const avgPercentage = behaviorData.length > 0
          ? behaviorData.reduce((sum, data) => sum + data.percentage, 0) / behaviorData.length
          : 0

        await GoalProgress.create({
          progressReportId: report.id,
          goalId: goal.id,
          currentLevel: Math.round(avgPercentage),
          targetLevel: 80,
          progress: avgPercentage > 70 ? 'improving' : avgPercentage > 50 ? 'maintaining' : 'regressing',
          notes: `Average performance: ${avgPercentage.toFixed(1)}%`,
        })

        console.log(`  ✅ Goal progress created for goal ${goal.id}`)
      }

      console.log('✅ All goal progress entries created')

      // Load goals for each goal progress with their treatment goal details
      const goalProgressEntries = await GoalProgress.query()
        .where('progress_report_id', report.id)
      
      // Manually load the goals
      const goalIds = goalProgressEntries.map(gp => gp.goalId)
      const goals = await TreatmentGoal.query().whereIn('id', goalIds)
      const goalsMap = new Map(goals.map(g => [g.id, g]))

      console.log('✅ Report loaded with relationships')

      return response.status(201).json({
        message: 'Progress report generated successfully',
        data: {
          id: report.id,
          clientId: report.clientId,
          generatedBy: report.generatedBy,
          reportPeriod: report.reportPeriod,
          overallSummary: report.overallSummary,
          recommendations: report.recommendations,
          goals: goalProgressEntries.map(goalProgress => {
            const goal = goalsMap.get(goalProgress.goalId)
            return {
              goalId: goalProgress.goalId,
              goalTitle: goal?.title || 'Unknown Goal',
              currentLevel: goalProgress.currentLevel,
              targetLevel: goalProgress.targetLevel,
              progress: goalProgress.progress,
              notes: goalProgress.notes,
            }
          }),
          createdAt: report.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ Generate Progress Report Error:', error)
      return response.status(400).json({
        message: 'Failed to generate progress report',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 3).join('\n')
      })
    }
  }

  /**
   * Get treatment goals
   */
  async getTreatmentGoals({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = request.input('clientId')

      let query = TreatmentGoal.query()
        .where('created_by', user.id)
        .preload('client')

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      const goals = await query.orderBy('created_at', 'desc')

      return response.json({
        data: goals.map(goal => ({
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client?.fullName || 'Unknown Client',
          title: goal.title,
          description: goal.description,
          status: goal.status,
          createdAt: goal.createdAt.toISO()
        }))
      })
    } catch (error) {
      console.error('Get treatment goals error:', error)
      return response.status(500).json({
        message: 'Failed to fetch treatment goals',
        error: error.message
      })
    }
  }

  /**
   * Get users (RBTs supervised by this BCBA)
   */
  async getUsers({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const role = request.input('role')

      let query = User.query()
        .where('supervisor_id', user.id)
        .where('is_active', true)

      if (role) {
        query = query.where('role', role)
      }

      const users = await query.orderBy('name', 'asc')

      return response.json({
        data: users.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          phone: u.phone
        }))
      })
    } catch (error) {
      console.error('Get users error:', error)
      return response.status(500).json({
        message: 'Failed to fetch users',
        error: error.message
      })
    }
  }

  /**
   * Create supervision session
   */
  async createSupervisionSession({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { rbtId, date, duration, notes } = request.only([
        'rbtId',
        'date', 
        'duration',
        'notes'
      ])

      console.log('📊 Create Supervision Session Request:', {
        rbtId,
        date,
        duration,
        notes,
        bcbaId: user.id
      })

      // Verify BCBA supervises this RBT
      const rbt = await User.query()
        .where('id', rbtId)
        .where('supervisor_id', user.id)
        .where('role', 'RBT')
        .first()

      if (!rbt) {
        console.log('❌ RBT not found or not supervised by this BCBA')
        return response.status(404).json({
          message: 'RBT not found or you do not supervise this RBT'
        })
      }

      console.log('✅ RBT verified:', rbt.name)

      // Create supervision session (using schedules table for now)
      const Schedule = (await import('#models/schedule')).default
      
      // Get a dummy client ID for supervision sessions
      const dummyClient = await Client.query().first()
      
      if (!dummyClient) {
        console.log('❌ No clients found in database')
        return response.status(500).json({
          message: 'System error: No clients available'
        })
      }

      console.log('📅 Creating supervision session...')
      
      const supervisionSession = await Schedule.create({
        clientId: dummyClient.id,
        rbtId: rbt.id,
        bcbaId: user.id,
        date: DateTime.fromISO(date),
        startTime: '09:00:00',
        endTime: '10:00:00',
        location: 'clinic', // Using 'clinic' as location since 'supervision' is not in ENUM
        status: 'scheduled',
        notes: `[SUPERVISION SESSION] Duration: ${duration} minutes. ${notes || ''}`
      })

      console.log('✅ Supervision session created:', supervisionSession.id)

      return response.status(201).json({
        message: 'Supervision session scheduled successfully',
        data: {
          id: supervisionSession.id,
          rbtId: supervisionSession.rbtId,
          rbtName: rbt.name,
          date: supervisionSession.date.toISODate(),
          duration,
          notes: supervisionSession.notes,
          createdAt: supervisionSession.createdAt.toISO()
        }
      })
    } catch (error) {
      console.error('❌ Supervision creation error:', error)
      console.error('Stack:', error.stack)
      return response.status(400).json({
        message: 'Failed to schedule supervision session',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 5).join('\n')
      })
    }
  }

  /**
   * Get supervision schedule
   */
  async getSupervisionSchedule({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Get supervised RBTs with their recent activity
      const supervisedRbts = await User.query()
        .where('supervisor_id', user.id)
        .where('role', 'RBT')
        .where('is_active', true)

      const supervisionData = []

      for (const rbt of supervisedRbts) {
        // Get recent sessions by this RBT
        const recentSessions = await SessionLog.query()
          .where('rbt_id', rbt.id)
          .where('bcba_id', user.id)
          .orderBy('created_at', 'desc')
          .limit(5)

        // Calculate supervision metrics
        const totalSessions = await SessionLog.query()
          .where('rbt_id', rbt.id)
          .where('bcba_id', user.id)
          .count('* as total')

        const approvedSessions = await SessionLog.query()
          .where('rbt_id', rbt.id)
          .where('bcba_id', user.id)
          .where('bcba_approved', true)
          .count('* as total')

        const approvalRate = totalSessions[0].$extras.total > 0
          ? (approvedSessions[0].$extras.total / totalSessions[0].$extras.total) * 100
          : 0

        supervisionData.push({
          rbt: {
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
            hourlyRate: rbt.hourlyRate,
          },
          metrics: {
            totalSessions: totalSessions[0].$extras.total,
            approvedSessions: approvedSessions[0].$extras.total,
            approvalRate: Math.round(approvalRate),
          },
          recentSessions: recentSessions.length,
          lastSupervision: recentSessions[0]?.createdAt.toISO() || null,
        })
      }

      return response.json({
        data: supervisionData,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch supervision schedule',
        error: error.message,
      })
    }
  }

  /**
   * Get all sessions/schedule for BCBA's supervised RBTs
   */
  async getSchedule({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')
      const limit = request.input('limit', 1000)

      console.log(`🔍 BCBA Schedule Request:`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   User Role: ${user.role}`)
      console.log(`   Date Range: ${startDate} to ${endDate}`)

      // Build query for sessions where BCBA is assigned
      let query = SessionLog.query()
        .where('bcba_id', user.id)
        .preload('client')
        .preload('rbt')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client')
        })

      if (startDate) {
        query = query.where('date', '>=', startDate)
      }

      if (endDate) {
        query = query.where('date', '<=', endDate)
      }

      const sessions = await query
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')
        .limit(limit)

      console.log(`✅ Found ${sessions.length} sessions for BCBA ${user.id}`)

      return response.json({
        data: sessions.map(session => ({
          id: session.id,
          sessionType: session.sessionType,
          clientId: session.clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : null,
          rbtId: session.rbtId,
          rbtName: session.rbt.name,
          bcbaId: session.bcbaId,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          time: `${session.startTime} - ${session.endTime}`,
          duration: session.duration,
          location: session.location,
          locationAddress: session.locationAddress,
          status: session.status,
          notes: session.sessionNotes,
          isRecurring: session.isRecurring,
          recurrencePattern: session.recurrencePattern,
          participantCount: session.sessionType !== 'one_to_one' 
            ? session.participants?.length || 0 
            : 1,
          participants: session.participants?.map((p) => ({
            id: p.id,
            clientId: p.clientId,
            clientName: p.client?.fullName || `Client ${p.clientId}`,
          })) || [],
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch schedule',
        error: error.message,
      })
    }
  }

  /**
   * Get single session details for BCBA
   */
  async getSessionDetails({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`🔍 BCBA Session Details Request:`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   Session ID: ${sessionId}`)

      // Get session with all relations
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('bcba_id', user.id) // Ensure BCBA has access
        .preload('client')
        .preload('rbt')
        .preload('bcba')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client')
        })
        .firstOrFail()

      console.log(`✅ Found session ${sessionId} for BCBA ${user.id}`)

      // Get all occurrences if this is a recurring session
      let allOccurrences: any[] = []
      if (session.isRecurring) {
        const occurrencesQuery = session.isSeriesMaster
          ? SessionLog.query().where('parent_session_id', session.id).orWhere('id', session.id)
          : SessionLog.query().where('parent_session_id', session.parentSessionId || session.id).orWhere('id', session.parentSessionId || session.id)
        
        const occurrences = await occurrencesQuery
          .where('bcba_id', user.id) // Ensure BCBA has access to all occurrences
          .select('id', 'date', 'start_time', 'end_time', 'occurrence_number', 'status')
          .orderBy('occurrence_number', 'asc')
        
        allOccurrences = occurrences.map((occ) => ({
          id: occ.id,
          date: occ.date instanceof DateTime ? occ.date.toISODate() : occ.date,
          startTime: occ.startTime,
          endTime: occ.endTime,
          occurrenceNumber: occ.occurrenceNumber,
          status: occ.status,
        }))
      }

      return response.json({
        id: session.id,
        sessionType: session.sessionType,
        clientId: session.clientId,
        clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : null,
        client: session.client ? {
          id: session.client.id,
          name: `${session.client.firstName} ${session.client.lastName}`,
          fullName: session.client.fullName,
          age: session.client.age,
          dateOfBirth: session.client.dateOfBirth?.toISODate(),
        } : null,
        rbtId: session.rbtId,
        rbtName: session.rbt.name,
        rbt: {
          id: session.rbt.id,
          name: session.rbt.name,
          email: session.rbt.email,
        },
        bcbaId: session.bcbaId,
        bcbaName: session.bcba.name,
        bcba: {
          id: session.bcba.id,
          name: session.bcba.name,
          email: session.bcba.email,
        },
        date: session.date.toISODate(),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        totalHours: session.totalHours,
        location: session.location,
        locationAddress: session.locationAddress,
        status: session.status,
        sessionNotes: session.sessionNotes,
        cptCode: session.cptCode,
        serviceType: session.serviceType,
        isRecurring: session.isRecurring,
        recurrencePattern: session.recurrencePattern,
        recurrenceDays: session.recurrenceDays,
        recurrenceEndDate: session.recurrenceEndDate?.toISODate(),
        recurrenceCount: session.recurrenceCount,
        isSeriesMaster: session.isSeriesMaster,
        occurrenceNumber: session.occurrenceNumber,
        parentSessionId: session.parentSessionId,
        allOccurrences,
        participantCount: session.sessionType !== 'one_to_one' 
          ? session.participants?.length || 0 
          : 1,
        participants: session.participants?.map((p) => ({
          id: p.id,
          clientId: p.clientId,
          clientName: p.client?.fullName || `Client ${p.clientId}`,
          client: p.client ? {
            id: p.client.id,
            name: p.client.fullName,
            age: p.client.age,
          } : null,
        })) || [],
        bcbaApproved: session.bcbaApproved,
        bcbaApprovedAt: session.bcbaApprovedAt?.toISO(),
        bcbaNotes: session.bcbaNotes,
        createdAt: session.createdAt.toISO(),
        updatedAt: session.updatedAt?.toISO(),
      })
    } catch (error) {
      console.error(`❌ Error fetching session ${params.id}:`, error)
      return response.status(404).json({
        message: 'Session not found or access denied',
        error: error.message,
      })
    }
  }
}
