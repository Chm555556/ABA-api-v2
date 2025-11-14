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

      const clients = await Client.query()
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .where('status', 'active')
        .preload('bcba')
        .preload('treatmentGoals', (goalsQuery) => {
          goalsQuery.where('status', 'active')
        })
        .orderBy('first_name', 'asc')

      return response.json({
        data: clients.map(client => ({
          id: client.id,
          fullName: `${client.firstName} ${client.lastName}`,
          firstName: client.firstName,
          lastName: client.lastName,
          age: client.age,
          dateOfBirth: client.dateOfBirth.toISODate(),
          status: client.status,
          bcbaName: client.bcba?.name || 'Not assigned',
          treatmentGoals: client.treatmentGoals.map(goal => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            measurementType: goal.measurementType,
            masteryCriteria: goal.masteryCriteria,
            status: goal.status,
          })),
          admissionDate: client.admissionDate.toISODate(),
        })),
      })
    } catch (error) {
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

      // Verify RBT has access to this client
      const client = await Client.query()
        .where('id', clientId)
        .whereHas('assignedRbts', (rbtQuery) => {
          rbtQuery.where('users.id', user.id)
        })
        .firstOrFail()

      const now = DateTime.now()
      const startTime = now.toFormat('HH:mm')

      const session = await SessionLog.create({
        clientId: client.id,
        rbtId: user.id,
        bcbaId: client.assignedBcba!,
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

      return response.status(201).json({
        message: 'Session started successfully',
        data: {
          id: session.id,
          clientId: session.clientId,
          clientName: client.fullName,
          startTime: session.startTime,
          location: session.location,
          status: session.status,
          createdAt: session.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to start session',
        error: error.message,
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
   * Get schedule
   */
  async getSchedule({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      let query = Schedule.query()
        .where('rbt_id', user.id)
        .preload('client')
        .preload('bcba')

      if (startDate) {
        query = query.where('date', '>=', startDate)
      }

      if (endDate) {
        query = query.where('date', '<=', endDate)
      }

      const schedules = await query
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')

      return response.json({
        data: schedules.map(schedule => ({
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: `${schedule.client.firstName} ${schedule.client.lastName}`,
          bcbaName: schedule.bcba.name,
          date: schedule.date.toISODate(),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          time: schedule.time,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch schedule',
        error: error.message,
      })
    }
  }
}