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
              goalsQuery.preload('creator')
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
              createdBy: goal.createdBy,
              createdByName: goal.creator?.name || 'Unknown',
              createdAt: goal.createdAt.toISO(),
              updatedAt: goal.updatedAt?.toISO() || null,
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
              goalsQuery.preload('creator')
            })
        })
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client', (clientQuery) => {
            clientQuery
              .preload('bcba')
              .preload('parent')
              .preload('treatmentGoals', (goalsQuery) => {
                goalsQuery.preload('creator')
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
              createdBy: goal.createdBy,
              createdByName: goal.creator?.name || 'Unknown',
              createdAt: goal.createdAt.toISO(),
              updatedAt: goal.updatedAt?.toISO() || null,
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
            createdBy: goal.createdBy,
            createdByName: goal.creator?.name || 'Unknown',
            createdAt: goal.createdAt.toISO(),
            updatedAt: goal.updatedAt?.toISO() || null,
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
          bcbaName: session.bcba.name,
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
            domain: goal.domain,
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
}