import type { HttpContext } from '@adonisjs/core/http'
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
        .preload('behaviorData', (behaviorQuery) => {
          behaviorQuery.preload('goal')
        })
        .preload('incidents')
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
          behaviorData: session.behaviorData.map(data => ({
            id: data.id,
            goalId: data.goalId,
            goalTitle: data.goal.title,
            summary: data.summary,
          })),
          incidents: session.incidents.map(incident => ({
            id: incident.id,
            type: incident.type,
            severity: incident.severity,
            description: incident.description,
            actionTaken: incident.actionTaken,
            timestamp: incident.timestamp.toISO(),
          })),
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
      session.bcbaApprovedAt = new Date()
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

      // Verify BCBA has access to this client
      const client = await Client.query()
        .where('id', clientId)
        .where('assigned_bcba', user.id)
        .firstOrFail()

      // Get treatment goals for this client
      const treatmentGoals = await TreatmentGoal.query()
        .where('client_id', client.id)
        .where('status', 'active')

      // Create progress report
      const report = await ProgressReport.create({
        clientId: client.id,
        generatedBy: user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        overallSummary,
        recommendations,
        graphData: [], // You would populate this with actual graph data
      })

      // Create goal progress entries
      for (const goal of treatmentGoals) {
        // Get behavior data for this goal in the date range
        const behaviorData = await BehaviorData.query()
          .where('goal_id', goal.id)
          .whereHas('session', (sessionQuery) => {
            sessionQuery
              .whereBetween('date', [startDate, endDate])
              .where('status', 'approved')
          })

        const avgPercentage = behaviorData.length > 0
          ? behaviorData.reduce((sum, data) => sum + data.percentage, 0) / behaviorData.length
          : 0

        await GoalProgress.create({
          progressReportId: report.id,
          goalId: goal.id,
          currentLevel: avgPercentage,
          targetLevel: 80, // Default target
          progress: avgPercentage > 70 ? 'improving' : avgPercentage > 50 ? 'maintaining' : 'regressing',
          notes: `Average performance: ${avgPercentage.toFixed(1)}%`,
        })
      }

      // Load the complete report with relationships
      await report.load('goals', (goalsQuery) => {
        goalsQuery.preload('goal')
      })

      return response.status(201).json({
        message: 'Progress report generated successfully',
        data: {
          id: report.id,
          clientId: report.clientId,
          generatedBy: report.generatedBy,
          reportPeriod: report.reportPeriod,
          overallSummary: report.overallSummary,
          recommendations: report.recommendations,
          goals: report.goals.map(goalProgress => ({
            goalId: goalProgress.goalId,
            goalTitle: goalProgress.goal.title,
            currentLevel: goalProgress.currentLevel,
            targetLevel: goalProgress.targetLevel,
            progress: goalProgress.progress,
            notes: goalProgress.notes,
          })),
          createdAt: report.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to generate progress report',
        error: error.message,
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

      // Verify BCBA supervises this RBT
      const rbt = await User.query()
        .where('id', rbtId)
        .where('supervisor_id', user.id)
        .where('role', 'RBT')
        .firstOrFail()

      // Create supervision session (using schedules table for now)
      const Schedule = (await import('#models/schedule')).default
      const supervisionSession = await Schedule.create({
        clientId: null, // Supervision doesn't need a client
        rbtId: rbt.id,
        bcbaId: user.id,
        date: new Date(date),
        startTime: '09:00:00', // Default time
        endTime: '10:00:00',   // Default time  
        location: 'supervision',
        status: 'scheduled',
        notes: `Supervision session - Duration: ${duration} minutes. ${notes || ''}`
      })

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
      console.error('Supervision creation error:', error)
      return response.status(400).json({
        message: 'Failed to schedule supervision session',
        error: error.message
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
}