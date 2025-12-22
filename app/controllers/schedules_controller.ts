import type { HttpContext } from '@adonisjs/core/http'
import Schedule from '#models/schedule'
import Client from '#models/client'
import { DateTime } from 'luxon'

export default class SchedulesController {
  /**
   * Get schedules
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')
      const clientId = request.input('clientId')
      const rbtId = request.input('rbtId')
      const status = request.input('status')

      let query = Schedule.query()
        .preload('client')
        .preload('rbt')
        .preload('bcba')

      // Role-based filtering
      if (user.role === 'RBT') {
        query = query.where('rbt_id', user.id)
      } else if (user.role === 'BCBA') {
        query = query.where('bcba_id', user.id)
      } else if (user.role === 'PARENT') {
        // Parents can see schedules for their children using parentId
        const parentClients = await Client.query()
          .where('parentId', user.id)
        
        if (parentClients.length > 0) {
          query = query.whereIn('client_id', parentClients.map(c => c.id))
        } else {
          // No access if no children found
          return response.json({ data: [] })
        }
      } else if (user.role === 'CLINIC') {
        // Clinic can see all schedules for their clients
        const clinicClients = await Client.query().where('clinic_id', user.clinicId!)
        query = query.whereIn('client_id', clinicClients.map(c => c.id))
      }

      // Apply filters
      if (startDate) {
        query = query.where('date', '>=', startDate)
      }

      if (endDate) {
        query = query.where('date', '<=', endDate)
      }

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      if (rbtId) {
        query = query.where('rbt_id', rbtId)
      }

      if (status) {
        query = query.where('status', status)
      }

      const schedules = await query
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')

      return response.json({
        data: schedules.map(schedule => ({
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.client.fullName,
          rbtId: schedule.rbtId,
          rbtName: schedule.rbt.name,
          bcbaId: schedule.bcbaId,
          bcbaName: schedule.bcba.name,
          date: schedule.date.toISODate(),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
          createdAt: schedule.createdAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch schedules',
        error: error.message,
      })
    }
  }

  /**
   * Create a new schedule
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        clientId,
        rbtId,
        bcbaId,
        date,
        startTime,
        endTime,
        location,
        notes,
      } = request.only([
        'clientId',
        'rbtId',
        'bcbaId',
        'date',
        'startTime',
        'endTime',
        'location',
        'notes',
      ])

      // Verify access to client
      const client = await Client.findOrFail(clientId)
      
      if (user.role === 'CLINIC' && client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this client',
        })
      }

      const schedule = await Schedule.create({
        clientId: client.id,
        rbtId,
        bcbaId,
        date: DateTime.fromJSDate(new Date(date)),
        startTime,
        endTime,
        location,
        notes,
        status: 'scheduled',
      })

      await schedule.load('client')
      await schedule.load('rbt')
      await schedule.load('bcba')

      return response.status(201).json({
        message: 'Schedule created successfully',
        data: {
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.client.fullName,
          rbtId: schedule.rbtId,
          rbtName: schedule.rbt.name,
          bcbaId: schedule.bcbaId,
          bcbaName: schedule.bcba.name,
          date: schedule.date.toISODate(),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
          createdAt: schedule.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create schedule',
        error: error.message,
      })
    }
  }

  /**
   * Update a schedule
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const scheduleId = params.id
      const updates = request.only([
        'date',
        'startTime',
        'endTime',
        'location',
        'status',
        'notes',
      ])

      const schedule = await Schedule.query()
        .where('id', scheduleId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'CLINIC' && schedule.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'RBT' && schedule.rbtId !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'BCBA' && schedule.bcbaId !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      schedule.merge(updates)
      await schedule.save()

      await schedule.load('rbt')
      await schedule.load('bcba')

      return response.json({
        message: 'Schedule updated successfully',
        data: {
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.client.fullName,
          rbtId: schedule.rbtId,
          rbtName: schedule.rbt.name,
          bcbaId: schedule.bcbaId,
          bcbaName: schedule.bcba.name,
          date: schedule.date.toISODate(),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
          updatedAt: schedule.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update schedule',
        error: error.message,
      })
    }
  }

  /**
   * Delete a schedule
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const scheduleId = params.id

      const schedule = await Schedule.query()
        .where('id', scheduleId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'CLINIC' && schedule.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      await schedule.delete()

      return response.json({
        message: 'Schedule deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to delete schedule',
        error: error.message,
      })
    }
  }

  /**
   * Get calendar view
   */
  async calendar({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const month = request.input('month', new Date().getMonth() + 1)
      const year = request.input('year', new Date().getFullYear())

      // Calculate date range for the month
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      let query = Schedule.query()
        .whereBetween('date', [startDate, endDate])
        .preload('client')
        .preload('rbt')
        .preload('bcba')

      // Role-based filtering
      if (user.role === 'RBT') {
        query = query.where('rbt_id', user.id)
      } else if (user.role === 'BCBA') {
        query = query.where('bcba_id', user.id)
      } else if (user.role === 'CLINIC') {
        const clinicClients = await Client.query().where('clinic_id', user.clinicId!)
        query = query.whereIn('client_id', clinicClients.map(c => c.id))
      }

      const schedules = await query.orderBy('date', 'asc').orderBy('start_time', 'asc')

      // Group by date
      const calendar = schedules.reduce((acc: any, schedule) => {
        const dateKey = schedule.date.toISODate()
        if (!dateKey) return acc
        
        if (!acc[dateKey]) {
          acc[dateKey] = []
        }
        
        acc[dateKey].push({
          id: schedule.id,
          clientName: schedule.client.fullName,
          rbtName: schedule.rbt.name,
          bcbaName: schedule.bcba.name,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
        })
        
        return acc
      }, {})

      return response.json({
        data: calendar,
        month,
        year,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch calendar',
        error: error.message,
      })
    }
  }
}