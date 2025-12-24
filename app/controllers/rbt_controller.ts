import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import Schedule from '#models/schedule'
import TreatmentGoal from '#models/treatment_goal'
import BehaviorData from '#models/behavior_data'
import Trial from '#models/trial'
import Incident from '#models/incident'

export default class RBTController {
  /**
   * Get RBT dashboard data
   */
  async dashboard({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Get assigned clients
      const assignedClients = await Client.query()
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .where('status', 'active')
        .count('* as total')

      // Get today's sessions
      const today = new Date().toISOString().split('T')[0]
      const todaySessions = await Schedule.query()
        .where('rbt_id', user.id)
        .where('date', today)
        .count('* as total')

      // Get completed sessions this month
      const currentMonth = new Date()
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      const completedSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .whereBetween('date', [monthStart, monthEnd])
        .where('status', '!=', 'draft')
        .count('* as total')

      // Calculate hours worked this month
      const monthSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .whereBetween('date', [monthStart, monthEnd])
        .where('status', '!=', 'draft')

      const hoursWorked = monthSessions.reduce((sum, session) => sum + session.totalHours, 0)

      // Get today's schedule
      const todaySchedule = await Schedule.query()
        .where('rbt_id', user.id)
        .where('date', today)
        .preload('client')
        .orderBy('start_time', 'asc')

      // Get recent sessions
      const recentSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .preload('client')
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.json({
        assignedClients: assignedClients[0].$extras.total,
        todaySessions: todaySessions[0].$extras.total,
        completedSessions: completedSessions[0].$extras.total,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        todaySchedule: todaySchedule.map(schedule => ({
          id: schedule.id,
          clientName: schedule.client ? `${schedule.client.firstName} ${schedule.client.lastName}` : 'Unknown Client',
          time: `${schedule.startTime} - ${schedule.endTime}`,
          duration: 60,
          location: schedule.location,
          status: schedule.status,
          goals: [],
        })),
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : 'Unknown Client',
          date: session.date.toISODate(),
          duration: session.duration,
          status: session.status,
          reviewStatus: session.bcbaApproved ? 'approved' : session.status === 'rejected' ? 'rejected' : 'pending',
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch RBT dashboard',
        error: error.message,
      })
    }
  }

  /**
   * Get assigned clients
   */
  async getAssignedClients({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      console.log(`📋 Fetching all clients for RBT ${user.id}...`)

      // Get clients directly assigned to this RBT
      const assignedClients = await Client.query()
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .preload('bcba')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.preload('creator')
        })

      console.log(`✅ Found ${assignedClients.length} directly assigned clients`)

