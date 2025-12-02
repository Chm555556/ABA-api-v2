import type { HttpContext } from '@adonisjs/core/http'
import SessionLog from '#models/session_log'
import Client from '#models/client'
import User from '#models/user'
import SessionOverlapService from '#services/session_overlap_service'
import RecurringSessionService from '#services/recurring_session_service'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

/**
 * SessionsController
 * 
 * Handles all session operations:
 * - Create one-to-one, group, and community sessions
 * - Check for overlaps
 * - Get available clients/parents for group sessions
 */
export default class SessionsController {
  /**
   * Health check endpoint for debugging
   */
  async healthCheck({ response }: HttpContext) {
    return response.ok({
      message: 'SessionsController is working',
      endpoints: {
        clientsForGroup: '/api/common/sessions/clients-for-group',
        checkOverlap: '/api/common/sessions/check-overlap',
        create: '/api/common/sessions',
        rbtSchedule: '/api/common/sessions/rbt/schedule',
      },
      timestamp: new Date().toISOString(),
      controller: 'SessionsController',
    })
  }

  /**
   * Get all clients with their parents for group session selection
   * 
   * Returns clients grouped by parent for easy selection in dropdown
   */
  async getClientsForGroupSession({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      let clients: Client[]
      
      // Get clients based on user role
      if (user.role === 'ADMIN') {
        clients = await Client.query()
          .where('status', 'active')
          .preload('assignedRbts')
          .orderBy('first_name', 'asc')
      } else if (user.role === 'CLINIC') {
        clients = await Client.query()
          .where('clinic_id', user.clinicId!)
          .where('status', 'active')
          .preload('assignedRbts')
          .orderBy('first_name', 'asc')
      } else if (user.role === 'BCBA') {
        clients = await Client.query()
          .where('assigned_bcba', user.id)
          .where('status', 'active')
          .preload('assignedRbts')
          .orderBy('first_name', 'asc')
      } else if (user.role === 'RBT') {
        // RBT can only see their assigned clients
        const rbt = await User.query()
          .where('id', user.id)
          .preload('rbtClients', (query) => {
            query.where('status', 'active')
          })
          .firstOrFail()
        
        clients = rbt.rbtClients
      } else {
        return response.forbidden({ message: 'Access denied' })
      }
      
      // Format response with parent information
      const formattedClients = clients.map((client) => ({
        id: client.id,
        name: client.fullName,
        firstName: client.firstName,
        lastName: client.lastName,
        dateOfBirth: client.dateOfBirth.toISODate(),
        age: client.age,
        // Parent info would come from a parent relationship
        // For now, using emergency contact as parent
        parentName: client.emergencyContactName,
        parentPhone: client.emergencyContactPhone,
      }))
      
      return response.ok({
        clients: formattedClients,
      })
    } catch (error) {
      console.error('Error fetching clients for group session:', error)
      return response.internalServerError({
        message: 'Failed to fetch clients',
        error: error.message,
      })
    }
  }
  
  /**
   * Check if RBT has overlapping sessions
   */
  async checkOverlap({ request, response }: HttpContext) {
    try {
      const { rbtId, date, startTime, duration, excludeSessionId } = request.only([
        'rbtId',
        'date',
        'startTime',
        'duration',
        'excludeSessionId',
      ])
      
      // Validate inputs
      if (!rbtId || !date || !startTime || !duration) {
        return response.badRequest({
          message: 'Missing required fields: rbtId, date, startTime, duration',
        })
      }
      
      const sessionDate = DateTime.fromISO(date)
      
      const overlapCheck = await SessionOverlapService.checkOverlap(
        rbtId,
        sessionDate,
        startTime,
        duration,
        excludeSessionId
      )
      
      if (overlapCheck.hasOverlap) {
        return response.ok({
          hasOverlap: true,
          message: overlapCheck.message,
          conflictingSessions: overlapCheck.conflictingSessions.map((session) => ({
            id: session.id,
            date: session.date.toISODate(),
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            location: session.location,
            sessionType: session.sessionType,
          })),
        })
      }
      
      return response.ok({
        hasOverlap: false,
        message: 'No overlapping sessions found',
      })
    } catch (error) {
      console.error('Error checking overlap:', error)
      return response.internalServerError({
        message: 'Failed to check overlap',
        error: error.message,
      })
    }
  }
  
