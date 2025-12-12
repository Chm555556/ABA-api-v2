import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import User from '#models/user'
import TreatmentGoal from '#models/treatment_goal'
import ProgressReport from '#models/progress_report'
import GoalProgress from '#models/goal_progress'
import BehaviorData from '#models/behavior_data'
import db from '@adonisjs/lucid/services/db'

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
          clientName: session.client?.fullName,
          rbtName: session.rbt?.name,
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
   * Get single client details
   */
  async getClient({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.id

      const client = await Client.query()
        .where('id', clientId)
        .where('assigned_bcba', user.id)
        .preload('bcba')
        .preload('parent')
        .preload('assignedRbts')
        .preload('clinic')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.where('status', 'active')
        })
        .firstOrFail()

      console.log('🔍 getClient - Client ID:', client.id)
      console.log('🔍 getClient - Assigned RBTs count:', client.assignedRbts.length)
      console.log('🔍 getClient - Assigned RBTs:', client.assignedRbts.map(r => ({ id: r.id, name: r.name })))

      return response.json({
        data: {
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          age: client.age,
          dateOfBirth: client.dateOfBirth.toISODate(),
          status: client.status,
          insuranceType: client.insuranceType,
          insuranceId: client.insuranceId,
          phone: client.phone,
          email: client.email,
          street: client.street,
          city: client.city,
          state: client.state,
          zipCode: client.zipCode,
          emergencyContactName: client.emergencyContactName,
          emergencyContactPhone: client.emergencyContactPhone,
          emergencyContactRelationship: client.emergencyContactRelationship,
          diagnosis: client.diagnosis,
          bcbaName: client.bcba?.name || 'Not assigned',
          parent: client.parent ? {
            id: client.parent.id,
            name: client.parent.name,
            email: client.parent.email,
            phone: client.parent.phone,
            address: client.parent.address,
            role: client.parent.role,
            isActive: client.parent.isActive,
          } : null,
          assignedRbts: client.assignedRbts.map(rbt => ({
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
          })),
          clinic: client.clinic ? {
            id: client.clinic.id,
            name: client.clinic.name,
            street: client.clinic.street,
            city: client.clinic.city,
            state: client.clinic.state,
          } : null,
          treatmentGoals: client.treatmentGoals.map(goal => {
            // Safely parse JSON fields with fallback for comma-separated strings
            let promptHierarchy = null
            if (goal.promptHierarchy) {
              try {
                // Try to parse as JSON first
                promptHierarchy = JSON.parse(goal.promptHierarchy)
              } catch (e) {
                // If JSON parsing fails, try to split comma-separated string
                if (typeof goal.promptHierarchy === 'string' && goal.promptHierarchy.includes(',')) {
                  promptHierarchy = goal.promptHierarchy.split(',').map((item: string) => item.trim())
                } else if (typeof goal.promptHierarchy === 'string') {
                  // Single item, wrap in array
                  promptHierarchy = [goal.promptHierarchy.trim()]
                } else {
                  promptHierarchy = null
                }
              }
            }

            return {
              id: goal.id,
              title: goal.title,
              description: goal.description,
              targetBehavior: goal.targetBehavior,
              measurementType: goal.measurementType,
              masteryCriteria: goal.masteryCriteria,
              status: goal.status,
              domain: goal.domain,
              promptHierarchy: promptHierarchy,
              baselineScore: goal.baselineScore,
              baselineTrials: goal.baselineTrials,
              targetPercentage: goal.targetPercentage,
              consecutiveSessions: goal.consecutiveSessions,
              goalPhase: goal.goalPhase,
              createdBy: goal.createdBy,
              createdAt: goal.createdAt.toISO(),
              updatedAt: goal.updatedAt?.toISO(),
            }
          }),
          admissionDate: client.admissionDate.toISODate(),
          createdAt: client.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(404).json({
        message: 'Client not found or access denied',
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
        .preload('bcba')
        .preload('clinic')
        .preload('assignedRbts')
        .preload('parent')
        // Temporarily disabled to debug
        // .preload('treatmentGoals', (goalsQuery) => {
        //   goalsQuery.where('status', 'active')
        // })
        .orderBy('first_name', 'asc')

      console.log('🔍 getClients - Total clients:', clients.length)
      clients.forEach(c => {
        console.log(`🔍 Client ${c.id} (${c.fullName}) - RBTs:`, c.assignedRbts.length, c.assignedRbts.map(r => r.name))
      })

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
          insuranceId: client.insuranceId,
          phone: client.phone,
          email: client.email,
          street: client.street,
          city: client.city,
          state: client.state,
          zipCode: client.zipCode,
          emergencyContactName: client.emergencyContactName,
          emergencyContactPhone: client.emergencyContactPhone,
          emergencyContactRelationship: client.emergencyContactRelationship,
          diagnosis: client.diagnosis,
          admissionDate: client.admissionDate.toISODate(),
          bcbaName: client.bcba?.name || 'Not assigned',
          clinicId: client.clinicId,
          clinic: client.clinic ? {
            id: client.clinic.id,
            name: client.clinic.name,
            street: client.clinic.street,
            city: client.clinic.city,
            state: client.clinic.state,
          } : null,
          parent: client.parent ? {
            id: client.parent.id,
            name: client.parent.name,
            email: client.parent.email,
            phone: client.parent.phone,
          } : null,
          assignedRbts: client.assignedRbts.map(rbt => ({
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
          })),
          treatmentGoals: [], // Temporarily disabled to debug
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
          clientName: session.client?.fullName || 'Unknown Client',
          rbtId: session.rbtId,
          rbtName: session.rbt?.name || 'Unknown RBT',
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

      // Use raw SQL to avoid model serialization issues with new fields
      let sqlQuery = `
        SELECT 
          tg.id,
          tg.client_id as clientId,
          tg.title,
          tg.description,
          tg.target_behavior as targetBehavior,
          tg.measurement_type as measurementType,
          tg.mastery_criteria as masteryCriteria,
          tg.status,
          tg.domain,
          tg.prompt_hierarchy as promptHierarchy,
          tg.baseline_score as baselineScore,
          tg.baseline_trials as baselineTrials,
          tg.target_percentage as targetPercentage,
          tg.consecutive_sessions as consecutiveSessions,
          tg.goal_phase as goalPhase,
          tg.created_by as createdBy,
          tg.created_at,
          tg.updated_at,
          CONCAT(c.first_name, ' ', c.last_name) as clientName
        FROM treatment_goals tg
        LEFT JOIN clients c ON tg.client_id = c.id
        WHERE tg.created_by = ?
      `
      
      const params = [user.id]
      
      if (clientId) {
        sqlQuery += ' AND tg.client_id = ?'
        params.push(clientId)
      }
      
      sqlQuery += ' ORDER BY tg.created_at DESC'
      
      const rawResult = await db.rawQuery(sqlQuery, params)
      const goals = rawResult[0] // Get the actual results from the first element



      return response.json({
        data: goals.map((goal: any) => {
          // Safely parse JSON fields with fallback for comma-separated strings
          let promptHierarchy = null
          if (goal.promptHierarchy) {
            try {
              // Try to parse as JSON first
              promptHierarchy = JSON.parse(goal.promptHierarchy)
            } catch (e) {
              // If JSON parsing fails, try to split comma-separated string
              if (typeof goal.promptHierarchy === 'string' && goal.promptHierarchy.includes(',')) {
                promptHierarchy = goal.promptHierarchy.split(',').map((item: string) => item.trim())
              } else if (typeof goal.promptHierarchy === 'string') {
                // Single item, wrap in array
                promptHierarchy = [goal.promptHierarchy.trim()]
              } else {
                console.warn('Failed to parse promptHierarchy:', goal.promptHierarchy)
                promptHierarchy = null
              }
            }
          }

          return {
            id: goal.id,
            clientId: goal.clientId,
            clientName: goal.clientName || 'Unknown Client',
            title: goal.title || '',
            description: goal.description || '',
            targetBehavior: goal.targetBehavior || '',
            measurementType: goal.measurementType || '',
            masteryCriteria: goal.masteryCriteria || '',
            status: goal.status || 'active',
            domain: goal.domain || '',
            promptHierarchy: promptHierarchy,
            baselineScore: goal.baselineScore,
            baselineTrials: goal.baselineTrials,
            targetPercentage: goal.targetPercentage,
            consecutiveSessions: goal.consecutiveSessions,
            goalPhase: goal.goalPhase || 'acquisition',
            createdBy: goal.createdBy,
            createdAt: goal.created_at ? new Date(goal.created_at).toISOString() : new Date().toISOString(),
            updatedAt: goal.updated_at ? new Date(goal.updated_at).toISOString() : null,
          }
        })
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
      const clientId = request.input('clientId')
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')
      const limit = request.input('limit', 1000)

      console.log(`🔍 BCBA Schedule Request:`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   User Role: ${user.role}`)
      console.log(`   Client ID: ${clientId}`)
      console.log(`   Date Range: ${startDate} to ${endDate}`)

      // Build query for sessions where BCBA is assigned
      let query = SessionLog.query()
        .where('bcba_id', user.id)
        .preload('client')
        .preload('rbt')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client')
        })

      // Filter by specific client if provided
      if (clientId) {
        query = query.where((builder) => {
          builder
            .where('client_id', clientId) // For one-to-one sessions
            .orWhereHas('participants', (participantQuery) => {
              participantQuery.where('client_id', clientId) // For group sessions
            })
        })
      }

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

      console.log(`✅ Found ${sessions.length} sessions for BCBA ${user.id}${clientId ? ` (filtered by client ${clientId})` : ''}`)

      return response.json({
        data: sessions.map(session => ({
          id: session.id,
          sessionType: session.sessionType,
          clientId: session.clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : null,
          rbtId: session.rbtId,
          rbtName: session.rbt?.name || 'Unknown RBT',
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
        .preload('client', (clientQuery) => {
          clientQuery.preload('clinic')
        })
        .preload('rbt')
        .preload('bcba')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client', (clientQuery) => {
            clientQuery.preload('clinic')
          })
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
          diagnosis: session.client.diagnosis,
          clinicName: session.client.clinic?.name,
        } : null,
        rbtId: session.rbtId,
        rbtName: session.rbt?.name || 'Unknown RBT',
        rbt: session.rbt ? {
          id: session.rbt.id,
          name: session.rbt.name,
          email: session.rbt.email,
        } : null,
        bcbaId: session.bcbaId,
        bcbaName: session.bcba?.name || 'Unknown BCBA',
        bcba: session.bcba ? {
          id: session.bcba.id,
          name: session.bcba.name,
          email: session.bcba.email,
        } : null,
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
          clientAge: p.client?.age,
          clinicName: p.client?.clinic?.name,
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

  /**
   * Create a new session
   */
  async createSession({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const data = request.only([
        'sessionType',
        'clientId',
        'clientIds',
        'rbtId',
        'date',
        'startTime',
        'endTime',
        'duration',
        'totalHours',
        'location',
        'locationAddress',
        'sessionNotes',
        'cptCode',
        'serviceType',
        'status',
        'isRecurring',
        'recurrencePattern',
        'recurrenceDays',
        'recurrenceEndDate',
        'recurrenceCount',
      ])

      console.log('📝 BCBA creating session:', data)

      // Verify the RBT is supervised by this BCBA
      const rbt = await User.query()
        .where('id', data.rbtId)
        .where('supervisor_id', user.id)
        .where('role', 'RBT')
        .first()

      if (!rbt) {
        return response.status(403).json({
          message: 'You can only create sessions for RBTs you supervise',
        })
      }

      // Prepare session data
      const sessionData: any = {
        sessionType: data.sessionType || 'one_to_one',
        rbtId: data.rbtId,
        bcbaId: user.id,
        date: DateTime.fromISO(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        totalHours: data.totalHours,
        location: data.location,
        locationAddress: data.locationAddress || null,
        sessionNotes: data.sessionNotes || null,
        cptCode: data.cptCode || '97153',
        serviceType: data.serviceType || 'Direct Service',
        status: data.status || 'draft',
        rbtSignature: rbt.name,
        isRecurring: data.isRecurring || false,
        recurrencePattern: data.recurrencePattern || null,
        recurrenceDays: data.recurrenceDays || null,
        recurrenceEndDate: data.recurrenceEndDate ? DateTime.fromISO(data.recurrenceEndDate) : null,
        recurrenceCount: data.recurrenceCount || null,
      }

      // Handle one-to-one session
      if (data.sessionType === 'one_to_one') {
        if (!data.clientId) {
          return response.status(400).json({
            message: 'Client ID is required for one-to-one sessions',
          })
        }

        // Verify client is assigned to this BCBA
        const client = await Client.query()
          .where('id', data.clientId)
          .where('assigned_bcba', user.id)
          .first()

        if (!client) {
          return response.status(403).json({
            message: 'Client not found or not assigned to you',
          })
        }

        sessionData.clientId = data.clientId
        sessionData.sessionType = 'one_to_one'

        // Create the session
        const session = await SessionLog.create(sessionData)

        // If recurring, create additional occurrences
        if (data.isRecurring && data.recurrenceCount && data.recurrenceCount > 1) {
          await this.createRecurringOccurrences(session, data)
        }

        await session.load('client')
        await session.load('rbt')
        await session.load('bcba')

        console.log('✅ One-to-one session created:', session.id)

        return response.status(201).json({
          message: 'Session created successfully',
          session: {
            id: session.id,
            sessionType: session.sessionType,
            clientId: session.clientId,
            clientName: session.client?.fullName,
            rbtId: session.rbtId,
            rbtName: session.rbt?.name,
            bcbaId: session.bcbaId,
            bcbaName: session.bcba?.name,
            date: session.date.toISODate(),
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            location: session.location,
            status: session.status,
            isRecurring: session.isRecurring,
          },
        })
      }

      // Handle group/community sessions
      if (data.sessionType === 'group' || data.sessionType === 'community') {
        if (!data.clientIds || data.clientIds.length === 0) {
          return response.status(400).json({
            message: 'At least one client is required for group/community sessions',
          })
        }

        // Verify all clients are assigned to this BCBA
        const clients = await Client.query()
          .whereIn('id', data.clientIds)
          .where('assigned_bcba', user.id)

        if (clients.length !== data.clientIds.length) {
          return response.status(403).json({
            message: 'Some clients are not assigned to you',
          })
        }

        // Create the master session (without clientId for group sessions)
        sessionData.clientId = null
        sessionData.isSeriesMaster = true

        const masterSession = await SessionLog.create(sessionData)

        // Create participant records
        const SessionParticipant = (await import('#models/session_participant')).default
        const participants = data.clientIds.map((clientId: number) => ({
          sessionLogId: masterSession.id,
          clientId: clientId,
        }))

        await SessionParticipant.createMany(participants)

        // If recurring, create additional occurrences
        if (data.isRecurring && data.recurrenceCount && data.recurrenceCount > 1) {
          await this.createRecurringOccurrences(masterSession, data, data.clientIds)
        }

        await masterSession.load('rbt')
        await masterSession.load('bcba')
        await masterSession.load('participants')

        console.log('✅ Group/community session created:', masterSession.id)

        return response.status(201).json({
          message: 'Session created successfully',
          session: {
            id: masterSession.id,
            sessionType: masterSession.sessionType,
            participantCount: participants.length,
            rbtId: masterSession.rbtId,
            rbtName: masterSession.rbt?.name,
            bcbaId: masterSession.bcbaId,
            bcbaName: masterSession.bcba?.name,
            date: masterSession.date.toISODate(),
            startTime: masterSession.startTime,
            endTime: masterSession.endTime,
            duration: masterSession.duration,
            location: masterSession.location,
            status: masterSession.status,
            isRecurring: masterSession.isRecurring,
          },
        })
      }

      return response.status(400).json({
        message: 'Invalid session type',
      })
    } catch (error: any) {
      console.error('❌ Error creating session:', error)
      return response.status(500).json({
        message: 'Failed to create session',
        error: error.message,
      })
    }
  }

  /**
   * Helper method to create recurring session occurrences
   */
  private async createRecurringOccurrences(
    masterSession: any,
    data: any,
    clientIds?: number[]
  ) {
    const occurrences: any[] = []
    let currentDate = DateTime.fromISO(data.date)
    const SessionParticipant = (await import('#models/session_participant')).default

    for (let i = 1; i < data.recurrenceCount; i++) {
      // Calculate next occurrence date based on pattern
      if (data.recurrencePattern === 'daily') {
        currentDate = currentDate.plus({ days: 1 })
      } else if (data.recurrencePattern === 'weekly') {
        currentDate = currentDate.plus({ weeks: 1 })
      } else if (data.recurrencePattern === 'monthly') {
        currentDate = currentDate.plus({ months: 1 })
      }

      // Check if we've reached the end date
      if (data.recurrenceEndDate) {
        const endDate = DateTime.fromISO(data.recurrenceEndDate)
        if (currentDate > endDate) break
      }

      // Create occurrence
      const occurrenceData = {
        sessionType: masterSession.sessionType,
        clientId: masterSession.clientId,
        rbtId: masterSession.rbtId,
        bcbaId: masterSession.bcbaId,
        date: currentDate,
        startTime: masterSession.startTime,
        endTime: masterSession.endTime,
        duration: masterSession.duration,
        totalHours: masterSession.totalHours,
        location: masterSession.location,
        locationAddress: masterSession.locationAddress,
        sessionNotes: masterSession.sessionNotes,
        cptCode: masterSession.cptCode,
        serviceType: masterSession.serviceType,
        status: masterSession.status,
        rbtSignature: masterSession.rbtSignature,
        isRecurring: true,
        recurrencePattern: masterSession.recurrencePattern,
        recurrenceDays: masterSession.recurrenceDays,
        recurrenceEndDate: masterSession.recurrenceEndDate,
        recurrenceCount: masterSession.recurrenceCount,
        parentSessionId: masterSession.id,
        occurrenceNumber: i + 1,
      }

      const occurrence = await SessionLog.create(occurrenceData)

      // If group/community session, create participants
      if (clientIds && clientIds.length > 0) {
        const participants = clientIds.map((clientId: number) => ({
          sessionLogId: occurrence.id,
          clientId: clientId,
        }))
        await SessionParticipant.createMany(participants)
      }

      occurrences.push(occurrence)
    }

    console.log(`✅ Created ${occurrences.length} recurring occurrences`)
    return occurrences
  }

  /**
   * Update client
   */
  async updateClient({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.id

      console.log('📝 BCBA updating client:', clientId, 'by user:', user.id)

      // Find client and verify BCBA has access
      const client = await Client.query()
        .where('id', clientId)
        .where('assigned_bcba', user.id)
        .firstOrFail()

      console.log('✅ Client found:', client.fullName)

      const clientData = request.only([
        'firstName',
        'lastName',
        'dateOfBirth',
        'street',
        'city',
        'state',
        'zipCode',
        'phone',
        'email',
        'emergencyContactName',
        'emergencyContactRelationship',
        'emergencyContactPhone',
        'insuranceType',
        'insuranceId',
        'diagnosis',
        'status',
        'clinicId',
        'parentId',
        'assignedRbts',
      ])

      console.log('📝 Update data received:', clientData)

      // Parse date of birth if provided
      if (clientData.dateOfBirth) {
        let parsedDate: DateTime
        try {
          if (clientData.dateOfBirth instanceof Date) {
            parsedDate = DateTime.fromJSDate(clientData.dateOfBirth)
          } else {
            parsedDate = DateTime.fromISO(String(clientData.dateOfBirth))
          }

          if (!parsedDate.isValid) {
            throw new Error(`Invalid date: ${clientData.dateOfBirth}`)
          }
          clientData.dateOfBirth = parsedDate
        } catch (dateError) {
          console.error('❌ Date parsing error:', dateError)
          return response.status(400).json({
            success: false,
            message: 'Invalid date format. Expected YYYY-MM-DD',
            error: 'INVALID_DATE',
          })
        }
      }

      // Update client fields
      client.merge({
        firstName: clientData.firstName || client.firstName,
        lastName: clientData.lastName || client.lastName,
        dateOfBirth: clientData.dateOfBirth || client.dateOfBirth,
        phone: clientData.phone !== undefined ? clientData.phone : client.phone,
        email: clientData.email !== undefined ? clientData.email : client.email,
        insuranceType: clientData.insuranceType || client.insuranceType,
        insuranceId: clientData.insuranceId !== undefined ? clientData.insuranceId : client.insuranceId,
        status: clientData.status || client.status,
        street: clientData.street !== undefined ? clientData.street : client.street,
        city: clientData.city !== undefined ? clientData.city : client.city,
        state: clientData.state !== undefined ? clientData.state : client.state,
        zipCode: clientData.zipCode !== undefined ? clientData.zipCode : client.zipCode,
        emergencyContactName: clientData.emergencyContactName !== undefined ? clientData.emergencyContactName : client.emergencyContactName,
        emergencyContactRelationship: clientData.emergencyContactRelationship !== undefined ? clientData.emergencyContactRelationship : client.emergencyContactRelationship,
        emergencyContactPhone: clientData.emergencyContactPhone !== undefined ? clientData.emergencyContactPhone : client.emergencyContactPhone,
        diagnosis: clientData.diagnosis !== undefined ? clientData.diagnosis : client.diagnosis,
        clinicId: clientData.clinicId !== undefined ? clientData.clinicId : client.clinicId,
        parentId: clientData.parentId !== undefined ? clientData.parentId : client.parentId,
      })

      await client.save()

      console.log('✅ Client updated successfully')

      // Update RBT assignments if provided
      if (clientData.assignedRbts !== undefined) {
        try {
          console.log('🔵 Updating RBT assignments:', clientData.assignedRbts)
          console.log('🔵 Client ID:', client.id)
          
          // Remove existing RBT assignments
          const deleteResult = await db.rawQuery('DELETE FROM client_rbts WHERE client_id = ?', [client.id])
          console.log('🔵 Deleted existing RBT assignments:', deleteResult)
          
          // Add new RBT assignments
          if (Array.isArray(clientData.assignedRbts) && clientData.assignedRbts.length > 0) {
            console.log('🔵 Looking for RBTs with IDs:', clientData.assignedRbts)
            
            const rbts = await User.query()
              .whereIn('id', clientData.assignedRbts)
              .where('role', 'RBT')
            
            console.log('🔵 Found RBTs:', rbts.map(r => ({ id: r.id, name: r.name, role: r.role })))
            
            if (rbts.length > 0) {
              const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
              
              for (const rbtId of clientData.assignedRbts) {
                const rbt = rbts.find(r => r.id === rbtId)
                if (rbt) {
                  console.log('🔵 Inserting RBT assignment:', { clientId: client.id, rbtId, now })
                  const insertResult = await db.rawQuery(
                    'INSERT INTO client_rbts (client_id, rbt_id, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [client.id, rbtId, now, now, now]
                  )
                  console.log('🔵 Insert result:', insertResult)
                } else {
                  console.warn('⚠️ RBT ID not found in valid RBTs:', rbtId)
                }
              }
              
              console.log('✅ RBT assignments updated successfully')
            } else {
              console.warn('⚠️ No valid RBTs found for IDs:', clientData.assignedRbts)
            }
          } else {
            console.log('🔵 No RBTs to assign (empty or not array)')
          }
        } catch (rbtError) {
          console.error('⚠️ RBT assignment update failed (non-fatal):', rbtError)
          console.error('⚠️ Error stack:', rbtError.stack)
        }
      } else {
        console.log('🔵 assignedRbts is undefined, skipping RBT update')
      }

      // Reload relationships to get fresh data (especially assignedRbts after update)
      await client.refresh()
      await client.load('bcba')
      await client.load('assignedRbts')
      
      console.log('🔍 updateClient - After reload, RBTs:', client.assignedRbts.length, client.assignedRbts.map(r => ({ id: r.id, name: r.name })))

      return response.json({
        success: true,
        message: 'Client updated successfully',
        data: {
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          dateOfBirth: client.dateOfBirth.toISODate(),
          age: client.age,
          status: client.status,
          insuranceType: client.insuranceType,
          insuranceId: client.insuranceId,
          clinicId: client.clinicId,
          bcbaName: client.bcba?.name || 'Not assigned',
          assignedRbts: client.assignedRbts.map(rbt => ({
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
          })),
          admissionDate: client.admissionDate.toISODate(),
          createdAt: client.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ Update client error:', error)
      return response.status(404).json({
        success: false,
        message: 'Client not found or access denied',
        error: error.message,
      })
    }
  }

  /**
   * Delete client
   */
  async deleteClient({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.id

      console.log('🗑️ BCBA deleting client:', clientId, 'by user:', user.id)

      // Find client and verify BCBA has access
      const client = await Client.query()
        .where('id', clientId)
        .where('assigned_bcba', user.id)
        .firstOrFail()

      console.log('✅ Client found:', client.fullName)

      // Delete the client (cascade deletes should handle related records)
      await client.delete()

      console.log('✅ Client deleted successfully')

      return response.json({
        success: true,
        message: 'Client deleted successfully',
      })
    } catch (error) {
      console.error('❌ Delete client error:', error)
      return response.status(404).json({
        success: false,
        message: 'Client not found or access denied',
        error: error.message,
      })
    }
  }

  /**
   * Create new client (BCBA can create clients)
   */
  async createClient({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      
      console.log('🔵 BCBA createClient called by user:', user.id, 'clinic:', user.clinicId)
      console.log('🔵 Request body:', JSON.stringify(request.all(), null, 2))
      
      // Check if user has a clinic assigned
      if (!user.clinicId) {
        console.error('❌ BCBA does not have a clinic assigned:', user.id, user.email)
        return response.status(400).json({
          success: false,
          message: 'Your account is not associated with a clinic. Please contact your administrator.',
          error: 'CLINIC_NOT_ASSIGNED',
        })
      }

      const clientData = request.only([
        'firstName',
        'lastName',
        'dateOfBirth',
        'street',
        'city',
        'state',
        'zipCode',
        'phone',
        'email',
        'emergencyContactName',
        'emergencyContactRelationship',
        'emergencyContactPhone',
        'insuranceType',
        'insuranceId',
        'diagnosis',
        'clinicId',
        'assignedRbts',
        'parentId',
      ])

      console.log('🔵 Client data received:', clientData)

      // Parse date of birth
      let parsedDate: DateTime
      try {
        if (clientData.dateOfBirth instanceof Date) {
          parsedDate = DateTime.fromJSDate(clientData.dateOfBirth)
        } else {
          parsedDate = DateTime.fromISO(String(clientData.dateOfBirth))
        }

        if (!parsedDate.isValid) {
          throw new Error(`Invalid date: ${clientData.dateOfBirth}`)
        }
        console.log('🔵 Parsed date of birth:', parsedDate.toISODate())
      } catch (dateError) {
        console.error('❌ Date parsing error:', dateError)
        return response.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD',
          error: 'INVALID_DATE',
        })
      }

      console.log('🔵 Creating client with clinicId:', clientData.clinicId || user.clinicId)

      // Create the client
      const client = await Client.create({
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        dateOfBirth: parsedDate,
        clinicId: clientData.clinicId || user.clinicId, // Use provided clinicId or user's clinicId
        assignedBcba: user.id, // Assign the creating BCBA
        parentId: clientData.parentId || null, // Assign parent if provided
        status: 'active',
        admissionDate: DateTime.now(),
        // Required fields with defaults
        street: clientData.street || 'Not provided',
        city: clientData.city || 'Not provided',
        state: clientData.state || 'Not provided',
        zipCode: clientData.zipCode || '00000',
        phone: clientData.phone || 'Not provided',
        emergencyContactName: clientData.emergencyContactName || 'Not provided',
        emergencyContactRelationship: clientData.emergencyContactRelationship || 'Not provided',
        emergencyContactPhone: clientData.emergencyContactPhone || 'Not provided',
        insuranceType: clientData.insuranceType,
        insuranceId: clientData.insuranceId || 'Not provided',
        // Optional fields
        email: clientData.email || null,
        diagnosis: clientData.diagnosis || null,
      })

      console.log('🔵 Client created successfully:', client.id)

      // Assign RBTs if provided (optional - won't fail client creation if this fails)
      if (clientData.assignedRbts && Array.isArray(clientData.assignedRbts) && clientData.assignedRbts.length > 0) {
        try {
          console.log('🔵 Assigning RBTs:', clientData.assignedRbts)
          console.log('🔵 RBT IDs type:', typeof clientData.assignedRbts[0])
          
          // Verify RBTs exist and are RBTs (removed supervisor check)
          const rbts = await User.query()
            .whereIn('id', clientData.assignedRbts)
            .where('role', 'RBT')
          
          console.log('🔵 Found RBTs:', rbts.map(r => ({ id: r.id, name: r.name, role: r.role })))
          
          if (rbts.length === 0) {
            console.warn('⚠️ No RBTs found with provided IDs:', clientData.assignedRbts)
            console.warn('⚠️ Checking all users with these IDs...')
            const allUsers = await User.query().whereIn('id', clientData.assignedRbts)
            console.warn('⚠️ Found users:', allUsers.map(u => ({ id: u.id, name: u.name, role: u.role })))
          } else {
            if (rbts.length !== clientData.assignedRbts.length) {
              console.warn('⚠️ Some provided IDs are not valid RBTs')
              console.warn('⚠️ Requested:', clientData.assignedRbts)
              console.warn('⚠️ Found:', rbts.map(r => r.id))
            }
            
            // Use raw SQL to insert into pivot table with assigned_at timestamp
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
            
            for (const rbtId of clientData.assignedRbts) {
              // Check if this RBT exists in the valid RBTs list
              if (rbts.find(r => r.id === rbtId)) {
                console.log('🔵 Inserting RBT assignment:', { clientId: client.id, rbtId, now })
                const result = await db.rawQuery(
                  'INSERT INTO client_rbts (client_id, rbt_id, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                  [client.id, rbtId, now, now, now]
                )
                console.log('🔵 Insert result:', result)
              } else {
                console.warn('⚠️ Skipping RBT ID (not in valid list):', rbtId)
              }
            }
            
            console.log('✅ RBTs assigned successfully')
          }
        } catch (rbtError) {
          console.error('⚠️ RBT assignment failed (non-fatal):', rbtError)
          console.error('⚠️ Error stack:', rbtError.stack)
          // Continue anyway - client was created successfully
        }
      } else {
        console.log('🔵 No RBTs to assign:', {
          hasAssignedRbts: !!clientData.assignedRbts,
          isArray: Array.isArray(clientData.assignedRbts),
          length: clientData.assignedRbts?.length
        })
      }

      // Load relationships
      await client.load('bcba')
      await client.load('assignedRbts')

      return response.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: {
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          dateOfBirth: client.dateOfBirth.toISODate(),
          age: client.age,
          status: client.status,
          insuranceType: client.insuranceType,
          insuranceId: client.insuranceId,
          clinicId: client.clinicId,
          bcbaName: client.bcba?.name || 'Not assigned',
          assignedRbts: client.assignedRbts.map(rbt => ({
            id: rbt.id,
            name: rbt.name,
            email: rbt.email,
          })),
          admissionDate: client.admissionDate.toISODate(),
          createdAt: client.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ BCBA createClient error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
      })
      
      return response.status(400).json({
        success: false,
        message: 'Failed to create client',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  }

  /**
   * Get all parents
   */
  async getParents({ response }: HttpContext) {
    try {
      // Get all parents (including pending verification)
      const parents = await User.query()
        .where('role', 'PARENT')
        .orderBy('name', 'asc')

      return response.json({
        data: parents.map(parent => ({
          id: parent.id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone,
          address: parent.address,
          isActive: parent.isActive,
          verified: parent.verified,
        }))
      })
    } catch (error) {
      console.error('❌ Get parents error:', error)
      return response.status(500).json({
        message: 'Failed to fetch parents',
        error: error.message
      })
    }
  }

  /**
   * Create a new parent user
   */
  async createParent({ request, response }: HttpContext) {
    try {
      const { name, email, phone, address, password } = request.only([
        'name',
        'email',
        'phone',
        'address',
        'password'
      ])

      console.log('📝 Creating parent account:', { name, email, hasPassword: !!password })

      // Validate required fields
      if (!name || !email || !password) {
        return response.status(400).json({
          message: 'Name, email, and password are required'
        })
      }

      // Validate password length
      if (password.length < 8) {
        return response.status(400).json({
          message: 'Password must be at least 8 characters long'
        })
      }

      // Check if email already exists
      const existingUser = await User.findBy('email', email)
      if (existingUser) {
        return response.status(400).json({
          message: 'A user with this email already exists'
        })
      }

      // Create parent user - pending admin verification
      const parent = await User.create({
        name,
        email,
        password, // Password will be hashed automatically by the model
        role: 'PARENT',
        phone: phone || null,
        address: address || null,
        isActive: false, // Set to false - admin must activate
        verified: false, // Set to false - admin must verify
        permissions: [], // Parents have default permissions
      })

      console.log('✅ Parent account created (pending verification):', {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        role: parent.role,
        verified: parent.verified,
        isActive: parent.isActive
      })

      return response.status(201).json({
        success: true,
        message: 'Parent account created successfully. Pending admin verification before they can log in.',
        data: {
          id: parent.id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone,
          address: parent.address,
          isActive: parent.isActive,
          verified: parent.verified,
        }
      })
    } catch (error) {
      console.error('❌ Create parent error:', error)
      return response.status(400).json({
        message: 'Failed to create parent account',
        error: error.message
      })
    }
  }
}