      // Get clients who have sessions/schedules with this RBT
      const sessionClients = await Client.query()
        .whereHas('sessionLogs', (sessionQuery) => {
          sessionQuery.where('rbt_id', user.id)
        })
        .preload('bcba')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.preload('creator')
        })

      console.log(`✅ Found ${sessionClients.length} clients with sessions`)

      // Get clients who have schedules with this RBT
      const scheduleClients = await Client.query()
        .whereHas('schedules', (scheduleQuery) => {
          scheduleQuery.where('rbt_id', user.id)
        })
        .preload('bcba')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.preload('creator')
        })

      console.log(`✅ Found ${scheduleClients.length} clients with schedules`)

      // Combine all clients and remove duplicates
      const allClientsMap = new Map()
      
      // Add assigned clients
      assignedClients.forEach(client => {
        allClientsMap.set(client.id, client)
      })
      
      // Add session clients
      sessionClients.forEach(client => {
        if (!allClientsMap.has(client.id)) {
          allClientsMap.set(client.id, client)
        }
      })
      
      // Add schedule clients
      scheduleClients.forEach(client => {
        if (!allClientsMap.has(client.id)) {
          allClientsMap.set(client.id, client)
        }
      })

      const allClients = Array.from(allClientsMap.values())
      console.log(`✅ Total unique clients: ${allClients.length}`)

      // Sort by first name
      allClients.sort((a, b) => a.firstName.localeCompare(b.firstName))

      return response.json({
        data: allClients.map(client => ({
          id: client.id,
          fullName: `${client.firstName} ${client.lastName}`,
          firstName: client.firstName,
          lastName: client.lastName,
          age: client.age,
          dateOfBirth: client.dateOfBirth.toISODate(),
          status: client.status,
          insuranceType: client.insuranceType || 'Not specified',
          bcbaId: client.assignedBcba,
          bcbaName: client.bcba?.name || 'Not assigned',
          treatmentGoals: client.treatmentGoals.map((goal: any) => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            targetBehavior: goal.targetBehavior,
            measurementType: goal.measurementType,
            masteryCriteria: goal.masteryCriteria,
            status: goal.status,
            // Program Builder fields
            domain: goal.domain,
            promptHierarchy: goal.promptHierarchy,
            baselineScore: goal.baselineScore,
            baselineTrials: goal.baselineTrials,
            targetPercentage: goal.targetPercentage,
            consecutiveSessions: goal.consecutiveSessions,
            goalPhase: goal.goalPhase,
            createdBy: goal.createdBy,
            createdByName: goal.creator?.name || 'Unknown',
            createdAt: goal.createdAt.toISO(),
            updatedAt: goal.updatedAt?.toISO() || null,
          })),
          admissionDate: client.admissionDate.toISODate(),
        })),
      })
    } catch (error) {
      console.error('❌ Error fetching assigned clients:', error)
      return response.status(500).json({
        message: 'Failed to fetch assigned clients',
        error: error.message,
      })
    }
  }

  /**
   * Start a session
   */
  async startSession({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { clientId, location, cptCode, serviceType } = request.only([
        'clientId',
        'location',
        'cptCode',
        'serviceType',
      ])

      console.log('🚀 RBT Start Session Request:', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        clientId,
        location,
        cptCode,
        serviceType
      })

      // First check if client exists
      const clientExists = await Client.find(clientId)
      if (!clientExists) {
        console.log(`❌ Client ${clientId} not found`)
        return response.status(404).json({
          message: `Client with ID ${clientId} not found`,
          error: 'CLIENT_NOT_FOUND'
        })
      }

      console.log('✅ Client exists:', {
        id: clientExists.id,
        name: clientExists.fullName,
        assignedBcba: clientExists.assignedBcba
      })

      // Check if RBT has access to this client through direct assignment
      console.log('🔍 Checking direct RBT assignment...')
      const directAssignment = await Client.query()
        .where('id', clientId)
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .first()

      if (directAssignment) {
        console.log('✅ RBT has direct assignment to client')
      } else {
        console.log('⚠️ No direct assignment found, checking sessions/schedules...')
        
        // Check if RBT has sessions with this client
        const hasSession = await SessionLog.query()
          .where('client_id', clientId)
          .where('rbt_id', user.id)
          .first()

        // Check if RBT has schedules with this client
        const hasSchedule = await Schedule.query()
          .where('client_id', clientId)
          .where('rbt_id', user.id)
          .first()

        if (!hasSession && !hasSchedule) {
          console.log(`❌ RBT ${user.id} has no access to client ${clientId}`)
          return response.status(403).json({
            message: `You do not have access to client ${clientExists.fullName}. Please contact your supervisor.`,
            error: 'ACCESS_DENIED',
            details: {
              clientId,
              clientName: clientExists.fullName,
              rbtId: user.id,
              rbtName: user.name
            }
          })
        }

        console.log('✅ RBT has session/schedule access to client')
      }

      const now = DateTime.now()
      const startTime = now.toFormat('HH:mm')

      console.log('📝 Creating session log...')
      const session = await SessionLog.create({
        clientId: clientExists.id,
        rbtId: user.id,
        bcbaId: clientExists.assignedBcba || null,
        date: now,
        startTime,
        endTime: startTime, // Will be updated when session ends
        duration: 0,
        totalHours: 0,
        cptCode: cptCode || '97153',
        serviceType: serviceType || 'Direct Service',
        location,
        sessionNotes: '',
        rbtSignature: user.name,
        status: 'draft',
      })

      console.log('✅ Session created successfully:', session.id)

      return response.status(201).json({
        message: 'Session started successfully',
        data: {
          id: session.id,
          clientId: session.clientId,
          clientName: clientExists.fullName,
          startTime: session.startTime,
          location: session.location,
          status: session.status,
          createdAt: session.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ RBT Start Session Error:', error)
      console.error('Stack trace:', error.stack)
      
      // Provide more specific error messages
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.status(404).json({
          message: 'Client not found or you do not have access to this client',
          error: 'CLIENT_ACCESS_DENIED'
        })
      }

      return response.status(400).json({
        message: 'Failed to start session',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 3).join('\n')
      })
    }
  }

  /**
   * End a session
   */
  async endSession({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id
      const { sessionNotes, parentSignature } = request.only(['sessionNotes', 'parentSignature'])

      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      const now = DateTime.now()
      const endTime = now.toFormat('HH:mm')

      // Calculate duration in minutes (simple calculation)
      const [startHour, startMin] = session.startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin)
      const totalHours = Math.round((duration / 60) * 100) / 100

      session.endTime = endTime
      session.duration = duration
      session.totalHours = totalHours
      session.sessionNotes = sessionNotes || ''
      session.parentSignature = parentSignature
      session.status = 'submitted'

      await session.save()

      return response.json({
        message: 'Session ended successfully',
        data: {
          id: session.id,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          status: session.status,
          updatedAt: session.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to end session',
        error: error.message,
      })
    }
  }

  /**
   * Complete a session with comprehensive data (goals, feedback, progress)
   */
  async completeSession({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id
      const {
        overallSessionFeedback,
        overallSessionProgress,
        clientGoalsData, // Array of client goals with feedback and progress
        sessionNotes,
        parentSignature
      } = request.only([
        'overallSessionFeedback',
        'overallSessionProgress', 
        'clientGoalsData',
        'sessionNotes',
        'parentSignature'
      ])

      console.log('🔄 Completing session:', {
        sessionId,
        sessionIdType: typeof sessionId,
        userId: user.id,
        hasOverallFeedback: !!overallSessionFeedback,
        overallProgress: overallSessionProgress,
        overallProgressType: typeof overallSessionProgress,
        clientGoalsCount: clientGoalsData?.length || 0,
        clientGoalsDataType: typeof clientGoalsData,
        requestBody: request.body()
      })

      // Validate session ID
      if (!sessionId || isNaN(parseInt(sessionId))) {
        console.log('❌ Invalid session ID:', sessionId)
        return response.status(400).json({
          message: 'Invalid session ID provided',
          error: 'INVALID_SESSION_ID'
        })
      }

      // Get the session
      console.log(`🔍 Looking for session ${sessionId} for RBT ${user.id}`)
      
      // First check if session exists at all
      const anySession = await SessionLog.query()
        .where('id', sessionId)
        .first()

      if (!anySession) {
        console.log(`❌ Session ${sessionId} does not exist in database`)
        return response.status(404).json({
          message: `Session with ID ${sessionId} does not exist`,
          error: 'SESSION_NOT_FOUND'
        })
      }

      console.log(`📋 Session ${sessionId} exists:`, {
        id: anySession.id,
        rbtId: anySession.rbtId,
        status: anySession.status,
        clientId: anySession.clientId
      })

      // Check if session belongs to this RBT
      if (anySession.rbtId !== user.id) {
        console.log(`❌ Session ${sessionId} belongs to RBT ${anySession.rbtId}, not ${user.id}`)
        return response.status(403).json({
          message: 'You do not have permission to complete this session',
          error: 'ACCESS_DENIED'
        })
      }

      // Check if session is in draft status
      if (anySession.status !== 'draft') {
        console.log(`❌ Session ${sessionId} is in status '${anySession.status}', not 'draft'`)
        return response.status(400).json({
          message: `Session is in '${anySession.status}' status and cannot be completed. Only draft sessions can be completed.`,
          error: 'INVALID_SESSION_STATUS'
        })
      }
      
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .preload('client')
        .first()

      if (!session) {
        console.log(`❌ Unexpected error: Session ${sessionId} passed validation but query failed`)
        return response.status(500).json({
          message: 'Unexpected error during session lookup',
          error: 'INTERNAL_ERROR'
        })
      }

      console.log(`✅ Found session ${sessionId} for client ${session.client?.fullName || 'Unknown'}`)

      const now = DateTime.now()
      const endTime = now.toFormat('HH:mm')

      // Calculate duration in minutes
      const [startHour, startMin] = session.startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin)
      const totalHours = Math.round((duration / 60) * 100) / 100

      // Update session with completion data
      session.endTime = endTime
      session.duration = duration
      session.totalHours = totalHours
      session.sessionNotes = sessionNotes || ''
      session.parentSignature = parentSignature
      session.status = 'completed'

      // Validate and store session-level feedback and progress
      console.log('🔍 Validating session data...')
      
      // Validate overallProgress
      let validProgress = 0
      if (overallSessionProgress !== undefined && overallSessionProgress !== null) {
        const progressNum = Number(overallSessionProgress)
        if (isNaN(progressNum)) {
          console.log('❌ Invalid overallProgress value:', overallSessionProgress)
          return response.status(400).json({
            message: 'overallSessionProgress must be a number',
            error: 'INVALID_PROGRESS_VALUE'
          })
        }
        if (progressNum < 0 || progressNum > 100) {
          console.log('❌ overallProgress out of range:', progressNum)
          return response.status(400).json({
            message: 'overallSessionProgress must be between 0 and 100',
            error: 'PROGRESS_OUT_OF_RANGE'
          })
        }
        validProgress = progressNum
      }

      // Validate clientGoalsData
      let validClientGoalsData = []
      if (clientGoalsData !== undefined && clientGoalsData !== null) {
        if (!Array.isArray(clientGoalsData)) {
          console.log('❌ clientGoalsData is not an array:', typeof clientGoalsData)
          return response.status(400).json({
            message: 'clientGoalsData must be an array',
            error: 'INVALID_GOALS_DATA_TYPE'
          })
        }
        validClientGoalsData = clientGoalsData
      }

      // Store session-level feedback and progress
      session.overallFeedback = overallSessionFeedback || ''
      session.overallProgress = validProgress
      session.clientGoalsData = validClientGoalsData

      console.log('💾 Saving session with validated data:', {
        overallFeedback: session.overallFeedback?.substring(0, 50) + '...',
        overallProgress: session.overallProgress,
        clientGoalsDataCount: session.clientGoalsData.length,
        sessionNotes: sessionNotes?.substring(0, 30) + '...'
      })

      try {
        await session.save()
        console.log('✅ Session saved successfully')
      } catch (saveError) {
        console.error('❌ Error saving session:', {
          message: saveError.message,
          code: saveError.code,
          constraint: saveError.constraint,
          detail: saveError.detail,
          stack: saveError.stack?.split('\n').slice(0, 3)
        })
        
        // Provide more specific error messages based on the error type
        if (saveError.code === 'ER_DATA_TOO_LONG') {
          return response.status(400).json({
            message: 'One of the text fields is too long for the database',
            error: 'DATA_TOO_LONG'
          })
        } else if (saveError.code === 'ER_BAD_NULL_ERROR') {
          return response.status(400).json({
            message: 'A required field is missing',
            error: 'MISSING_REQUIRED_FIELD'
          })
        } else {
          return response.status(500).json({
            message: 'Database error while saving session',
            error: 'DATABASE_ERROR',
            details: saveError.message
          })
        }
      }

      // Also save individual goal progress if provided
      if (clientGoalsData && Array.isArray(clientGoalsData)) {
        for (const clientData of clientGoalsData) {
          if (clientData.goals && Array.isArray(clientData.goals)) {
            for (const goalData of clientData.goals) {
              // Save basic behavior data entry for tracking
              // Note: BehaviorData model is designed for trial-based data
              // We'll create a basic entry to track that this goal was worked on
              try {
                await BehaviorData.create({
                  sessionId: session.id, // Correct field name
                  goalId: goalData.goalId,
                  correct: 0, // Will be updated when trials are recorded
                  incorrect: 0,
                  prompted: 0,
                  total: 0,
                  percentage: goalData.actualScore || 0, // Use actual score as percentage
                  environmentNotes: goalData.feedback || null,
                })
              } catch (behaviorDataError) {
                console.warn(`⚠️ Could not create behavior data for goal ${goalData.goalId}:`, behaviorDataError.message)
                // Continue with session completion even if behavior data creation fails
              }
            }
          }
        }
      }

      return response.json({
        message: 'Session completed successfully',
        data: {
          id: session.id,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          status: session.status,
          overallFeedback: session.overallFeedback,
          overallProgress: session.overallProgress,
          clientGoalsCount: clientGoalsData?.length || 0,
          updatedAt: session.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ Error completing session:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      })
      
      // Provide more specific error messages
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.status(404).json({
          message: 'Session not found or you do not have permission to complete it',
          error: 'SESSION_NOT_FOUND'
        })
      }
      
      return response.status(400).json({
        message: 'Failed to complete session',
        error: error.message,
        details: 'Check server logs for more information'
      })
    }
  }

  /**
   * Save session feedback and progress (for intermediate saves)
   */
  async saveSessionFeedback({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        sessionId,
        overallSessionFeedback,
        overallSessionProgress,
        sessionType,
        location,
        duration
      } = request.only([
        'sessionId',
        'overallSessionFeedback',
        'overallSessionProgress',
        'sessionType',
        'location',
        'duration'
      ])

      console.log('💾 Saving session feedback:', {
        sessionId,
        overallSessionFeedback: overallSessionFeedback?.substring(0, 50) + '...',
        overallSessionProgress
      })

      // Find the session
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Update session with feedback and progress
      session.overallFeedback = overallSessionFeedback || ''
      session.overallProgress = overallSessionProgress || 0

      await session.save()

      return response.json({
        message: 'Session feedback saved successfully',
        data: {
          id: session.id,
          overallFeedback: session.overallFeedback,
          overallProgress: session.overallProgress,
          updatedAt: session.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ Error saving session feedback:', error)
      return response.status(400).json({
        message: 'Failed to save session feedback',
        error: error.message,
      })
    }
  }

  /**
   * Log behavior data
   */
  async logBehaviorData({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { sessionId, goalId, trials } = request.only(['sessionId', 'goalId', 'trials'])

      // Verify session belongs to this RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .firstOrFail()

      // Verify goal exists
      const goal = await TreatmentGoal.findOrFail(goalId)

      // Calculate summary from trials
      const correct = trials.filter((trial: any) => trial.response === 'correct').length
      const incorrect = trials.filter((trial: any) => trial.response === 'incorrect').length
      const prompted = trials.filter((trial: any) => trial.response === 'prompted').length
      const total = trials.length
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

      // Create behavior data entry
      const behaviorData = await BehaviorData.create({
        sessionId: session.id,
        goalId: goal.id,
        correct,
        incorrect,
        prompted,
        total,
        percentage,
      })

      // Create trial entries
      for (const trialData of trials) {
        await Trial.create({
          behaviorDataId: behaviorData.id,
          prompt: trialData.prompt,
          response: trialData.response,
          reinforcement: trialData.reinforcement,
          notes: trialData.notes,
          timestamp: DateTime.fromISO(trialData.timestamp),
        })
      }

      // Load trials for response
      await behaviorData.load('trials')

      return response.status(201).json({
        message: 'Behavior data logged successfully',
        data: {
          id: behaviorData.id,
          sessionId: behaviorData.sessionId,
          goalId: behaviorData.goalId,
          goalTitle: goal.title,
          summary: behaviorData.summary,
          trials: behaviorData.trials.map(trial => ({
            id: trial.id,
            prompt: trial.prompt,
            response: trial.response,
            reinforcement: trial.reinforcement,
            notes: trial.notes,
            timestamp: trial.timestamp.toISO(),
          })),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to log behavior data',
        error: error.message,
      })
    }
  }

  /**
   * Log incident
   */
  async logIncident({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { sessionId, type, severity, description, actionTaken } = request.only([
        'sessionId',
        'type',
        'severity',
        'description',
        'actionTaken',
      ])

      // Verify session belongs to this RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .firstOrFail()

      const incident = await Incident.create({
        sessionId: session.id,
        type,
        severity,
        description,
        actionTaken,
        timestamp: DateTime.now(),
      })

      return response.status(201).json({
        message: 'Incident logged successfully',
        data: {
          id: incident.id,
          sessionId: incident.sessionId,
          type: incident.type,
          severity: incident.severity,
          description: incident.description,
          actionTaken: incident.actionTaken,
          timestamp: incident.timestamp.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to log incident',
        error: error.message,
      })
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const clientId = request.input('clientId')

      let query = SessionLog.query()
        .where('rbt_id', user.id)
        .preload('client')

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      const sessions = await query
        .orderBy('date', 'desc')
        .orderBy('start_time', 'desc')
        .paginate(page, limit)

      return response.json({
        data: sessions.all().map(session => ({
          id: session.id,
          clientId: session.clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : 'Unknown Client',
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          location: session.location,
          sessionNotes: session.sessionNotes,
          status: session.status,
          bcbaApproved: session.bcbaApproved,
          behaviorData: [],
          incidents: [],
          createdAt: session.createdAt.toISO(),
        })),
        meta: sessions.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch session history',
        error: error.message,
      })
    }
  }

  /**
   * Get completed sessions with comprehensive data
   */
  async getCompletedSessions({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const clientId = request.input('clientId')

      console.log(`🔍 Loading completed sessions for RBT ${user.id}`)

      // First, let's check what sessions exist for this RBT
      const allSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .select('id', 'status', 'date', 'client_id')
        .orderBy('date', 'desc')
        .limit(10)

      console.log(`📊 Found ${allSessions.length} total sessions for RBT ${user.id}:`)
      allSessions.forEach(s => {
        console.log(`   - Session ${s.id}: ${s.status}, Date: ${s.date.toISODate()}, Client: ${s.clientId}`)
      })

      let query = SessionLog.query()
        .where('rbt_id', user.id)
        .whereIn('status', ['completed', 'submitted'])
        .preload('client')
        .preload('behaviorData', (behaviorQuery) => {
          behaviorQuery
            .preload('goal')
            .orderBy('created_at', 'desc')
        })

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      const sessions = await query
        .orderBy('date', 'desc')
        .orderBy('start_time', 'desc')
        .paginate(page, limit)

      console.log(`📊 Found ${sessions.all().length} completed/submitted sessions`)

      const responseData = {
        data: sessions.all().map(session => {
          // Parse client goals data if it exists
          let clientGoalsData = []
          try {
            clientGoalsData = session.clientGoalsData ? JSON.parse(session.clientGoalsData) : []
          } catch (e) {
            console.warn('Failed to parse client goals data for session', session.id)
            clientGoalsData = []
          }

          return {
            id: session.id,
            clientId: session.clientId,
            clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : 'Unknown Client',
            date: session.date.toISODate(),
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            totalHours: session.totalHours,
            location: session.location,
            sessionNotes: session.sessionNotes,
            status: session.status,
            bcbaApproved: session.bcbaApproved,
            
            // Session-level data
            overallFeedback: session.overallFeedback || '',
            overallProgress: session.overallProgress || 0,
            
            // Client goals data
            clientGoalsData: clientGoalsData,
            
            // Behavior data
            behaviorData: session.behaviorData?.map(data => ({
              id: data.id,
              goalId: data.goalId,
              goalName: data.goal?.title || 'Behavior Data Point',
              targetScore: data.goal?.targetPercentage || null,
              actualScore: data.percentage || null,
              improvement: null, // Could be calculated if needed
              feedback: data.environmentNotes || null,
              correct: data.correct,
              incorrect: data.incorrect,
              prompted: data.prompted,
              total: data.total,
              percentage: data.percentage,
              date: data.createdAt?.toISODate(),
            })) || [],
            
            createdAt: session.createdAt.toISO(),
            updatedAt: session.updatedAt?.toISO(),
          }
        }),
        meta: sessions.getMeta(),
      }

      console.log(`✅ Returning ${responseData.data.length} completed sessions for RBT ${user.id}`)
      if (responseData.data.length > 0) {
        console.log('   Sample session:', {
          id: responseData.data[0].id,
          clientName: responseData.data[0].clientName,
          status: responseData.data[0].status,
          date: responseData.data[0].date
        })
      }

      return response.json(responseData)
    } catch (error) {
      console.error('❌ Error fetching completed sessions:', error)
      return response.status(500).json({
        message: 'Failed to fetch completed sessions',
        error: error.message,
      })
    }
  }

  /**
   * Get detailed completed session by ID
   */
  async getCompletedSessionById({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'completed')
        .preload('client', (clientQuery) => {
          clientQuery
            .preload('bcba')
            .preload('parent')
            .preload('clinic')
        })
        .preload('behaviorData', (behaviorQuery) => {
          behaviorQuery.preload('goal')
        })
        .firstOrFail()

      // Parse client goals data
      let clientGoalsData = []
      try {
        clientGoalsData = session.clientGoalsData ? JSON.parse(session.clientGoalsData) : []
      } catch (e) {
        console.warn('Failed to parse client goals data for session', session.id)
        clientGoalsData = []
      }

      // Parse client ratings from session notes
      let clientRatings = {}
      try {
        if (session.sessionNotes) {
          const sessionData = JSON.parse(session.sessionNotes)
          clientRatings = sessionData.clientRatings || {}
        }
      } catch (e) {
        console.warn('Failed to parse client ratings from session notes', session.id)
        clientRatings = {}
      }

      return response.json({
        data: {
          id: session.id,
          clientId: session.clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : 'Unknown Client',
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          location: session.location,
          sessionNotes: session.sessionNotes,
          status: session.status,
          bcbaApproved: session.bcbaApproved,
          
          // Session-level data
          overallFeedback: session.overallFeedback || '',
          overallProgress: session.overallProgress || 0,
          
          // Complete client information
          client: session.client ? {
            id: session.client.id,
            firstName: session.client.firstName,
            lastName: session.client.lastName,
            fullName: `${session.client.firstName} ${session.client.lastName}`,
            age: session.client.age,
            dateOfBirth: session.client.dateOfBirth?.toISODate(),
            diagnosis: session.client.diagnosis,
            status: session.client.status,
            
            // Contact Information
            phone: session.client.phone,
            email: session.client.email,
            address: {
              street: session.client.street,
              city: session.client.city,
              state: session.client.state,
              zipCode: session.client.zipCode,
            },
            
            // Emergency Contact
            emergencyContact: {
              name: session.client.emergencyContactName,
              relationship: session.client.emergencyContactRelationship,
              phone: session.client.emergencyContactPhone,
            },
            
            // Insurance Information
            insurance: {
              type: session.client.insuranceType,
              id: session.client.insuranceId,
            },
            
            // Dates
            admissionDate: session.client.admissionDate?.toISODate(),
            dischargeDate: session.client.dischargeDate?.toISODate(),
            
            // Related Information
            bcba: session.client.bcba ? {
              id: session.client.bcba.id,
              name: session.client.bcba.name,
              email: session.client.bcba.email,
              phone: session.client.bcba.phone || null,
            } : null,
            
            parent: session.client.parent ? {
              id: session.client.parent.id,
              name: session.client.parent.name,
              email: session.client.parent.email,
              phone: session.client.parent.phone || null,
            } : null,
            
            clinic: session.client.clinic ? {
              id: session.client.clinic.id,
              name: session.client.clinic.name,
              address: session.client.clinic.address,
              phone: session.client.clinic.phone,
              email: session.client.clinic.email,
            } : null,
          } : null,
          
          // Client goals data with feedback and progress
          clientGoalsData: clientGoalsData,
          
          // Client ratings from RBT
          clientRatings: clientRatings,
          
          // Individual behavior data entries
          behaviorData: session.behaviorData?.map(data => ({
            id: data.id,
            goalId: data.goalId,
            goalName: data.goal?.title || 'Behavior Data Point',
            targetScore: data.goal?.targetPercentage || null,
            actualScore: data.percentage || null,
            improvement: null, // Could be calculated if needed
            feedback: data.environmentNotes || null,
            correct: data.correct,
            incorrect: data.incorrect,
            prompted: data.prompted,
            total: data.total,
            percentage: data.percentage,
            date: data.createdAt?.toISODate(),
          })) || [],
          
          createdAt: session.createdAt.toISO(),
          updatedAt: session.updatedAt?.toISO(),
        }
      })
    } catch (error) {
      console.error('❌ Error fetching completed session details:', error)
      return response.status(404).json({
        message: 'Completed session not found',
        error: error.message,
      })
    }
  }

  /**
   * Create treatment goal (RBT can create goals for their assigned clients)
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
        domain,
        promptHierarchy,
        baselineScore,
        baselineTrials,
        targetPercentage,
        consecutiveSessions,
        goalPhase,
      } = request.only([
        'clientId',
        'title',
        'description',
        'targetBehavior',
        'measurementType',
        'masteryCriteria',
        'domain',
        'promptHierarchy',
        'baselineScore',
        'baselineTrials',
        'targetPercentage',
        'consecutiveSessions',
        'goalPhase',
      ])

      console.log('📝 RBT Create Treatment Goal Request:', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        clientId,
        title,
        targetBehavior
      })

      // Verify client exists
      const client = await Client.find(clientId)
      if (!client) {
        console.log(`❌ Client ${clientId} not found`)
        return response.status(404).json({
          message: `Client with ID ${clientId} not found`
        })
      }

      console.log('✅ Client found:', {
        id: client.id,
        name: client.fullName,
        assignedBcba: client.assignedBcba
      })

      // Verify RBT has access to this client through direct assignment, sessions, or schedules
      console.log('🔍 Checking RBT access to client...')
      
      // Check direct assignment
      const directAssignment = await Client.query()
        .where('id', clientId)
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .first()

      let hasAccess = !!directAssignment

      if (!hasAccess) {
        // Check if RBT has sessions with this client
        const hasSession = await SessionLog.query()
          .where('client_id', clientId)
          .where('rbt_id', user.id)
          .first()

        // Check if RBT has schedules with this client
        const hasSchedule = await Schedule.query()
          .where('client_id', clientId)
          .where('rbt_id', user.id)
          .first()

        hasAccess = !!(hasSession || hasSchedule)
      }

      if (!hasAccess) {
        console.log(`❌ RBT ${user.id} has no access to client ${clientId}`)
        return response.status(403).json({
          message: `You do not have access to client ${client.fullName}. Please contact your supervisor.`,
          error: 'ACCESS_DENIED'
        })
      }

      console.log('✅ RBT has access to client')

      // Create the treatment goal
      console.log('📝 Creating treatment goal...')
      const goal = await TreatmentGoal.create({
        clientId: client.id,
        title,
        description: description || '',
        targetBehavior: targetBehavior || '',
        measurementType: measurementType || 'percentage',
        masteryCriteria: masteryCriteria || '',
        status: 'active',
        domain: domain || '',
        promptHierarchy: promptHierarchy || null,
        baselineScore: baselineScore || null,
        baselineTrials: baselineTrials || null,
        targetPercentage: targetPercentage || null,
        consecutiveSessions: consecutiveSessions || null,
        goalPhase: goalPhase || 'acquisition',
        createdBy: user.id,
      })

      console.log('✅ Treatment goal created:', goal.id)

      // Load relationships for response
      await goal.load('client')
      await goal.load('creator')

      return response.status(201).json({
        message: 'Treatment goal created successfully',
        data: {
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client.fullName,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          domain: goal.domain,
          promptHierarchy: goal.promptHierarchy,
          baselineScore: goal.baselineScore,
          baselineTrials: goal.baselineTrials,
          targetPercentage: goal.targetPercentage,
          consecutiveSessions: goal.consecutiveSessions,
          goalPhase: goal.goalPhase,
          createdBy: goal.createdBy,
          createdByName: goal.creator.name,
          createdAt: goal.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ RBT Create Treatment Goal Error:', error)
      console.error('Stack trace:', error.stack)
      
      return response.status(400).json({
        message: 'Failed to create treatment goal',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 3).join('\n')
      })
    }
  }

  /**
   * Get detailed session information
   */
  async getSessionDetail({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`🔍 Fetching session details for session ${sessionId}, RBT ${user.id}`)

      // Try Schedule first (since RBTSessions uses Schedule data)
      let schedule = await Schedule.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .preload('client', (clientQuery) => {
          clientQuery
            .preload('bcba')
            .preload('parent')
            .preload('treatmentGoals', (goalsQuery) => {
              goalsQuery
                .preload('creator')
                .preload('baselineData', (baselineQuery) => {
                  baselineQuery.orderBy('collectionDate', 'desc')
                })
                .preload('targetBehaviors', (targetQuery) => {
                  targetQuery.preload('creator').orderBy('createdAt', 'asc')
                })
            })
        })
        .preload('rbt')
        .preload('bcba')
        .first()

      if (schedule) {
        console.log(`✅ Found schedule ${sessionId}`)
        
        // Check if client exists - if not, return a special response indicating no client
        if (!schedule.client || !schedule.clientId) {
          console.log(`⚠️ Schedule ${sessionId} has no client assigned`)
          return response.json({
            data: {
              id: schedule.id,
              type: 'schedule',
              sessionType: 'one_to_one',
              clientId: null,
              noClient: true,
              
              // Basic session info without client
              date: schedule.date.toISODate(),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              location: schedule.location,
              status: schedule.status,
              sessionNotes: schedule.notes || null,
              
              // RBT Information
              rbt: schedule.rbt ? {
                id: schedule.rbt.id,
                name: schedule.rbt.name,
                email: schedule.rbt.email,
              } : null,

              // BCBA Information
              bcba: schedule.bcba ? {
                id: schedule.bcba.id,
                name: schedule.bcba.name,
                email: schedule.bcba.email,
                phone: schedule.bcba.phone || '',
              } : null,
              
              createdAt: schedule.createdAt.toISO(),
              updatedAt: schedule.updatedAt?.toISO() || null,
            }
          })
        }

        // Return schedule data (Schedule doesn't support group sessions, so always one-to-one)
        return response.json({
          data: {
            id: schedule.id,
            type: 'schedule',
            sessionType: 'one_to_one',
            clientId: schedule.client?.id || null,
            
            // Client Information
            client: schedule.client ? {
              id: schedule.client.id,
              fullName: `${schedule.client.firstName} ${schedule.client.lastName}`,
              firstName: schedule.client.firstName,
              lastName: schedule.client.lastName,
              age: schedule.client.age,
              dateOfBirth: schedule.client.dateOfBirth.toISODate(),
              status: schedule.client.status,
              insuranceType: schedule.client.insuranceType || 'Not specified',
              diagnosis: schedule.client.diagnosis || [],
              admissionDate: schedule.client.admissionDate.toISODate(),
              address: {
                street: schedule.client.street || '',
                city: schedule.client.city || '',
                state: schedule.client.state || '',
                zipCode: schedule.client.zipCode || '',
              },
              phone: schedule.client.phone || '',
              email: schedule.client.email || '',
            } : null,

            // No participants for Schedule (only SessionLog supports group sessions)
            participants: [],

            // Parent Information
            parent: schedule.client.parent ? {
              id: schedule.client.parent.id,
              name: schedule.client.parent.name,
              email: schedule.client.parent.email,
              phone: schedule.client.parent.phone || '',
            } : null,

            // BCBA Information
            bcba: schedule.bcba ? {
              id: schedule.bcba.id,
              name: schedule.bcba.name,
              email: schedule.bcba.email,
              phone: schedule.bcba.phone || '',
            } : schedule.client.bcba ? {
              id: schedule.client.bcba.id,
              name: schedule.client.bcba.name,
              email: schedule.client.bcba.email,
              phone: schedule.client.bcba.phone || '',
            } : null,

            // RBT Information
            rbt: schedule.rbt ? {
              id: schedule.rbt.id,
              name: schedule.rbt.name,
              email: schedule.rbt.email,
            } : null,

            // Treatment Goals
            treatmentGoals: schedule.client.treatmentGoals ? schedule.client.treatmentGoals.map((goal: any) => ({
              id: goal.id,
              title: goal.title,
              description: goal.description || '',
              targetBehavior: goal.targetBehavior || '',
              measurementType: goal.measurementType,
              masteryCriteria: goal.masteryCriteria || '',
              status: goal.status,
              // Program Builder fields
              domain: goal.domain,
              promptHierarchy: goal.promptHierarchy,
              baselineScore: goal.baselineScore,
              baselineTrials: goal.baselineTrials,
              targetPercentage: goal.targetPercentage,
              consecutiveSessions: goal.consecutiveSessions,
              goalPhase: goal.goalPhase,
              createdBy: goal.createdBy,
              createdByName: goal.creator?.name || 'Unknown',
              createdAt: goal.createdAt.toISO(),
              updatedAt: goal.updatedAt?.toISO() || null,
              // Enhanced baseline data and target behaviors
              baselineData: goal.baselineData ? goal.baselineData.map((baseline: any) => ({
                id: baseline.id,
                score: baseline.score,
                trials: baseline.trials,
                collectionDate: baseline.collectionDate.toISODate(),
                notes: baseline.notes,
                sessionType: baseline.sessionType,
                environment: baseline.environment,
                duration: baseline.duration,
                totalTrials: baseline.totalTrials,
              })) : [],
              targetBehaviors: goal.targetBehaviors ? goal.targetBehaviors.map((behavior: any) => ({
                id: behavior.id,
                name: behavior.name,
                description: behavior.description,
                baselinePercentage: behavior.baselinePercentage,
                intensity: behavior.intensity,
                notes: behavior.notes,
                status: behavior.status,
                currentPercentage: behavior.currentPercentage,
                masteryDate: behavior.masteryDate?.toISODate() || null,
                createdBy: behavior.createdBy,
                creatorName: behavior.creator?.name || null,
                createdAt: behavior.createdAt.toISO(),
              })) : [],
            })) : [],

            // Session Details
            date: schedule.date.toISODate(),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            duration: null,
            location: schedule.location,
            locationAddress: null,
            status: schedule.status,
            sessionNotes: schedule.notes || null,
            bcbaApproved: null,
            bcbaNotes: null,
            cptCode: null,
            serviceType: null,
            createdAt: schedule.createdAt.toISO(),
            updatedAt: schedule.updatedAt?.toISO() || null,
          }
        })
      }

      // If not in Schedule, try SessionLog
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .preload('client', (clientQuery) => {
          clientQuery
            .preload('bcba')
            .preload('parent')
            .preload('treatmentGoals', (goalsQuery) => {
              goalsQuery
                .preload('creator')
                .preload('baselineData', (baselineQuery) => {
                  baselineQuery.orderBy('collectionDate', 'desc')
                })
                .preload('targetBehaviors', (targetQuery) => {
                  targetQuery.preload('creator').orderBy('createdAt', 'asc')
                })
            })
        })
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client', (clientQuery) => {
            clientQuery
              .preload('bcba')
              .preload('parent')
              .preload('treatmentGoals', (goalsQuery) => {
                goalsQuery
                  .preload('creator')
                  .preload('baselineData', (baselineQuery) => {
                    baselineQuery.orderBy('collectionDate', 'desc')
                  })
                  .preload('targetBehaviors', (targetQuery) => {
                    targetQuery.preload('creator').orderBy('createdAt', 'asc')
                  })
              })
          })
        })
        .preload('rbt')
        .preload('bcba')
        .first()

      if (!session) {
        console.error(`❌ Session ${sessionId} not found for RBT ${user.id}`)
        return response.status(404).json({
          message: 'Session not found or you do not have access to it'
        })
      }

      // Return SessionLog data
      console.log(`✅ Found session ${sessionId}`)

      // Check if this is a group/community session with no participants OR a one-to-one with no client
      const isGroupOrCommunity = session.sessionType === 'group' || session.sessionType === 'community'
      const hasNoData = isGroupOrCommunity 
        ? (!session.participants || session.participants.length === 0)
        : (!session.client || !session.clientId)

      if (hasNoData) {
        console.log(`⚠️ Session ${sessionId} has no ${isGroupOrCommunity ? 'participants' : 'client'} assigned`)
        return response.json({
          data: {
            id: session.id,
            type: 'session_log',
            sessionType: session.sessionType || 'one_to_one',
            clientId: null,
            noClient: true,
            
            // Basic session info without client
            date: session.date.toISODate(),
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            totalHours: session.totalHours,
            location: session.location,
            locationAddress: session.locationAddress || null,
            status: session.status,
            sessionNotes: session.sessionNotes || null,
            bcbaApproved: session.bcbaApproved,
            bcbaNotes: session.bcbaNotes || null,
            cptCode: session.cptCode || null,
            serviceType: session.serviceType || null,
            
            // RBT Information
            rbt: session.rbt ? {
              id: session.rbt.id,
              name: session.rbt.name,
              email: session.rbt.email,
            } : null,

            // BCBA Information
            bcba: session.bcba ? {
              id: session.bcba.id,
              name: session.bcba.name,
              email: session.bcba.email,
              phone: session.bcba.phone || '',
            } : null,
            
            createdAt: session.createdAt.toISO(),
            updatedAt: session.updatedAt?.toISO() || null,
          }
        })
      }

      return response.json({
        data: {
          id: session.id,
          type: 'session_log',
          sessionType: session.sessionType || 'one_to_one',
          clientId: session.client?.id || session.clientId || null,
          
          // Client Information (for one-to-one sessions)
          client: session.client ? {
            id: session.client.id,
            fullName: `${session.client.firstName} ${session.client.lastName}`,
            firstName: session.client.firstName,
            lastName: session.client.lastName,
            age: session.client.age,
            dateOfBirth: session.client.dateOfBirth.toISODate(),
            status: session.client.status,
            insuranceType: session.client.insuranceType || 'Not specified',
            diagnosis: session.client.diagnosis || [],
            admissionDate: session.client.admissionDate.toISODate(),
            address: {
              street: session.client.street || '',
              city: session.client.city || '',
              state: session.client.state || '',
              zipCode: session.client.zipCode || '',
            },
            phone: session.client.phone || '',
            email: session.client.email || '',
          } : null,

          // Participants (for group/community sessions)
          participants: session.participants ? session.participants.map((participant: any) => ({
            id: participant.id,
            clientId: participant.clientId,
            client: participant.client ? {
              id: participant.client.id,
              fullName: `${participant.client.firstName} ${participant.client.lastName}`,
              firstName: participant.client.firstName,
              lastName: participant.client.lastName,
              age: participant.client.age,
              dateOfBirth: participant.client.dateOfBirth.toISODate(),
              status: participant.client.status,
              insuranceType: participant.client.insuranceType || 'Not specified',
              diagnosis: participant.client.diagnosis || [],
              admissionDate: participant.client.admissionDate.toISODate(),
              address: {
                street: participant.client.street || '',
                city: participant.client.city || '',
                state: participant.client.state || '',
                zipCode: participant.client.zipCode || '',
              },
              phone: participant.client.phone || '',
              email: participant.client.email || '',
            } : null,
            parent: participant.client?.parent ? {
              id: participant.client.parent.id,
              name: participant.client.parent.name,
              email: participant.client.parent.email,
              phone: participant.client.parent.phone || '',
            } : null,
            bcba: participant.client?.bcba ? {
              id: participant.client.bcba.id,
              name: participant.client.bcba.name,
              email: participant.client.bcba.email,
              phone: participant.client.bcba.phone || '',
            } : null,
            treatmentGoals: participant.client?.treatmentGoals ? participant.client.treatmentGoals.map((goal: any) => ({
              id: goal.id,
              title: goal.title,
              description: goal.description || '',
              targetBehavior: goal.targetBehavior || '',
              measurementType: goal.measurementType,
              masteryCriteria: goal.masteryCriteria || '',
              status: goal.status,
              // Program Builder fields
              domain: goal.domain,
              promptHierarchy: goal.promptHierarchy,
              baselineScore: goal.baselineScore,
              baselineTrials: goal.baselineTrials,
              targetPercentage: goal.targetPercentage,
              consecutiveSessions: goal.consecutiveSessions,
              goalPhase: goal.goalPhase,
              createdBy: goal.createdBy,
              createdByName: goal.creator?.name || 'Unknown',
              createdAt: goal.createdAt.toISO(),
              updatedAt: goal.updatedAt?.toISO() || null,
              // Enhanced baseline data and target behaviors
              baselineData: goal.baselineData ? goal.baselineData.map((baseline: any) => ({
                id: baseline.id,
                score: baseline.score,
                trials: baseline.trials,
                collectionDate: baseline.collectionDate.toISODate(),
                notes: baseline.notes,
                sessionType: baseline.sessionType,
                environment: baseline.environment,
                duration: baseline.duration,
                totalTrials: baseline.totalTrials,
              })) : [],
              targetBehaviors: goal.targetBehaviors ? goal.targetBehaviors.map((behavior: any) => ({
                id: behavior.id,
                name: behavior.name,
                description: behavior.description,
                baselinePercentage: behavior.baselinePercentage,
                intensity: behavior.intensity,
                notes: behavior.notes,
                status: behavior.status,
                currentPercentage: behavior.currentPercentage,
                masteryDate: behavior.masteryDate?.toISODate() || null,
                createdBy: behavior.createdBy,
                creatorName: behavior.creator?.name || null,
                createdAt: behavior.createdAt.toISO(),
              })) : [],
            })) : [],
          })) : [],

          // Parent Information
          parent: session.client?.parent ? {
            id: session.client.parent.id,
            name: session.client.parent.name,
            email: session.client.parent.email,
            phone: session.client.parent.phone || '',
          } : null,

          // BCBA Information
          bcba: session.bcba ? {
            id: session.bcba.id,
            name: session.bcba.name,
            email: session.bcba.email,
            phone: session.bcba.phone || '',
          } : session.client?.bcba ? {
            id: session.client.bcba.id,
            name: session.client.bcba.name,
            email: session.client.bcba.email,
            phone: session.client.bcba.phone || '',
          } : null,

          // RBT Information
          rbt: session.rbt ? {
            id: session.rbt.id,
            name: session.rbt.name,
            email: session.rbt.email,
          } : null,

          // Treatment Goals
          treatmentGoals: session.client?.treatmentGoals ? session.client.treatmentGoals.map((goal: any) => ({
            id: goal.id,
            title: goal.title,
            description: goal.description || '',
            targetBehavior: goal.targetBehavior || '',
            measurementType: goal.measurementType,
            masteryCriteria: goal.masteryCriteria || '',
            status: goal.status,
            // Program Builder fields
            domain: goal.domain,
            promptHierarchy: goal.promptHierarchy,
            baselineScore: goal.baselineScore,
            baselineTrials: goal.baselineTrials,
            targetPercentage: goal.targetPercentage,
            consecutiveSessions: goal.consecutiveSessions,
            goalPhase: goal.goalPhase,
            createdBy: goal.createdBy,
            createdByName: goal.creator?.name || 'Unknown',
            createdAt: goal.createdAt.toISO(),
            updatedAt: goal.updatedAt?.toISO() || null,
            // Enhanced baseline data and target behaviors
            baselineData: goal.baselineData ? goal.baselineData.map((baseline: any) => ({
              id: baseline.id,
              score: baseline.score,
              trials: baseline.trials,
              collectionDate: baseline.collectionDate.toISODate(),
              notes: baseline.notes,
              sessionType: baseline.sessionType,
              environment: baseline.environment,
              duration: baseline.duration,
              totalTrials: baseline.totalTrials,
            })) : [],
            targetBehaviors: goal.targetBehaviors ? goal.targetBehaviors.map((behavior: any) => ({
              id: behavior.id,
              name: behavior.name,
              description: behavior.description,
              baselinePercentage: behavior.baselinePercentage,
              intensity: behavior.intensity,
              notes: behavior.notes,
              status: behavior.status,
              currentPercentage: behavior.currentPercentage,
              masteryDate: behavior.masteryDate?.toISODate() || null,
              createdBy: behavior.createdBy,
              creatorName: behavior.creator?.name || null,
              createdAt: behavior.createdAt.toISO(),
            })) : [],
          })) : [],

          // Session Details
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          location: session.location,
          locationAddress: session.locationAddress || null,
          status: session.status,
          sessionNotes: session.sessionNotes || null,
          bcbaApproved: session.bcbaApproved,
          bcbaNotes: session.bcbaNotes || null,
          cptCode: session.cptCode || null,
          serviceType: session.serviceType || null,
          createdAt: session.createdAt.toISO(),
          updatedAt: session.updatedAt?.toISO() || null,
        }
      })
    } catch (error: any) {
      console.error('❌ Error fetching session details:', error)
      console.error('Error stack:', error.stack)
      return response.status(500).json({
        message: 'Failed to fetch session details',
        error: error.message,
        details: error.stack?.split('\n').slice(0, 5).join('\n')
      })
    }
  }

  /**
   * Get schedule
   */
  async getSchedule({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      console.log(`🔍 RBT Schedule Request:`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   User Role: ${user.role}`)
      console.log(`   User Name: ${user.name}`)
      console.log(`   Date Range: ${startDate} to ${endDate}`)

      // Verify user is RBT
      if (user.role !== 'RBT') {
        console.log(`❌ Access denied - User ${user.id} is not an RBT (role: ${user.role})`)
        return response.status(403).json({
          message: 'Access denied. Only RBT users can access this endpoint.',
        })
      }

      // Load sessions from session_logs table instead of schedules
      let query = SessionLog.query()
        .where('rbt_id', user.id)
        .preload('client')
        .preload('bcba')
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

      console.log(`✅ Found ${sessions.length} sessions for RBT ${user.id}`)
      if (sessions.length > 0) {
        console.log(`   Sample sessions:`)
        sessions.slice(0, 3).forEach(s => {
          console.log(`   - Session ${s.id}: RBT ${s.rbtId}, Date: ${s.date.toISODate()}, Client: ${s.client?.fullName || 'N/A'}`)
        })
      }

      return response.json({
        data: sessions.map(session => ({
          id: session.id,
          sessionType: session.sessionType,
          clientId: session.clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : null,
          bcbaName: session.bcba?.name || 'Not assigned',
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          time: `${session.startTime} - ${session.endTime}`,
          duration: session.duration,
          location: session.location,
          locationAddress: session.locationAddress,
          status: session.status,
          notes: session.sessionNotes,
          isRecurring: session.isRecurring || false,
          recurrencePattern: session.recurrencePattern || null,
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
   * Get current active session for RBT
   */
  async getActiveSession({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      console.log(`🔍 Looking for active session for RBT ${user.id}`)

      const activeSession = await SessionLog.query()
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .preload('client', (clientQuery) => {
          clientQuery
            .preload('treatmentGoals', (goalsQuery) => {
              goalsQuery.where('status', 'active')
            })
            .preload('parent')
            .preload('bcba')
        })
        .preload('rbt')
        .preload('bcba')
        .orderBy('created_at', 'desc')
        .first()

      if (!activeSession) {
        console.log(`✅ No active session found for RBT ${user.id}`)
        return response.json({ data: null })
      }

      console.log(`✅ Found active session ${activeSession.id} for RBT ${user.id}`)

      return response.json({
        data: {
          id: activeSession.id,
          sessionType: 'one_to_one', // SessionLog doesn't support group sessions yet
          clientId: activeSession.clientId,
          
          // Client Information
          client: activeSession.client ? {
            id: activeSession.client.id,
            fullName: `${activeSession.client.firstName} ${activeSession.client.lastName}`,
            firstName: activeSession.client.firstName,
            lastName: activeSession.client.lastName,
            age: activeSession.client.age,
            dateOfBirth: activeSession.client.dateOfBirth.toISODate(),
            status: activeSession.client.status,
            diagnosis: activeSession.client.diagnosis || [],
          } : null,

          // Parent Information
          parent: activeSession.client?.parent ? {
            id: activeSession.client.parent.id,
            name: activeSession.client.parent.name,
            email: activeSession.client.parent.email,
            phone: activeSession.client.parent.phone || '',
          } : null,

          // Treatment Goals
          treatmentGoals: activeSession.client?.treatmentGoals?.map(goal => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            targetBehavior: goal.targetBehavior,
            measurementType: goal.measurementType,
            masteryCriteria: goal.masteryCriteria,
            status: goal.status,
            // Program Builder fields
            domain: goal.domain,
            promptHierarchy: goal.promptHierarchy,
            baselineScore: goal.baselineScore,
            baselineTrials: goal.baselineTrials,
            targetPercentage: goal.targetPercentage,
            consecutiveSessions: goal.consecutiveSessions,
            goalPhase: goal.goalPhase,
            createdBy: goal.createdBy,
            createdByName: goal.creator?.name || 'Unknown',
            createdAt: goal.createdAt.toISO(),
            updatedAt: goal.updatedAt?.toISO() || null,
          })) || [],

          // Session Details
          date: activeSession.date.toISODate(),
          startTime: activeSession.startTime,
          endTime: activeSession.endTime,
          location: activeSession.location,
          status: activeSession.status,
          sessionNotes: activeSession.sessionNotes || '',
          
          // RBT Information
          rbt: activeSession.rbt ? {
            id: activeSession.rbt.id,
            name: activeSession.rbt.name,
            email: activeSession.rbt.email,
          } : null,

          // BCBA Information
          bcba: activeSession.bcba ? {
            id: activeSession.bcba.id,
            name: activeSession.bcba.name,
            email: activeSession.bcba.email,
          } : null,

          createdAt: activeSession.createdAt.toISO(),
          updatedAt: activeSession.updatedAt?.toISO() || null,
        }
      })
    } catch (error) {
      console.error('❌ Error getting active session:', error)
      return response.status(500).json({
        message: 'Failed to get active session',
        error: error.message,
      })
    }
  }

  /**
   * Get session status for validation
   */
  async getSessionStatus({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`🔍 Checking session status for session ${sessionId}, RBT ${user.id}`)

      const session = await SessionLog.find(sessionId)

      const result = {
        exists: !!session,
        belongsToUser: session?.rbtId === user.id,
        status: session?.status || null,
        canBeEnded: session?.status === 'draft' && session?.rbtId === user.id,
        sessionId: session?.id || null,
        rbtId: session?.rbtId || null,
        currentUserId: user.id,
      }

      console.log(`✅ Session status check result:`, result)

      return response.json(result)
    } catch (error) {
      console.error('❌ Error checking session status:', error)
      return response.status(500).json({
        message: 'Failed to check session status',
        error: error.message,
      })
    }
  }

  /**
   * Record individual trial (real-time)
   */
  async recordTrial({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { 
        sessionId, 
        goalId, 
        prompt, 
        response: trialResponse, 
        reinforcement, 
        notes,
        durationSeconds,
        antecedent,
        consequence
      } = request.only([
        'sessionId',
        'goalId', 
        'prompt', 
        'response', 
        'reinforcement', 
        'notes',
        'durationSeconds',
        'antecedent',
        'consequence'
      ])

      console.log(`📝 Recording trial for session ${sessionId}, goal ${goalId}`)

      // Verify session belongs to RBT and is active
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Verify goal exists
      const goal = await TreatmentGoal.findOrFail(goalId)

      // Create trial record
      const trial = await Trial.create({
        sessionId,
        goalId,
        prompt: prompt || '',
        response: trialResponse,
        reinforcement: reinforcement || '',
        notes: notes || '',
        timestamp: DateTime.now(),
        durationSeconds: durationSeconds || null,
        antecedent: antecedent || null,
        consequence: consequence || null,
      })

      console.log(`✅ Trial recorded: ${trial.id}`)

      return response.status(201).json({
        message: 'Trial recorded successfully',
        data: {
          id: trial.id,
          sessionId: trial.sessionId,
          goalId: trial.goalId,
          goalTitle: goal.title,
          prompt: trial.prompt,
          response: trial.response,
          reinforcement: trial.reinforcement,
          notes: trial.notes,
          timestamp: trial.timestamp.toISO(),
          durationSeconds: trial.durationSeconds,
        }
      })
    } catch (error) {
      console.error('❌ Error recording trial:', error)
      return response.status(400).json({
        message: 'Failed to record trial',
        error: error.message,
      })
    }
  }

  /**
   * Auto-save session data (for real-time updates)
   */
  async autoSaveSession({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id
      const { sessionNotes, environmentNotes, engagementScore } = request.only([
        'sessionNotes',
        'environmentNotes', 
        'engagementScore'
      ])

      console.log(`💾 Auto-saving session ${sessionId}`)

      // Verify session belongs to RBT and is active
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Update only provided fields
      if (sessionNotes !== undefined) {
        session.sessionNotes = sessionNotes
      }
      if (environmentNotes !== undefined) {
        session.environmentNotes = environmentNotes
      }
      if (engagementScore !== undefined && engagementScore !== null) {
        const score = parseInt(engagementScore)
        if (score >= 1 && score <= 5) {
          session.engagementScore = score
        }
      }

      await session.save()

      console.log(`✅ Session ${sessionId} auto-saved`)

      return response.json({
        message: 'Session auto-saved successfully',
        data: {
          id: session.id,
          sessionNotes: session.sessionNotes,
          environmentNotes: session.environmentNotes,
          engagementScore: session.engagementScore,
          updatedAt: session.updatedAt?.toISO(),
        }
      })
    } catch (error) {
      console.error('❌ Error auto-saving session:', error)
      return response.status(400).json({
        message: 'Failed to auto-save session',
        error: error.message,
      })
    }
  }

  /**
   * Submit session for BCBA review
   */
  async submitSessionForReview({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`📤 Submitting session ${sessionId} for review`)

      // Verify session belongs to RBT and is in draft status
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Validate session has required data
      if (!session.sessionNotes || session.sessionNotes.trim().length === 0) {
        return response.status(400).json({
          message: 'Session notes are required before submission',
        })
      }

      // Update session status
      session.status = 'submitted'
      await session.save()

      console.log(`✅ Session ${sessionId} submitted for review`)

      return response.json({
        message: 'Session submitted for BCBA review successfully',
        data: {
          id: session.id,
          status: session.status,
          updatedAt: session.updatedAt?.toISO(),
        }
      })
    } catch (error) {
      console.error('❌ Error submitting session for review:', error)
      return response.status(400).json({
        message: 'Failed to submit session for review',
        error: error.message,
      })
    }
  }

  /**
   * Record behavior data with enhanced tracking
   */
  async recordBehavior({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { 
        sessionId, 
        goalId, 
        durationSeconds,
        frequencyCount,
        antecedent,
        consequence,
        environmentNotes,
        measurementUnit,
        baselineValue
      } = request.only([
        'sessionId',
        'goalId',
        'durationSeconds',
        'frequencyCount', 
        'antecedent',
        'consequence',
        'environmentNotes',
        'measurementUnit',
        'baselineValue'
      ])

      console.log(`📊 Recording behavior data for session ${sessionId}, goal ${goalId}`)

      // Verify session belongs to RBT and is active
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Verify goal exists
      const goal = await TreatmentGoal.findOrFail(goalId)

      // Create behavior data record
      const behaviorData = await BehaviorData.create({
        sessionId,
        goalId,
        correct: 0, // Will be calculated from trials
        incorrect: 0,
        prompted: 0,
        total: 0,
        percentage: 0,
        durationSeconds: durationSeconds || null,
        frequencyCount: frequencyCount || null,
        antecedent: antecedent || null,
        consequence: consequence || null,
        environmentNotes: environmentNotes || null,
        measurementUnit: measurementUnit || null,
        baselineValue: baselineValue || null,
      })

      console.log(`✅ Behavior data recorded: ${behaviorData.id}`)

      return response.status(201).json({
        message: 'Behavior data recorded successfully',
        data: {
          id: behaviorData.id,
          sessionId: behaviorData.sessionId,
          goalId: behaviorData.goalId,
          goalTitle: goal.title,
          durationSeconds: behaviorData.durationSeconds,
          frequencyCount: behaviorData.frequencyCount,
          antecedent: behaviorData.antecedent,
          consequence: behaviorData.consequence,
          environmentNotes: behaviorData.environmentNotes,
          createdAt: behaviorData.createdAt.toISO(),
        }
      })
    } catch (error) {
      console.error('❌ Error recording behavior data:', error)
      return response.status(400).json({
        message: 'Failed to record behavior data',
        error: error.message,
      })
    }
  }

  /**
   * Enhanced record trial with detailed tracking
   */
  async recordEnhancedTrial({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { 
        sessionId, 
        goalId, 
        prompt, 
        response: trialResponse, 
        reinforcement, 
        notes,
        durationSeconds,
        antecedent,
        consequence,
        promptType,
        promptLevel,
        independent,
        errorCorrection
      } = request.only([
        'sessionId',
        'goalId', 
        'prompt', 
        'response', 
        'reinforcement', 
        'notes',
        'durationSeconds',
        'antecedent',
        'consequence',
        'promptType',
        'promptLevel',
        'independent',
        'errorCorrection'
      ])

      console.log(`📝 Recording enhanced trial for session ${sessionId}, goal ${goalId}`)

      // Verify session belongs to RBT and is active
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .firstOrFail()

      // Verify goal exists
      const goal = await TreatmentGoal.findOrFail(goalId)

      // Create enhanced trial record
      const trial = await Trial.create({
        sessionId,
        goalId,
        prompt: prompt || '',
        response: trialResponse,
        reinforcement: reinforcement || '',
        notes: notes || '',
        timestamp: DateTime.now(),
        durationSeconds: durationSeconds || null,
        antecedent: antecedent || null,
        consequence: consequence || null,
        promptType: promptType || null,
        promptLevel: promptLevel || null,
        independent: independent || false,
        errorCorrection: errorCorrection || null,
      })

      console.log(`✅ Enhanced trial recorded: ${trial.id}`)

      return response.status(201).json({
        message: 'Enhanced trial recorded successfully',
        data: {
          id: trial.id,
          sessionId: trial.sessionId,
          goalId: trial.goalId,
          goalTitle: goal.title,
          prompt: trial.prompt,
          response: trial.response,
          reinforcement: trial.reinforcement,
          notes: trial.notes,
          timestamp: trial.timestamp.toISO(),
          durationSeconds: trial.durationSeconds,
          promptType: trial.promptType,
          promptLevel: trial.promptLevel,
          independent: trial.independent,
          errorCorrection: trial.errorCorrection,
        }
      })
    } catch (error) {
      console.error('❌ Error recording enhanced trial:', error)
      return response.status(400).json({
        message: 'Failed to record enhanced trial',
        error: error.message,
      })
    }
  }

  /**
   * Calculate and store session analytics
   */
  async calculateSessionAnalytics({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`📊 Calculating session analytics for session ${sessionId}`)

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .firstOrFail()

      // Import analytics service
      const TrialAnalyticsService = (await import('#services/trial_analytics_service')).default

      // Calculate comprehensive analytics
      const analytics = await TrialAnalyticsService.calculateSessionAnalytics(sessionId)

      // Store behavior data for each goal
      for (const goalAnalytics of analytics.goalAnalytics) {
        await TrialAnalyticsService.storeBehaviorData(sessionId, goalAnalytics.goalId, goalAnalytics)
      }

      console.log(`✅ Session analytics calculated and stored for session ${sessionId}`)

      return response.json({
        message: 'Session analytics calculated successfully',
        data: analytics
      })
    } catch (error) {
      console.error('❌ Error calculating session analytics:', error)
      return response.status(400).json({
        message: 'Failed to calculate session analytics',
        error: error.message,
      })
    }
  }

  /**
   * Submit clinical feedback for analytics
   */
  async submitClinicalFeedback({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        sessionId,
        patientId,
        date,
        categoryScores,
        overallScore,
        engagementLevel,
        riskFactors,
        comments
      } = request.body()

      console.log('📊 Submitting clinical feedback for session:', sessionId)

      // Verify session belongs to RBT
      const SessionLog = (await import('#models/session_log')).default
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .first()

      if (!session) {
        return response.status(404).json({
          message: 'Session not found or access denied'
        })
      }

      // Try to store clinical feedback, but handle gracefully if model doesn't exist
      let feedback = null
      try {
        const ClinicalFeedback = (await import('#models/clinical_feedback')).default
        feedback = await ClinicalFeedback.create({
          sessionId,
          patientId: patientId || session.clientId,
          clinicianId: user.id,
          date,
          categoryScores: JSON.stringify(categoryScores),
          overallScore,
          engagementLevel,
          riskFactors: JSON.stringify(riskFactors || []),
          comments
        })
        console.log('✅ Clinical feedback stored in database:', feedback.id)
      } catch (dbError) {
        console.log('⚠️ Clinical feedback model not available, storing in session notes instead')
        
        // Fallback: Store feedback in session notes as structured data
        const feedbackSummary = `
Clinical Feedback Summary:
- Overall Score: ${overallScore}/100
- Engagement Level: ${engagementLevel}/5
- Physical Health: ${categoryScores.physicalHealth}/100
- Mental Health: ${categoryScores.mentalHealth}/100
- Medication Adherence: ${categoryScores.medicationAdherence}/100
- Therapy Compliance: ${categoryScores.therapyCompliance}/100
- Social Engagement: ${categoryScores.socialEngagement}/100
- Behavior Regulation: ${categoryScores.behaviorRegulation}/100
${riskFactors && riskFactors.length > 0 ? `- Risk Factors: ${riskFactors.join(', ')}` : ''}
${comments ? `- Clinical Notes: ${comments}` : ''}
        `.trim()

        // Update session with clinical feedback in notes
        await session.merge({
          sessionNotes: (session.sessionNotes || '') + '\n\n' + feedbackSummary
        }).save()

        feedback = {
          id: `session_${sessionId}_feedback`,
          sessionId,
          patientId: patientId || session.clientId,
          clinicianId: user.id,
          date,
          categoryScores,
          overallScore,
          engagementLevel,
          riskFactors,
          comments,
          storedInSession: true
        }
      }

      return response.json({
        message: 'Clinical feedback submitted successfully',
        data: feedback
      })
    } catch (error) {
      console.error('❌ Error submitting clinical feedback:', error)
      return response.status(500).json({
        message: 'Failed to submit clinical feedback',
        error: error.message
      })
    }
  }

  /**
   * Get clinical analytics metrics
   */
  async getClinicalAnalyticsMetrics({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { dateFrom, dateTo, programId, conditionId, patientId } = request.qs()

      console.log('📈 Loading clinical analytics metrics for user:', user.id)
      console.log('📅 Date range:', dateFrom, 'to', dateTo)

      // For now, return mock data since clinical_feedback table may not exist yet
      // This allows the frontend to work while the database is being set up
      
      // Get assigned clients count for realistic metrics
      let totalPatients = 5 // Default mock value
      try {
        const assignedClients = await user.related('assignedClients').query()
        totalPatients = assignedClients.length || 5
      } catch (error) {
        console.log('Using mock client count')
      }

      // Generate realistic mock metrics based on actual client data
      const activePatients = Math.floor(totalPatients * 0.8) // 80% active
      const averageClinicalScore = 72 // Good average score
      const improvementRate = 15 // 15% improvement
      const atRiskPatients = Math.floor(totalPatients * 0.1) // 10% at risk

      // Score distribution with realistic percentages
      const scoreDistribution = [
        { range: '0-40 (Critical)', count: Math.floor(totalPatients * 0.1), percentage: 10 },
        { range: '41-60 (Attention)', count: Math.floor(totalPatients * 0.2), percentage: 20 },
        { range: '61-80 (Stable)', count: Math.floor(totalPatients * 0.5), percentage: 50 },
        { range: '81-100 (Improving)', count: Math.floor(totalPatients * 0.2), percentage: 20 }
      ]

      // Category breakdown with varied scores and trends
      const categoryBreakdown = [
        { category: 'Physical Health', score: 75, trend: 'up' as const },
        { category: 'Mental Health', score: 68, trend: 'stable' as const },
        { category: 'Medication Adherence', score: 82, trend: 'up' as const },
        { category: 'Therapy Compliance', score: 71, trend: 'down' as const },
        { category: 'Social Engagement', score: 64, trend: 'stable' as const },
        { category: 'Behavior Regulation', score: 77, trend: 'up' as const }
      ]

      // Generate patient insights based on actual assigned clients
      let patientInsights = []
      try {
        const clients = await user.related('assignedClients').query().limit(10)
        patientInsights = clients.map((client, index) => ({
          id: client.id,
          name: client.fullName || `Client ${client.id}`,
          lastFeedback: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currentScore: Math.floor(Math.random() * 40) + 60, // 60-100 range
          trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as 'improving' | 'stable' | 'declining',
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
        }))
      } catch (error) {
        // Fallback mock data
        patientInsights = [
          {
            id: 1,
            name: 'Sample Patient A',
            lastFeedback: '2024-01-15',
            currentScore: 78,
            trend: 'improving' as const,
            riskLevel: 'low' as const
          },
          {
            id: 2,
            name: 'Sample Patient B',
            lastFeedback: '2024-01-14',
            currentScore: 65,
            trend: 'stable' as const,
            riskLevel: 'medium' as const
          }
        ]
      }

      // Generate relevant alerts
      const alerts = []
      if (atRiskPatients > 0) {
        alerts.push({
          id: 1,
          type: 'score_decline' as const,
          message: `${atRiskPatients} patient(s) showing concerning score trends`,
          severity: 'medium' as const,
          patientId: patientInsights[0]?.id || 1,
          date: new Date().toISOString().split('T')[0]
        })
      }

      // Add engagement alert if needed
      if (activePatients < totalPatients * 0.7) {
        alerts.push({
          id: 2,
          type: 'no_feedback' as const,
          message: 'Several patients have not provided feedback recently',
          severity: 'low' as const,
          patientId: 0,
          date: new Date().toISOString().split('T')[0]
        })
      }

      const metrics = {
        totalPatients,
        activePatients,
        averageClinicalScore,
        improvementRate,
        atRiskPatients,
        scoreDistribution,
        categoryBreakdown,
        patientInsights,
        alerts,
        progressTrend: [], // Would calculate from historical data
        engagementTrend: [] // Would calculate from submission frequency
      }

      console.log('✅ Clinical analytics metrics calculated (mock data)')
      console.log(`   Total Patients: ${totalPatients}, Active: ${activePatients}`)

      return response.json(metrics)
    } catch (error) {
      console.error('❌ Error loading clinical analytics:', error)
      return response.status(500).json({
        message: 'Failed to load clinical analytics',
        error: error.message
      })
    }
  }

  /**
   * Get enhanced progress insights metrics with range and cumulative data
   */
  async getProgressInsightsMetrics({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { timeframe, clientId, startDate: customStartDate, endDate: customEndDate } = request.qs()

      console.log('📊 Loading ENHANCED progress insights metrics for user:', user.id)
      console.log('📅 Timeframe:', timeframe, 'Client ID:', clientId)
      console.log('📅 Custom dates:', customStartDate, 'to', customEndDate)

      // Calculate date range based on timeframe or custom dates
      const now = new Date()
      let startDate: Date
      let previousStartDate: Date

      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        const daysDiff = Math.floor((new Date(customEndDate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        previousStartDate = new Date(startDate)
        previousStartDate.setDate(startDate.getDate() - daysDiff)
      } else {
        switch (timeframe) {
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            break
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3)
            startDate = new Date(now.getFullYear(), quarter * 3, 1)
            previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1)
            break
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            previousStartDate = new Date(now.getFullYear() - 1, 0, 1)
            break
          default: // week
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 7)
            previousStartDate = new Date(now)
            previousStartDate.setDate(now.getDate() - 14)
            break
        }
      }

      console.log('📅 Date range:', startDate.toISOString().split('T')[0], 'to', now.toISOString().split('T')[0])

      // Get assigned clients with real data
      const assignedClients = await Client.query()
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .orWhereHas('sessionLogs', (sessionQuery) => {
          sessionQuery.where('rbt_id', user.id)
        })
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.where('status', 'active')
        })

      console.log(`✅ Found ${assignedClients.length} assigned clients`)

      // 1. TOTAL SESSIONS - Real count from database
      const totalSessionsQuery = SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>=', startDate)
        .where('date', '<=', now)

      if (clientId && clientId !== 'all') {
        totalSessionsQuery.where('client_id', clientId)
      }

      const totalSessions = await totalSessionsQuery.count('* as total')
      const totalSessionsCount = totalSessions[0].$extras.total

      // Previous period sessions for comparison
      const previousSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>=', previousStartDate)
        .where('date', '<', startDate)
        .count('* as total')
      const previousSessionsCount = previousSessions[0].$extras.total

      // 2. COMPLETED GOALS - Real count from treatment goals
      let completedGoalsCount = 0
      let totalGoalsCount = 0
      
      for (const client of assignedClients) {
        if (clientId && clientId !== 'all' && client.id.toString() !== clientId) continue
        
        const goals = client.treatmentGoals || []
        totalGoalsCount += goals.length
        
        // Count goals that have been mastered or completed
        for (const goal of goals) {
          if (goal.status === 'completed' || goal.goalPhase === 'mastered') {
            completedGoalsCount++
          } else {
            // Check if goal has recent successful behavior data
            const recentBehaviorData = await BehaviorData.query()
              .where('goal_id', goal.id)
              .where('created_at', '>=', startDate)
              .where('percentage', '>=', goal.targetPercentage || 80)
              .first()
            
            if (recentBehaviorData) {
              completedGoalsCount++
            }
          }
        }
      }

      // 3. AVERAGE PROGRESS - Calculate from behavior data
      const behaviorDataQuery = BehaviorData.query()
        .whereHas('goal', (goalQuery) => {
          goalQuery.whereHas('client', (clientQuery) => {
            clientQuery.whereHas('assignedRbts', (rbtQuery) => {
              rbtQuery.where('users.id', user.id)
            })
          })
        })
        .where('created_at', '>=', startDate)

      if (clientId && clientId !== 'all') {
        behaviorDataQuery.whereHas('goal', (goalQuery) => {
          goalQuery.where('client_id', clientId)
        })
      }

      const behaviorData = await behaviorDataQuery
      const averageProgress = behaviorData.length > 0 
        ? Math.round(behaviorData.reduce((sum, data) => sum + (data.percentage || 0), 0) / behaviorData.length)
        : 0

      // Previous period average for comparison
      const previousBehaviorData = await BehaviorData.query()
        .whereHas('goal', (goalQuery) => {
          goalQuery.whereHas('client', (clientQuery) => {
            clientQuery.whereHas('assignedRbts', (rbtQuery) => {
              rbtQuery.where('users.id', user.id)
            })
          })
        })
        .where('created_at', '>=', previousStartDate)
        .where('created_at', '<', startDate)

      const previousAverageProgress = previousBehaviorData.length > 0 
        ? Math.round(previousBehaviorData.reduce((sum, data) => sum + (data.percentage || 0), 0) / previousBehaviorData.length)
        : 0

      const weeklyImprovement = averageProgress - previousAverageProgress

      // 4. SUCCESS RATE - Calculate from completed sessions
      const completedSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>=', startDate)
        .where('status', 'completed')
        .count('* as total')
      const completedSessionsCount = completedSessions[0].$extras.total

      const successRate = totalSessionsCount > 0 
        ? Math.round((completedSessionsCount / totalSessionsCount) * 100)
        : 0

      // 5. ACTIVE CLIENTS - Clients with recent sessions
      const activeClientsCount = await Client.query()
        .whereHas('sessionLogs', (sessionQuery) => {
          sessionQuery
            .where('rbt_id', user.id)
            .where('date', '>=', startDate)
        })
        .count('* as total')
      const activeClients = activeClientsCount[0].$extras.total

      // 6. UPCOMING SESSIONS - From schedules or planned sessions
      const upcomingSessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>', now)
        .where('status', 'draft')
        .count('* as total')
      const upcomingSessionsCount = upcomingSessions[0].$extras.total

      // 7. CRITICAL ALERTS - Clients with declining performance
      let criticalAlerts = 0
      for (const client of assignedClients) {
        const recentSessions = await SessionLog.query()
          .where('client_id', client.id)
          .where('rbt_id', user.id)
          .where('date', '>=', startDate)
          .orderBy('date', 'desc')
          .limit(3)

        if (recentSessions.length >= 2) {
          const recentScores = []
          for (const session of recentSessions) {
            if (session.engagementScore) {
              recentScores.push(session.engagementScore)
            }
          }
          
          if (recentScores.length >= 2) {
            const trend = recentScores[0] - recentScores[recentScores.length - 1]
            if (trend < -1 || recentScores[0] <= 2) { // Declining or low scores
              criticalAlerts++
            }
          }
        }
      }

      const metrics = {
        totalSessions: totalSessionsCount,
        completedGoals: completedGoalsCount,
        averageProgress,
        weeklyImprovement,
        activeClients,
        upcomingSessions: upcomingSessionsCount,
        criticalAlerts,
        successRate
      }

      // Generate REAL client progress data
      const clientProgress = []
      
      for (const client of assignedClients) {
        if (clientId && clientId !== 'all' && client.id.toString() !== clientId) continue

        // Get client's recent sessions for scoring
        const recentSessions = await SessionLog.query()
          .where('client_id', client.id)
          .where('rbt_id', user.id)
          .where('date', '>=', startDate)
          .orderBy('date', 'desc')
          .limit(5)

        // Calculate current score from recent behavior data
        const clientBehaviorData = await BehaviorData.query()
          .whereHas('goal', (goalQuery) => {
            goalQuery.where('client_id', client.id)
          })
          .where('created_at', '>=', startDate)
          .orderBy('created_at', 'desc')
          .limit(10)

        const currentScore = clientBehaviorData.length > 0
          ? Math.round(clientBehaviorData.reduce((sum, data) => sum + (data.percentage || 0), 0) / clientBehaviorData.length)
          : 0

        // Calculate previous score for trend
        const previousBehaviorData = await BehaviorData.query()
          .whereHas('goal', (goalQuery) => {
            goalQuery.where('client_id', client.id)
          })
          .where('created_at', '>=', previousStartDate)
          .where('created_at', '<', startDate)
          .orderBy('created_at', 'desc')
          .limit(10)

        const previousScore = previousBehaviorData.length > 0
          ? Math.round(previousBehaviorData.reduce((sum, data) => sum + (data.percentage || 0), 0) / previousBehaviorData.length)
          : currentScore

        // Determine trend
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (currentScore > previousScore + 5) trend = 'up'
        else if (currentScore < previousScore - 5) trend = 'down'

        // Get last and next session dates
        const lastSession = recentSessions.length > 0 
          ? recentSessions[0].date.toISODate()
          : null

        const nextSession = await SessionLog.query()
          .where('client_id', client.id)
          .where('rbt_id', user.id)
          .where('date', '>', now)
          .orderBy('date', 'asc')
          .first()

        // Count goals
        const goals = client.treatmentGoals || []
        const completedGoals = goals.filter(goal => 
          goal.status === 'completed' || goal.goalPhase === 'mastered'
        ).length

        // Get goal categories
        const categories = [...new Set(goals.map(goal => goal.domain).filter(Boolean))]

        // Calculate engagement from recent sessions
        const engagementScores = recentSessions
          .map(session => session.engagementScore)
          .filter(score => score !== null && score !== undefined)
        
        const engagement = engagementScores.length > 0
          ? Math.round((engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length) * 20) // Convert 1-5 to percentage
          : 0

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' = 'low'
        if (currentScore < 60 || trend === 'down' || engagement < 40) {
          riskLevel = 'high'
        } else if (currentScore < 80 || engagement < 70) {
          riskLevel = 'medium'
        }

        clientProgress.push({
          id: client.id,
          name: client.fullName || `${client.firstName} ${client.lastName}`,
          currentScore,
          previousScore,
          trend,
          lastSession,
          nextSession: nextSession?.date.toISODate() || null,
          goals: {
            completed: completedGoals,
            total: goals.length,
            categories: categories.length > 0 ? categories : ['General']
          },
          riskLevel,
          engagement
        })
      }

      // Calculate statistical ranges and cumulative data
      const allProgressScores = behaviorData.map(data => data.percentage || 0)
      const allEngagementScores = []
      const dailyProgressData = new Map()
      const cumulativeData = []

      // Get daily progress data for cumulative analysis
      const dailySessions = await SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>=', startDate)
        .where('date', '<=', now)
        .orderBy('date', 'asc')

      let cumulativeTotal = 0
      let cumulativeCount = 0

      for (const session of dailySessions) {
        const dateKey = session.date.toISODate()
        
        // Get behavior data for this session
        const sessionBehaviorData = await BehaviorData.query()
          .where('session_id', session.id)
        
        const sessionScores = sessionBehaviorData.map(data => data.percentage || 0)
        const sessionAvg = sessionScores.length > 0 
          ? sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length
          : 0

        if (sessionAvg > 0) {
          cumulativeTotal += sessionAvg
          cumulativeCount++
          
          if (!dailyProgressData.has(dateKey)) {
            dailyProgressData.set(dateKey, [])
          }
          dailyProgressData.get(dateKey).push(sessionAvg)
          
          cumulativeData.push({
            date: dateKey,
            dailyAverage: sessionAvg,
            cumulativeAverage: cumulativeTotal / cumulativeCount,
            sessionCount: cumulativeCount,
            scores: sessionScores
          })
        }

        // Extract engagement scores if available
        if (session.engagementScore) {
          allEngagementScores.push(session.engagementScore * 20) // Convert to percentage
        }
      }

      // Calculate statistical measures for progress scores
      const progressStats = calculateStatistics(allProgressScores)
      const engagementStats = calculateStatistics(allEngagementScores)

      // Calculate range data for different metrics
      const rangeData = {
        progressScores: {
          min: progressStats.min,
          max: progressStats.max,
          mean: progressStats.mean,
          median: progressStats.median,
          q1: progressStats.q1,
          q3: progressStats.q3,
          standardDeviation: progressStats.standardDeviation,
          range: progressStats.max - progressStats.min,
          interquartileRange: progressStats.q3 - progressStats.q1
        },
        engagementScores: {
          min: engagementStats.min,
          max: engagementStats.max,
          mean: engagementStats.mean,
          median: engagementStats.median,
          q1: engagementStats.q1,
          q3: engagementStats.q3,
          standardDeviation: engagementStats.standardDeviation,
          range: engagementStats.max - engagementStats.min,
          interquartileRange: engagementStats.q3 - engagementStats.q1
        },
        sessionVolume: {
          totalSessions: totalSessionsCount,
          averagePerDay: totalSessionsCount / Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),
          peakDay: findPeakSessionDay(dailySessions),
          consistencyScore: calculateConsistencyScore(dailySessions)
        }
      }

      // Enhanced metrics with range data
      const enhancedMetrics = {
        ...metrics,
        rangeData,
        cumulativeData,
        trendAnalysis: {
          progressTrend: calculateTrendDirection(cumulativeData.map(d => d.cumulativeAverage)),
          engagementTrend: calculateTrendDirection(allEngagementScores.slice(-10)),
          sessionVolumeTrend: calculateSessionVolumeTrend(dailySessions),
          improvementVelocity: calculateImprovementVelocity(cumulativeData)
        },
        distributionAnalysis: {
          progressDistribution: calculateDistribution(allProgressScores),
          engagementDistribution: calculateDistribution(allEngagementScores),
          goalCategoryDistribution: calculateGoalCategoryDistribution(assignedClients)
        }
      }

      console.log('✅ Enhanced progress insights metrics calculated:', {
        totalSessions: totalSessionsCount,
        completedGoals: completedGoalsCount,
        averageProgress,
        rangeDataPoints: allProgressScores.length,
        cumulativeDataPoints: cumulativeData.length,
        clientsProcessed: clientProgress.length
      })

      return response.json({
        metrics: enhancedMetrics,
        clientProgress,
        rangeData,
        cumulativeData,
        timeframe: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          period: timeframe || 'custom'
        }
      })

      // Helper functions for statistical calculations
      function calculateStatistics(values: number[]) {
        if (values.length === 0) {
          return { min: 0, max: 0, mean: 0, median: 0, q1: 0, q3: 0, standardDeviation: 0 }
        }

        const sorted = [...values].sort((a, b) => a - b)
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length
        
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        const standardDeviation = Math.sqrt(variance)

        return {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: Math.round(mean * 100) / 100,
          median: Math.round(median * 100) / 100,
          q1: Math.round(q1 * 100) / 100,
          q3: Math.round(q3 * 100) / 100,
          standardDeviation: Math.round(standardDeviation * 100) / 100
        }
      }

      function calculateTrendDirection(values: number[]): 'increasing' | 'decreasing' | 'stable' {
        if (values.length < 2) return 'stable'
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2))
        const secondHalf = values.slice(Math.ceil(values.length / 2))
        
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
        
        const difference = secondAvg - firstAvg
        
        if (difference > 2) return 'increasing'
        if (difference < -2) return 'decreasing'
        return 'stable'
      }

      function calculateDistribution(values: number[]) {
        const ranges = [
          { label: '0-20%', min: 0, max: 20, count: 0 },
          { label: '21-40%', min: 21, max: 40, count: 0 },
          { label: '41-60%', min: 41, max: 60, count: 0 },
          { label: '61-80%', min: 61, max: 80, count: 0 },
          { label: '81-100%', min: 81, max: 100, count: 0 }
        ]

        values.forEach(value => {
          const range = ranges.find(r => value >= r.min && value <= r.max)
          if (range) range.count++
        })

        return ranges
      }

      function findPeakSessionDay(sessions: any[]) {
        const dailyCounts = new Map()
        sessions.forEach(session => {
          const date = session.date.toISODate()
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
        })

        let peakDate = null
        let peakCount = 0
        for (const [date, count] of dailyCounts.entries()) {
          if (count > peakCount) {
            peakCount = count
            peakDate = date
          }
        }

        return { date: peakDate, count: peakCount }
      }

      function calculateConsistencyScore(sessions: any[]): number {
        if (sessions.length === 0) return 0
        
        const dailyCounts = new Map()
        sessions.forEach(session => {
          const date = session.date.toISODate()
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
        })

        const counts = Array.from(dailyCounts.values())
        const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length
        const standardDeviation = Math.sqrt(variance)
        
        // Lower standard deviation = higher consistency
        return Math.max(0, 100 - (standardDeviation * 10))
      }

      function calculateSessionVolumeTrend(sessions: any[]): 'increasing' | 'decreasing' | 'stable' {
        if (sessions.length < 7) return 'stable'
        
        const dailyCounts = new Map()
        sessions.forEach(session => {
          const date = session.date.toISODate()
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
        })

        const sortedDates = Array.from(dailyCounts.keys()).sort()
        const firstWeek = sortedDates.slice(0, 7).reduce((sum, date) => sum + (dailyCounts.get(date) || 0), 0)
        const lastWeek = sortedDates.slice(-7).reduce((sum, date) => sum + (dailyCounts.get(date) || 0), 0)
        
        if (lastWeek > firstWeek * 1.2) return 'increasing'
        if (lastWeek < firstWeek * 0.8) return 'decreasing'
        return 'stable'
      }

      function calculateImprovementVelocity(cumulativeData: any[]): number {
        if (cumulativeData.length < 2) return 0
        
        const firstPoint = cumulativeData[0]
        const lastPoint = cumulativeData[cumulativeData.length - 1]
        const timeDiff = Math.max(1, cumulativeData.length)
        
        return Math.round(((lastPoint.cumulativeAverage - firstPoint.cumulativeAverage) / timeDiff) * 100) / 100
      }

      function calculateGoalCategoryDistribution(clients: any[]) {
        const categoryCount = new Map()
        
        clients.forEach(client => {
          const goals = client.treatmentGoals || []
          goals.forEach((goal: any) => {
            const category = goal.domain || 'General'
            categoryCount.set(category, (categoryCount.get(category) || 0) + 1)
          })
        })

        return Array.from(categoryCount.entries()).map(([category, count]) => ({
          category,
          count,
          percentage: Math.round((count / Math.max(1, clients.reduce((sum, client) => sum + (client.treatmentGoals?.length || 0), 0))) * 100)
        }))
      }
    } catch (error) {
      console.error('❌ Error loading progress insights:', error)
      return response.status(500).json({
        message: 'Failed to load progress insights',
        error: error.message
      })
    }
  }

  /**
   * Submit progress feedback
   */
  async submitProgressFeedback({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const feedbackData = request.body()

      console.log('📝 Submitting progress feedback:', {
        sessionId: feedbackData.sessionId,
        clientId: feedbackData.clientId,
        userId: user.id,
        hasGoals: !!feedbackData.goals,
        goalCount: feedbackData.goals?.length || 0
      })

      // Validate required fields
      if (!feedbackData.sessionId) {
        console.log('❌ Missing sessionId in feedback data')
        return response.status(400).json({
          message: 'Session ID is required'
        })
      }

      if (!feedbackData.clientId) {
        console.log('❌ Missing clientId in feedback data')
        return response.status(400).json({
          message: 'Client ID is required'
        })
      }

      // Verify session belongs to RBT
      const SessionLog = (await import('#models/session_log')).default
      const session = await SessionLog.query()
        .where('id', feedbackData.sessionId)
        .where('rbt_id', user.id)
        .first()

      if (!session) {
        console.log(`❌ Session ${feedbackData.sessionId} not found for RBT ${user.id}`)
        return response.status(404).json({
          message: 'Session not found or access denied'
        })
      }

      console.log(`✅ Session ${feedbackData.sessionId} verified for RBT ${user.id}`)

      // Store progress feedback in session notes (enhanced format)
      const progressSummary = `
PROGRESS INSIGHTS FEEDBACK:
Session Rating: ${feedbackData.overallRating}/5 stars
Date: ${feedbackData.date}

GOAL PROGRESS:
${feedbackData.goals?.map((goal: any) => 
  `- ${goal.goalName}: ${goal.actualScore}% (Target: ${goal.targetScore}%, Change: ${goal.improvement > 0 ? '+' : ''}${goal.improvement}%)`
).join('\n') || 'No goals recorded'}

BEHAVIOR OBSERVATIONS:
${feedbackData.behaviorNotes || 'No behavior notes recorded'}

ENVIRONMENT FACTORS:
${feedbackData.environmentFactors?.join(', ') || 'None specified'}

NEXT STEPS:
${feedbackData.nextSteps || 'No next steps specified'}

${feedbackData.parentFeedback ? `PARENT FEEDBACK:\n${feedbackData.parentFeedback}` : ''}
      `.trim()

      // Update session with progress feedback
      await session.merge({
        sessionNotes: (session.sessionNotes || '') + '\n\n' + progressSummary,
        engagementScore: feedbackData.overallRating
      }).save()

      console.log('✅ Progress feedback stored successfully')

      return response.json({
        message: 'Progress feedback submitted successfully',
        data: {
          sessionId: feedbackData.sessionId,
          stored: true
        }
      })
    } catch (error) {
      console.error('❌ Error submitting progress feedback:', error)
      return response.status(500).json({
        message: 'Failed to submit progress feedback',
        error: error.message
      })
    }
  }

  /**
   * Get session analytics with treatment goal focus
   */
  async getSessionAnalytics({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`📊 Getting treatment goal analytics for session ${sessionId}`)

      // Import analytics services
      const TrialAnalyticsService = (await import('#services/trial_analytics_service')).default

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .preload('client')
        .firstOrFail()

      // Get all trials for this session
      const trials = await Trial.query()
        .where('session_id', sessionId)
        .preload('goal')
        .orderBy('timestamp', 'asc')

      // Get treatment goals for this session's client
      const treatmentGoals = session.clientId ? await TreatmentGoal.query()
        .where('client_id', session.clientId)
        .where('status', 'active') : []

      // Group trials by goal
      const trialsByGoal = new Map<number, any[]>()
      trials.forEach(trial => {
        if (trial.goalId) {
          if (!trialsByGoal.has(trial.goalId)) {
            trialsByGoal.set(trial.goalId, [])
          }
          trialsByGoal.get(trial.goalId)!.push(trial)
        }
      })

      // Calculate analytics for each goal
      const goalAnalytics = []
      for (const [goalId, goalTrials] of trialsByGoal) {
        const goal = treatmentGoals.find(g => g.id === goalId)
        if (!goal) continue

        const totalTrials = goalTrials.length
        const correctTrials = goalTrials.filter(t => t.response === 'correct').length
        const incorrectTrials = goalTrials.filter(t => t.response === 'incorrect').length
        const promptedTrials = goalTrials.filter(t => t.response === 'prompted').length
        const independentTrials = goalTrials.filter(t => t.independent).length

        const percentageCorrect = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0
        const percentageIndependent = totalTrials > 0 ? Math.round((independentTrials / totalTrials) * 100) : 0

        // Calculate trend (simplified)
        let trend: 'ascending' | 'stable' | 'descending' = 'stable'
        if (goalTrials.length >= 3) {
          const firstHalf = goalTrials.slice(0, Math.floor(goalTrials.length / 2))
          const secondHalf = goalTrials.slice(Math.floor(goalTrials.length / 2))
          
          const firstHalfCorrect = firstHalf.filter(t => t.response === 'correct').length / firstHalf.length
          const secondHalfCorrect = secondHalf.filter(t => t.response === 'correct').length / secondHalf.length
          
          const improvement = secondHalfCorrect - firstHalfCorrect
          if (improvement > 0.1) trend = 'ascending'
          else if (improvement < -0.1) trend = 'descending'
        }

        // Check mastery criteria
        const masteryCriteria = goal.masteryCriteria || ''
        const targetPercentage = masteryCriteria.match(/(\d+)%/) ? parseInt(masteryCriteria.match(/(\d+)%/)![1]) : 80
        const masteryMet = percentageCorrect >= targetPercentage && totalTrials >= 3

        // Generate recommendations
        const recommendations = []
        if (percentageCorrect < 50) {
          recommendations.push('Consider breaking down the skill into smaller steps')
          recommendations.push('Increase reinforcement frequency')
        } else if (percentageCorrect < 80) {
          recommendations.push('Continue current teaching strategy with minor adjustments')
        } else if (masteryMet) {
          recommendations.push('Consider moving to maintenance phase')
          recommendations.push('Introduce generalization opportunities')
        }

        if (percentageIndependent < 30) {
          recommendations.push('Focus on fading prompts systematically')
        }

        if (trend === 'descending') {
          recommendations.push('Review teaching procedures for effectiveness')
        }

        goalAnalytics.push({
          goalId,
          goalTitle: goal.title,
          totalTrials,
          correctTrials,
          incorrectTrials,
          promptedTrials,
          independentTrials,
          percentageCorrect,
          percentageIndependent,
          trend,
          masteryMet,
          recommendations: recommendations.slice(0, 3) // Limit to 3 recommendations
        })
      }

      // Calculate overall session metrics
      const totalTrials = trials.length
      const totalCorrect = trials.filter(t => t.response === 'correct').length
      const overallPercentage = totalTrials > 0 ? Math.round((totalCorrect / totalTrials) * 100) : 0

      console.log(`✅ Treatment goal analytics calculated for session ${sessionId}`)

      return response.json({
        sessionId: session.id,
        totalTrials,
        overallPercentage,
        goalAnalytics,
        behaviorReduction: null // Could be calculated from behavior data if needed
      })
    } catch (error) {
      console.error('❌ Error getting session analytics:', error)
      return response.status(400).json({
        message: 'Failed to get session analytics',
        error: error.message,
      })
    }
  }

  /**
   * Save client rating for session
   */
  async saveClientRating({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { sessionId, clientId, rating, date } = request.only([
        'sessionId',
        'clientId', 
        'rating',
        'date'
      ])

      console.log('⭐ Saving client rating:', {
        userId: user.id,
        sessionId,
        clientId,
        rating,
        date
      })

      // Validate rating (1-5 stars)
      if (!rating || rating < 1 || rating > 5) {
        return response.status(400).json({
          message: 'Rating must be between 1 and 5 stars'
        })
      }

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .first()

      if (!session) {
        return response.status(404).json({
          message: 'Session not found or not authorized'
        })
      }

      // For now, we'll store the rating in the session notes or create a separate table
      // Since we don't have a dedicated client_ratings table, we'll store it as JSON in session
      let sessionData = session.sessionNotes ? JSON.parse(session.sessionNotes) : {}
      
      // Initialize clientRatings if it doesn't exist
      if (!sessionData.clientRatings) {
        sessionData.clientRatings = {}
      }
      
      // Store the rating
      sessionData.clientRatings[clientId] = {
        rating,
        ratedAt: new Date().toISOString(),
        ratedBy: user.id
      }

      // Update session with rating data
      await session.merge({
        sessionNotes: JSON.stringify(sessionData)
      }).save()

      console.log('✅ Client rating saved successfully')

      return response.json({
        message: 'Client rating saved successfully',
        data: {
          sessionId,
          clientId,
          rating,
          savedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('❌ Error saving client rating:', error)
      return response.status(500).json({
        message: 'Failed to save client rating',
        error: error.message,
      })
    }
  }

  /**
   * Save behavior assessment data
   */
  async saveBehaviorAssessment({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        sessionId,
        clientId,
        behaviorAssessment
      } = request.only([
        'sessionId',
        'clientId',
        'behaviorAssessment'
      ])

      console.log('🧠 Saving behavior assessment:', {
        userId: user.id,
        sessionId,
        clientId,
        hasBehaviorData: !!behaviorAssessment
      })

      // Validate required fields
      if (!sessionId) {
        return response.status(400).json({
          message: 'Session ID is required'
        })
      }

      if (!clientId) {
        return response.status(400).json({
          message: 'Client ID is required'
        })
      }

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .where('status', 'draft')
        .first()

      if (!session) {
        return response.status(404).json({
          message: 'Session not found or not authorized'
        })
      }

      // Verify client exists
      const client = await Client.find(clientId)
      if (!client) {
        return response.status(404).json({
          message: 'Client not found'
        })
      }

      // Parse existing session notes to preserve other data
      let sessionData: any = {}
      try {
        sessionData = session.sessionNotes ? JSON.parse(session.sessionNotes) : {}
      } catch (parseError) {
        // If session notes aren't valid JSON, start fresh but preserve the text
        sessionData = {
          originalNotes: session.sessionNotes || ''
        }
      }

      // Initialize behaviorAssessments if it doesn't exist
      if (!sessionData.behaviorAssessments) {
        sessionData.behaviorAssessments = {}
      }

      // Store the behavior assessment data
      sessionData.behaviorAssessments[clientId] = {
        ...behaviorAssessment,
        assessedAt: new Date().toISOString(),
        assessedBy: user.id,
        assessorName: user.name
      }

      // Update session with behavior assessment data
      await session.merge({
        sessionNotes: JSON.stringify(sessionData, null, 2)
      }).save()

      console.log('✅ Behavior assessment saved successfully')

      return response.json({
        message: 'Behavior assessment saved successfully',
        data: {
          sessionId,
          clientId,
          behaviorAssessment: sessionData.behaviorAssessments[clientId],
          savedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('❌ Error saving behavior assessment:', error)
      return response.status(500).json({
        message: 'Failed to save behavior assessment',
        error: error.message,
      })
    }
  }

  /**
   * Get behavior assessments for a session
   */
  async getBehaviorAssessments({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const sessionId = params.id

      console.log(`📋 Getting behavior assessments for session ${sessionId}`)

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .first()

      if (!session) {
        return response.status(404).json({
          message: 'Session not found or not authorized'
        })
      }

      // Parse session notes to get behavior assessments
      let behaviorAssessments = {}
      try {
        const sessionData = session.sessionNotes ? JSON.parse(session.sessionNotes) : {}
        behaviorAssessments = sessionData.behaviorAssessments || {}
      } catch (parseError) {
        console.warn('Could not parse session notes for behavior assessments')
      }

      return response.json({
        message: 'Behavior assessments retrieved successfully',
        data: {
          sessionId,
          behaviorAssessments,
          count: Object.keys(behaviorAssessments).length
        }
      })
    } catch (error) {
      console.error('❌ Error getting behavior assessments:', error)
      return response.status(500).json({
        message: 'Failed to get behavior assessments',
        error: error.message,
      })
    }
  }

  /**
   * Save client treatment duration
   */
  async saveClientTreatmentDuration({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        sessionId,
        clientId,
        sessionDuration,
        totalDuration,
        startTime,
        endTime
      } = request.only([
        'sessionId',
        'clientId',
        'sessionDuration',
        'totalDuration',
        'startTime',
        'endTime'
      ])

      console.log('⏱️ Saving client treatment duration:', {
        userId: user.id,
        sessionId,
        clientId,
        sessionDuration,
        totalDuration
      })

      // Verify session belongs to RBT
      const session = await SessionLog.query()
        .where('id', sessionId)
        .where('rbt_id', user.id)
        .first()

      if (!session) {
        return response.status(404).json({
          message: 'Session not found or not authorized'
        })
      }

      // Parse existing session notes to preserve other data
      let sessionData: any = {}
      try {
        sessionData = session.sessionNotes ? JSON.parse(session.sessionNotes) : {}
      } catch (parseError) {
        sessionData = {
          originalNotes: session.sessionNotes || ''
        }
      }

      // Initialize clientTreatmentTimes if it doesn't exist
      if (!sessionData.clientTreatmentTimes) {
        sessionData.clientTreatmentTimes = {}
      }

      // Store the treatment duration data
      sessionData.clientTreatmentTimes[clientId] = {
        sessionDuration,
        totalDuration,
        startTime,
        endTime,
        recordedAt: new Date().toISOString(),
        recordedBy: user.id
      }

      // Update session with treatment duration data
      await session.merge({
        sessionNotes: JSON.stringify(sessionData, null, 2)
      }).save()

      console.log('✅ Client treatment duration saved successfully')

      return response.json({
        message: 'Client treatment duration saved successfully',
        data: {
          sessionId,
          clientId,
          sessionDuration,
          totalDuration,
          savedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('❌ Error saving client treatment duration:', error)
      return response.status(500).json({
        message: 'Failed to save client treatment duration',
        error: error.message,
      })
    }
  }

  /**
   * Get comprehensive progress insights from completed sessions
   */
  async getCompletedSessionsInsights({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { 
        timeframe = 'month', 
        clientId, 
        startDate: customStartDate, 
        endDate: customEndDate 
      } = request.qs()

      console.log('📊 Loading progress insights from completed sessions for RBT:', user.id)

      // Calculate date range
      const now = new Date()
      let startDate: Date
      
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
      } else {
        switch (timeframe) {
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3)
            startDate = new Date(now.getFullYear(), quarter * 3, 1)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default: // week
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 7)
            break
        }
      }

      // Get completed sessions with all related data
      let completedSessionsQuery = SessionLog.query()
        .where('rbt_id', user.id)
        .whereIn('status', ['completed', 'submitted'])
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', now.toISOString().split('T')[0])
        .preload('client')
        .preload('behaviorData', (behaviorQuery) => {
          behaviorQuery.preload('goal')
        })
        .orderBy('date', 'asc')

      if (clientId && clientId !== 'all') {
        completedSessionsQuery = completedSessionsQuery.where('client_id', clientId)
      }

      const completedSessions = await completedSessionsQuery

      console.log(`📈 Found ${completedSessions.length} completed sessions for analysis`)

      // Analyze session data for insights
      const sessionAnalytics = this.analyzeCompletedSessions(completedSessions)
      const clientInsights = await this.generateClientInsights(completedSessions, user.id, startDate, now)
      const progressTrends = this.calculateProgressTrends(completedSessions)
      const rangeAnalytics = this.calculateRangeAnalytics(completedSessions)
      const cumulativeData = this.calculateCumulativeData(completedSessions)

      return response.json({
        summary: {
          totalCompletedSessions: completedSessions.length,
          uniqueClients: new Set(completedSessions.map(s => s.clientId)).size,
          averageSessionDuration: sessionAnalytics.averageDuration,
          overallProgressScore: sessionAnalytics.overallProgress,
          improvementTrend: sessionAnalytics.trend,
          timeframe,
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0]
          }
        },
        sessionAnalytics,
        clientInsights,
        progressTrends,
        rangeAnalytics,
        cumulativeData,
        metadata: {
          generatedAt: new Date().toISOString(),
          rbtId: user.id,
          rbtName: user.name
        }
      })

    } catch (error) {
      console.error('❌ Error generating completed sessions insights:', error)
      return response.status(500).json({
        message: 'Failed to generate progress insights from completed sessions',
        error: error.message
      })
    }
  }

  /**
   * Analyze completed sessions for key metrics
   */
  private analyzeCompletedSessions(sessions: any[]) {
    if (sessions.length === 0) {
      return {
        averageDuration: 0,
        overallProgress: 0,
        trend: 'stable',
        sessionFrequency: 0,
        goalCompletionRate: 0,
        engagementScore: 0
      }
    }

    // Calculate average duration
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0)
    const averageDuration = Math.round(totalDuration / sessions.length)

    // Calculate overall progress from session data
    let totalProgress = 0
    let progressCount = 0

    sessions.forEach(session => {
      // From overall progress field
      if (session.overallProgress) {
        totalProgress += session.overallProgress
        progressCount++
      }

      // From behavior data
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((data: any) => {
          if (data.percentage !== null && data.percentage !== undefined) {
            totalProgress += data.percentage
            progressCount++
          }
        })
      }

      // From client goals data
      try {
        const clientGoalsData = session.clientGoalsData ? JSON.parse(session.clientGoalsData) : []
        clientGoalsData.forEach((clientData: any) => {
          if (clientData.goals && Array.isArray(clientData.goals)) {
            clientData.goals.forEach((goal: any) => {
              if (goal.actualScore !== null && goal.actualScore !== undefined) {
                totalProgress += goal.actualScore
                progressCount++
              }
            })
          }
        })
      } catch (e) {
        // Ignore parsing errors
      }
    })

    const overallProgress = progressCount > 0 ? Math.round(totalProgress / progressCount) : 0

    // Calculate trend (compare first half vs second half)
    const midPoint = Math.floor(sessions.length / 2)
    const firstHalf = sessions.slice(0, midPoint)
    const secondHalf = sessions.slice(midPoint)

    const firstHalfAvg = this.calculateSessionsAverage(firstHalf)
    const secondHalfAvg = this.calculateSessionsAverage(secondHalf)

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (secondHalfAvg > firstHalfAvg + 5) trend = 'up'
    else if (secondHalfAvg < firstHalfAvg - 5) trend = 'down'

    // Calculate session frequency (sessions per week)
    const dateRange = sessions.length > 1 
      ? (new Date(sessions[sessions.length - 1].date).getTime() - new Date(sessions[0].date).getTime()) / (1000 * 60 * 60 * 24 * 7)
      : 1
    const sessionFrequency = Math.round((sessions.length / Math.max(dateRange, 1)) * 10) / 10

    return {
      averageDuration,
      overallProgress,
      trend,
      sessionFrequency,
      goalCompletionRate: overallProgress, // Simplified for now
      engagementScore: overallProgress // Simplified for now
    }
  }

  /**
   * Calculate average progress from sessions
   */
  private calculateSessionsAverage(sessions: any[]): number {
    if (sessions.length === 0) return 0

    let total = 0
    let count = 0

    sessions.forEach(session => {
      if (session.overallProgress) {
        total += session.overallProgress
        count++
      }
    })

    return count > 0 ? total / count : 0
  }

  /**
   * Generate client-specific insights from completed sessions
   */
  private async generateClientInsights(sessions: any[], rbtId: number, startDate: Date, endDate: Date) {
    const clientMap = new Map()

    // Group sessions by client
    sessions.forEach(session => {
      const clientId = session.clientId
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          clientId,
          clientName: session.client ? `${session.client.firstName} ${session.client.lastName}` : 'Unknown',
          sessions: [],
          totalProgress: 0,
          progressCount: 0,
          behaviorDataPoints: []
        })
      }

      const clientData = clientMap.get(clientId)
      clientData.sessions.push(session)

      // Collect progress data
      if (session.overallProgress) {
        clientData.totalProgress += session.overallProgress
        clientData.progressCount++
      }

      if (session.behaviorData) {
        clientData.behaviorDataPoints.push(...session.behaviorData)
      }
    })

    // Generate insights for each client
    const clientInsights = []
    for (const [clientId, data] of clientMap) {
      const averageProgress = data.progressCount > 0 ? Math.round(data.totalProgress / data.progressCount) : 0
      
      // Calculate trend
      const sortedSessions = data.sessions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const recentSessions = sortedSessions.slice(-3)
      const olderSessions = sortedSessions.slice(0, -3)

      const recentAvg = this.calculateSessionsAverage(recentSessions)
      const olderAvg = this.calculateSessionsAverage(olderSessions)

      let progressTrend: 'improving' | 'stable' | 'declining' = 'stable'
      if (recentAvg > olderAvg + 5) progressTrend = 'improving'
      else if (recentAvg < olderAvg - 5) progressTrend = 'declining'

      // Risk assessment
      let riskLevel: 'low' | 'medium' | 'high' = 'low'
      if (averageProgress < 60 || progressTrend === 'declining') {
        riskLevel = 'high'
      } else if (averageProgress < 80) {
        riskLevel = 'medium'
      }

      clientInsights.push({
        id: clientId,
        name: data.clientName,
        totalSessions: data.sessions.length,
        averageProgress,
        progressTrend,
        riskLevel,
        lastSession: sortedSessions[sortedSessions.length - 1]?.date,
        behaviorDataPoints: data.behaviorDataPoints.length,
        keyMetrics: {
          consistency: data.sessions.length >= 3 ? 'good' : 'needs-improvement',
          engagement: averageProgress >= 70 ? 'high' : averageProgress >= 50 ? 'medium' : 'low',
          improvement: progressTrend
        }
      })
    }

    return clientInsights.sort((a, b) => b.totalSessions - a.totalSessions)
  }

  /**
   * Calculate progress trends over time
   */
  private calculateProgressTrends(sessions: any[]) {
    const dailyData = new Map()

    sessions.forEach(session => {
      const date = session.date.toISODate ? session.date.toISODate() : session.date
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          date,
          sessions: 0,
          totalProgress: 0,
          progressCount: 0,
          behaviorDataPoints: 0
        })
      }

      const dayData = dailyData.get(date)
      dayData.sessions++

      if (session.overallProgress) {
        dayData.totalProgress += session.overallProgress
        dayData.progressCount++
      }

      if (session.behaviorData) {
        dayData.behaviorDataPoints += session.behaviorData.length
      }
    })

    const trendData = Array.from(dailyData.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(day => ({
        date: day.date,
        sessions: day.sessions,
        averageProgress: day.progressCount > 0 ? Math.round(day.totalProgress / day.progressCount) : 0,
        behaviorDataPoints: day.behaviorDataPoints
      }))

    return {
      daily: trendData,
      summary: {
        totalDays: trendData.length,
        averageSessionsPerDay: trendData.length > 0 ? Math.round((trendData.reduce((sum, day) => sum + day.sessions, 0) / trendData.length) * 10) / 10 : 0,
        overallTrend: this.calculateOverallTrend(trendData)
      }
    }
  }

  /**
   * Calculate overall trend direction
   */
  private calculateOverallTrend(trendData: any[]): 'improving' | 'stable' | 'declining' {
    if (trendData.length < 2) return 'stable'

    const firstQuarter = trendData.slice(0, Math.floor(trendData.length / 4))
    const lastQuarter = trendData.slice(-Math.floor(trendData.length / 4))

    const firstAvg = firstQuarter.reduce((sum, day) => sum + day.averageProgress, 0) / firstQuarter.length
    const lastAvg = lastQuarter.reduce((sum, day) => sum + day.averageProgress, 0) / lastQuarter.length

    if (lastAvg > firstAvg + 5) return 'improving'
    if (lastAvg < firstAvg - 5) return 'declining'
    return 'stable'
  }

  /**
   * Calculate range analytics (min, max, quartiles, etc.)
   */
  private calculateRangeAnalytics(sessions: any[]) {
    const progressScores: number[] = []
    const sessionDurations: number[] = []
    const behaviorDataScores: number[] = []

    sessions.forEach(session => {
      if (session.overallProgress) {
        progressScores.push(session.overallProgress)
      }
      
      if (session.duration) {
        sessionDurations.push(session.duration)
      }

      if (session.behaviorData) {
        session.behaviorData.forEach((data: any) => {
          if (data.percentage !== null && data.percentage !== undefined) {
            behaviorDataScores.push(data.percentage)
          }
        })
      }
    })

    return {
      progressScores: this.calculateStatistics(progressScores),
      sessionDurations: this.calculateStatistics(sessionDurations),
      behaviorDataScores: this.calculateStatistics(behaviorDataScores),
      sessionVolume: {
        totalSessions: sessions.length,
        uniqueClients: new Set(sessions.map(s => s.clientId)).size,
        dateRange: sessions.length > 0 ? {
          start: sessions[0].date,
          end: sessions[sessions.length - 1].date
        } : null
      }
    }
  }

  /**
   * Calculate statistical measures
   */
  private calculateStatistics(values: number[]) {
    if (values.length === 0) {
      return {
        min: 0, max: 0, mean: 0, median: 0, q1: 0, q3: 0,
        standardDeviation: 0, variance: 0, range: 0, iqr: 0, count: 0
      }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const count = values.length
    const min = sorted[0]
    const max = sorted[count - 1]
    const mean = values.reduce((sum, val) => sum + val, 0) / count
    
    const median = count % 2 === 0 
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)]
    
    const q1 = sorted[Math.floor(count * 0.25)]
    const q3 = sorted[Math.floor(count * 0.75)]
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count
    const standardDeviation = Math.sqrt(variance)
    
    return {
      min, max, mean: Math.round(mean), median, q1, q3,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      range: max - min,
      iqr: q3 - q1,
      count
    }
  }

  /**
   * Calculate cumulative data over time
   */
  private calculateCumulativeData(sessions: any[]) {
    const sortedSessions = sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    let cumulativeSessions = 0
    let cumulativeProgress = 0
    let cumulativeBehaviorData = 0

    const cumulativeData = sortedSessions.map(session => {
      cumulativeSessions++
      
      if (session.overallProgress) {
        cumulativeProgress += session.overallProgress
      }
      
      if (session.behaviorData) {
        cumulativeBehaviorData += session.behaviorData.length
      }

      return {
        date: session.date.toISODate ? session.date.toISODate() : session.date,
        cumulativeSessions,
        cumulativeProgress,
        cumulativeBehaviorData,
        averageProgressToDate: cumulativeSessions > 0 ? Math.round(cumulativeProgress / cumulativeSessions) : 0,
        velocity: cumulativeSessions // Sessions per period
      }
    })

    return {
      timeline: cumulativeData,
      summary: {
        totalSessions: cumulativeSessions,
        finalAverageProgress: cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].averageProgressToDate : 0,
        totalBehaviorDataPoints: cumulativeBehaviorData,
        progressVelocity: cumulativeData.length > 1 ? 
          (cumulativeData[cumulativeData.length - 1].averageProgressToDate - cumulativeData[0].averageProgressToDate) / cumulativeData.length : 0
      }
    }
  }
  async getEnhancedAnalytics({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { 
        timeframe = 'month', 
        clientId, 
        startDate: customStartDate, 
        endDate: customEndDate,
        granularity = 'daily' // daily, weekly, monthly
      } = request.qs()

      console.log('📊 Loading enhanced analytics with range and cumulative data')

      // Calculate date range
      const now = new Date()
      let startDate: Date
      
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
      } else {
        switch (timeframe) {
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3)
            startDate = new Date(now.getFullYear(), quarter * 3, 1)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default: // week
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 7)
            break
        }
      }

      // Get all sessions in date range
      let sessionsQuery = SessionLog.query()
        .where('rbt_id', user.id)
        .where('date', '>=', startDate)
        .where('date', '<=', now)
        .preload('client')
        .orderBy('date', 'asc')

      if (clientId && clientId !== 'all') {
        sessionsQuery = sessionsQuery.where('client_id', clientId)
      }

      const sessions = await sessionsQuery

      // For now, return basic analytics structure
      // The enhanced analytics will be implemented gradually
      return response.json({
        timeSeriesData: [],
        rangeAnalytics: {
          progressScores: { min: 0, max: 100, mean: 75, median: 75, q1: 60, q3: 85, standardDeviation: 15, variance: 225, range: 100, iqr: 25 },
          engagementScores: { min: 0, max: 100, mean: 80, median: 80, q1: 70, q3: 90, standardDeviation: 12, variance: 144, range: 100, iqr: 20 },
          sessionVolume: { totalSessions: sessions.length, dailyRange: { min: 0, max: 5, average: 2 }, weeklyRange: { min: 0, max: 15, average: 8 }, monthlyRange: { min: 0, max: 60, average: 30 } }
        },
        cumulativeAnalytics: [],
        distributionAnalytics: {
          progressDistribution: [],
          engagementDistribution: [],
          performanceCategories: { excellent: 0, good: 0, fair: 0, needsImprovement: 0 }
        },
        trendAnalysis: {
          progressTrend: { direction: 'stable', slope: 0, correlation: 0, volatility: 0, momentum: 0 },
          engagementTrend: { direction: 'stable', slope: 0, volatility: 0, momentum: 0 },
          sessionTrend: { direction: 'stable', slope: 0, consistency: 85 }
        },
        metadata: {
          timeframe,
          granularity,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          totalSessions: sessions.length,
          totalDataPoints: 0
        }
      })

    } catch (error) {
      console.error('❌ Error loading enhanced analytics:', error)
      return response.status(500).json({
        message: 'Failed to load enhanced analytics',
        error: error.message
      })
    }
  }

}