  /**
   * Create a new session (one-to-one, group, or community)
   * Supports recurring sessions
   */
  async create({ request, response }: HttpContext) {
    const trx = await db.transaction()
    
    try {
      // const user = auth.user!
      const data = request.only([
        'sessionType',
        'clientId',
        'clientIds',
        'rbtId',
        'bcbaId',
        'date',
        'startTime',
        'endTime',
        'duration',
        'totalHours',
        'cptCode',
        'serviceType',
        'location',
        'locationAddress',
        'sessionNotes',
        'recurrence', // New: recurrence configuration
      ])
      
      // Validate session type
      if (!['one_to_one', 'group', 'community'].includes(data.sessionType)) {
        await trx.rollback()
        return response.badRequest({
          message: 'Invalid session type. Must be: one_to_one, group, or community',
        })
      }
      
      // Validate participants based on session type
      if (data.sessionType === 'one_to_one') {
        if (!data.clientId) {
          await trx.rollback()
          return response.badRequest({
            message: 'clientId is required for one-to-one sessions',
          })
        }
      } else {
        // Group or community
        if (!data.clientIds || !Array.isArray(data.clientIds) || data.clientIds.length === 0) {
          await trx.rollback()
          return response.badRequest({
            message: 'clientIds array is required for group/community sessions',
          })
        }
      }
      
      // Check if this is a recurring session
      const recurrence = data.recurrence || { pattern: 'none' }
      
      // Check for overlaps (only for first occurrence)
      const sessionDate = DateTime.fromISO(data.date)
      const overlapCheck = await SessionOverlapService.checkOverlap(
        data.rbtId,
        sessionDate,
        data.startTime,
        data.duration
      )
      
      if (overlapCheck.hasOverlap) {
        await trx.rollback()
        return response.conflict({
          message: overlapCheck.message,
          conflictingSessions: overlapCheck.conflictingSessions,
        })
      }
      
      await trx.commit()
      
      // Create session(s) using RecurringSessionService
      const sessions = await RecurringSessionService.createRecurringSessions(
        {
          clientId: data.sessionType === 'one_to_one' ? data.clientId : null,
          clientIds: data.clientIds,
          rbtId: data.rbtId,
          bcbaId: data.bcbaId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          totalHours: data.totalHours,
          cptCode: data.cptCode,
          serviceType: data.serviceType,
          location: data.location,
          locationAddress: data.locationAddress,
          sessionType: data.sessionType,
          sessionNotes: data.sessionNotes,
          status: 'draft',
        },
        recurrence
      )
      
      const session = sessions[0] // Get the first/master session
      
      // Load relationships
      await session.load('rbt')
      await session.load('bcba')
      if (session.clientId) {
        await session.load('client')
      }
      if (data.sessionType !== 'one_to_one') {
        await session.load('participants', (query) => {
          query.preload('client')
        })
      }
      
      return response.created({
        message: sessions.length > 1 
          ? `${sessions.length} recurring sessions created successfully`
          : 'Session created successfully',
        sessionsCreated: sessions.length,
        session: {
          id: session.id,
          sessionType: session.sessionType,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          location: session.location,
          status: session.status,
          isRecurring: session.isRecurring,
          recurrencePattern: session.recurrencePattern,
          rbt: {
            id: session.rbt.id,
            name: session.rbt.name,
          },
          bcba: {
            id: session.bcba.id,
            name: session.bcba.name,
          },
          client: session.client
            ? {
                id: session.client.id,
                name: session.client.fullName,
              }
            : null,
          participants:
            session.sessionType !== 'one_to_one'
              ? session.participants.map((p) => ({
                  id: p.id,
                  clientId: p.clientId,
                  clientName: p.client.fullName,
                }))
              : [],
        },
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error creating session:', error)
      return response.internalServerError({
        message: 'Failed to create session',
        error: error.message,
      })
    }
  }
  
  /**
   * Get session details with participants
   */
  async show({ params, response }: HttpContext) {
    try {
      const session = await SessionLog.query()
        .where('id', params.id)
        .preload('rbt')
        .preload('bcba')
        .preload('client')
        .preload('participants', (query) => {
          query.preload('client')
        })
        .preload('behaviorData')
        .preload('incidents')
        .firstOrFail()
      
      return response.ok({
        session: {
          id: session.id,
          sessionType: session.sessionType,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          cptCode: session.cptCode,
          serviceType: session.serviceType,
          location: session.location,
          sessionNotes: session.sessionNotes,
          status: session.status,
          rbt: {
            id: session.rbt.id,
            name: session.rbt.name,
          },
          bcba: {
            id: session.bcba.id,
            name: session.bcba.name,
          },
          client: session.client
            ? {
                id: session.client.id,
                name: session.client.fullName,
              }
            : null,
          participants: session.participants.map((p) => ({
            id: p.id,
            clientId: p.clientId,
            clientName: p.client.fullName,
            parentSignature: p.parentSignature,
            notes: p.notes,
          })),
          behaviorData: session.behaviorData,
          incidents: session.incidents,
        },
      })
    } catch (error) {
      console.error('Error fetching session:', error)
      return response.notFound({
        message: 'Session not found',
      })
    }
  }
  
  /**
   * Get RBT's schedule for a date range
   */
  async getRbtSchedule({ request, response }: HttpContext) {
    try {
      const { rbtId, startDate, endDate } = request.qs()
      
      if (!rbtId || !startDate) {
        return response.badRequest({
          message: 'rbtId and startDate are required',
        })
      }
      
      const query = SessionLog.query()
        .where('rbt_id', rbtId)
        .where('date', '>=', startDate)
        .preload('client')
        .preload('participants', (pQuery) => {
          pQuery.preload('client')
        })
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')
      
      if (endDate) {
        query.where('date', '<=', endDate)
      }
      
      const sessions = await query
      
      return response.ok({
        sessions: sessions.map((session) => ({
          id: session.id,
          sessionType: session.sessionType,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          location: session.location,
          status: session.status,
          client: session.client
            ? {
                id: session.client.id,
                name: session.client.fullName,
              }
            : null,
          participantCount:
            session.sessionType !== 'one_to_one' ? session.participants.length : 1,
        })),
      })
    } catch (error) {
      console.error('Error fetching RBT schedule:', error)
      return response.internalServerError({
        message: 'Failed to fetch schedule',
        error: error.message,
      })
    }
  }
}
