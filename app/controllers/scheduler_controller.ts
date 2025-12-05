import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import Client from '#models/client'
import Clinic from '#models/clinic'
import Schedule from '#models/schedule'
import SessionLog from '#models/session_log'

export default class SchedulerController {
  /**
   * 📊 Scheduler Dashboard
   * Overview of scheduling statistics and upcoming sessions
   */
  async dashboard({ response }: HttpContext) {
    try {
      const today = DateTime.now().startOf('day')
      const weekStart = today.startOf('week')
      const weekEnd = today.endOf('week')

      // Get counts
      const totalSchedules = await Schedule.query().count('* as total')
      const todaySchedules = await Schedule.query()
        .where('date', today.toSQLDate()!)
        .count('* as total')
      
      const weekSchedules = await Schedule.query()
        .whereBetween('date', [weekStart.toSQLDate()!, weekEnd.toSQLDate()!])
        .count('* as total')

      const totalClients = await Client.query().where('status', 'active').count('* as total')
      const totalRBTs = await User.query().where('role', 'RBT').where('is_active', true).count('* as total')
      const totalBCBAs = await User.query().where('role', 'BCBA').where('is_active', true).count('* as total')

      // Get upcoming schedules
      const upcomingSchedules = await Schedule.query()
        .where('date', '>=', today.toSQLDate()!)
        .preload('client')
        .preload('rbt')
        .preload('bcba')
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')
        .limit(10)

      // Get recent sessions
      const recentSessions = await SessionLog.query()
        .preload('client')
        .preload('rbt')
        .preload('bcba')
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.json({
        stats: {
          totalSchedules: totalSchedules[0].$extras.total,
          todaySchedules: todaySchedules[0].$extras.total,
          weekSchedules: weekSchedules[0].$extras.total,
          totalClients: totalClients[0].$extras.total,
          totalRBTs: totalRBTs[0].$extras.total,
          totalBCBAs: totalBCBAs[0].$extras.total,
        },
        upcomingSchedules: upcomingSchedules.map(schedule => ({
          id: schedule.id,
          clientName: schedule.client.fullName,
          rbtName: schedule.rbt.name,
          bcbaName: schedule.bcba.name,
          date: schedule.date.toISODate(),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
        })),
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          clientName: session.client?.fullName || 'N/A',
          rbtName: session.rbt?.name || 'N/A',
          bcbaName: session.bcba?.name || 'N/A',
          date: session.date instanceof DateTime ? session.date.toISODate() : session.date,
          status: session.status,
        })),
      })
    } catch (error) {
      console.error('Scheduler dashboard error:', error)
      return response.status(500).json({
        message: 'Failed to load scheduler dashboard',
        error: error.message,
      })
    }
  }

  /**
   * 📅 Get Calendar View
   * Full calendar view with all schedules
   */
  async getCalendar({ request, response }: HttpContext) {
    try {
      const month = request.input('month', DateTime.now().month)
      const year = request.input('year', DateTime.now().year)
      const clinicId = request.input('clinicId')
      const rbtId = request.input('rbtId')
      const bcbaId = request.input('bcbaId')

      // Calculate date range for the month
      const startDate = DateTime.fromObject({ year, month, day: 1 }).startOf('day')
      const endDate = startDate.endOf('month')

      let query = Schedule.query()
        .whereBetween('date', [startDate.toSQLDate()!, endDate.toSQLDate()!])
        .preload('client', (clientQuery) => {
          clientQuery.preload('clinic')
        })
        .preload('rbt')
        .preload('bcba')

      // Apply filters
      if (clinicId) {
        query = query.whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
      }

      if (rbtId) {
        query = query.where('rbt_id', rbtId)
      }

      if (bcbaId) {
        query = query.where('bcba_id', bcbaId)
      }

      const schedules = await query
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')

      // Group by date
      const calendar = schedules.reduce((acc: any, schedule) => {
        const dateKey = schedule.date.toISODate()
        if (!dateKey) return acc
        
        if (!acc[dateKey]) {
          acc[dateKey] = []
        }
        
        acc[dateKey].push({
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.client.fullName,
          clinicName: schedule.client.clinic?.name || 'N/A',
          rbtId: schedule.rbtId,
          rbtName: schedule.rbt.name,
          bcbaId: schedule.bcbaId,
          bcbaName: schedule.bcba.name,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
        })
        
        return acc
      }, {})

      return response.json({
        data: calendar,
        month,
        year,
      })
    } catch (error) {
      console.error('Get calendar error:', error)
      return response.status(500).json({
        message: 'Failed to fetch calendar',
        error: error.message,
      })
    }
  }

  /**
   * 📋 Get All Schedules
   * List view with filtering and pagination
   */
  async getSchedules({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')
      const clientId = request.input('clientId')
      const rbtId = request.input('rbtId')
      const bcbaId = request.input('bcbaId')
      const clinicId = request.input('clinicId')
      const status = request.input('status')

      let query = Schedule.query()
        .preload('client', (clientQuery) => {
          clientQuery.preload('clinic')
        })
        .preload('rbt')
        .preload('bcba')

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

      if (bcbaId) {
        query = query.where('bcba_id', bcbaId)
      }

      if (clinicId) {
        query = query.whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
      }

      if (status) {
        query = query.where('status', status)
      }

      const schedules = await query
        .orderBy('date', 'desc')
        .orderBy('start_time', 'asc')
        .paginate(page, limit)

      return response.json({
        data: schedules.all().map(schedule => ({
          id: schedule.id,
          clientId: schedule.clientId,
          clientName: schedule.client.fullName,
          clinicName: schedule.client.clinic?.name || 'N/A',
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
        meta: schedules.getMeta(),
      })
    } catch (error) {
      console.error('Get schedules error:', error)
      return response.status(500).json({
        message: 'Failed to fetch schedules',
        error: error.message,
      })
    }
  }

  /**
   * ➕ Create New Schedule
   */
  async createSchedule({ request, response }: HttpContext) {
    try {
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

      // Validate client exists
      const client = await Client.findOrFail(clientId)
      
      // Validate RBT exists
      const rbt = await User.query()
        .where('id', rbtId)
        .where('role', 'RBT')
        .where('is_active', true)
        .firstOrFail()

      // Validate BCBA exists
      const bcba = await User.query()
        .where('id', bcbaId)
        .where('role', 'BCBA')
        .where('is_active', true)
        .firstOrFail()

      // Create schedule
      const schedule = await Schedule.create({
        clientId: client.id,
        rbtId: rbt.id,
        bcbaId: bcba.id,
        date: DateTime.fromISO(date),
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
      console.error('Create schedule error:', error)
      return response.status(400).json({
        message: 'Failed to create schedule',
        error: error.message,
      })
    }
  }

  /**
   * ✏️ Update Schedule
   */
  async updateSchedule({ params, request, response }: HttpContext) {
    try {
      const schedule = await Schedule.findOrFail(params.id)
      
      const updates = request.only([
        'clientId',
        'rbtId',
        'bcbaId',
        'date',
        'startTime',
        'endTime',
        'location',
        'status',
        'notes',
      ])

      // Validate if changing client
      if (updates.clientId && updates.clientId !== schedule.clientId) {
        await Client.findOrFail(updates.clientId)
      }

      // Validate if changing RBT
      if (updates.rbtId && updates.rbtId !== schedule.rbtId) {
        await User.query()
          .where('id', updates.rbtId)
          .where('role', 'RBT')
          .where('is_active', true)
          .firstOrFail()
      }

      // Validate if changing BCBA
      if (updates.bcbaId && updates.bcbaId !== schedule.bcbaId) {
        await User.query()
          .where('id', updates.bcbaId)
          .where('role', 'BCBA')
          .where('is_active', true)
          .firstOrFail()
      }

      // Convert date if provided
      if (updates.date) {
        updates.date = DateTime.fromISO(updates.date)
      }

      schedule.merge(updates)
      await schedule.save()

      await schedule.load('client')
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
      console.error('Update schedule error:', error)
      return response.status(400).json({
        message: 'Failed to update schedule',
        error: error.message,
      })
    }
  }

  /**
   * ❌ Delete Schedule
   */
  async deleteSchedule({ params, response }: HttpContext) {
    try {
      const schedule = await Schedule.findOrFail(params.id)
      await schedule.delete()

      return response.json({
        message: 'Schedule deleted successfully',
      })
    } catch (error) {
      console.error('Delete schedule error:', error)
      return response.status(400).json({
        message: 'Failed to delete schedule',
        error: error.message,
      })
    }
  }

  /**
   * 👥 Get All Clients
   */
  async getClients({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 50)
      const search = request.input('search')
      const clinicId = request.input('clinicId')
      const status = request.input('status', 'active')

      let query = Client.query()
        .preload('clinic')
        .preload('bcba')
        .preload('assignedRbts')

      if (search) {
        query = query.where((builder) => {
          builder
            .where('first_name', 'like', `%${search}%`)
            .orWhere('last_name', 'like', `%${search}%`)
        })
      }

      if (clinicId) {
        query = query.where('clinic_id', clinicId)
      }

      if (status) {
        query = query.where('status', status)
      }

      const clients = await query
        .orderBy('first_name', 'asc')
        .paginate(page, limit)

      return response.json({
        data: clients.all().map(client => ({
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          dateOfBirth: client.dateOfBirth?.toISODate(),
          age: client.age,
          clinicId: client.clinicId,
          clinicName: client.clinic?.name || 'N/A',
          bcbaId: client.assignedBcba,
          bcbaName: client.bcba?.name || 'Not Assigned',
          status: client.status,
          diagnosis: client.diagnosis,
        })),
        meta: clients.getMeta(),
      })
    } catch (error) {
      console.error('Get clients error:', error)
      return response.status(500).json({
        message: 'Failed to fetch clients',
        error: error.message,
      })
    }
  }

  /**
   * 👨‍⚕️ Get All RBTs
   */
  async getRBTs({ request, response }: HttpContext) {
    try {
      const clinicId = request.input('clinicId')
      const isActive = request.input('isActive', true)

      let query = User.query()
        .where('role', 'RBT')
        .preload('clinic')

      if (clinicId) {
        query = query.where('clinic_id', clinicId)
      }

      if (isActive !== undefined) {
        query = query.where('is_active', isActive)
      }

      const rbts = await query.orderBy('name', 'asc')

      return response.json({
        data: rbts.map(rbt => ({
          id: rbt.id,
          name: rbt.name,
          email: rbt.email,
          phone: rbt.phone,
          clinicId: rbt.clinicId,
          clinicName: rbt.clinic?.name || 'N/A',
          hourlyRate: rbt.hourlyRate,
          isActive: rbt.isActive,
        })),
      })
    } catch (error) {
      console.error('Get RBTs error:', error)
      return response.status(500).json({
        message: 'Failed to fetch RBTs',
        error: error.message,
      })
    }
  }

  /**
   * 👨‍⚕️ Get All BCBAs
   */
  async getBCBAs({ request, response }: HttpContext) {
    try {
      const clinicId = request.input('clinicId')
      const isActive = request.input('isActive', true)

      let query = User.query()
        .where('role', 'BCBA')
        .preload('clinic')

      if (clinicId) {
        query = query.where('clinic_id', clinicId)
      }

      if (isActive !== undefined) {
        query = query.where('is_active', isActive)
      }

      const bcbas = await query.orderBy('name', 'asc')

      return response.json({
        data: bcbas.map(bcba => ({
          id: bcba.id,
          name: bcba.name,
          email: bcba.email,
          phone: bcba.phone,
          clinicId: bcba.clinicId,
          clinicName: bcba.clinic?.name || 'N/A',
          hourlyRate: bcba.hourlyRate,
          isActive: bcba.isActive,
        })),
      })
    } catch (error) {
      console.error('Get BCBAs error:', error)
      return response.status(500).json({
        message: 'Failed to fetch BCBAs',
        error: error.message,
      })
    }
  }

  /**
   * 🏥 Get All Clinics
   */
  async getClinics({ response }: HttpContext) {
    try {
      const clinics = await Clinic.query()
        .where('is_active', true)
        .orderBy('name', 'asc')

      return response.json({
        data: clinics.map(clinic => ({
          id: clinic.id,
          name: clinic.name,
          street: clinic.street,
          city: clinic.city,
          state: clinic.state,
          zipCode: clinic.zipCode,
          phone: clinic.phone,
          email: clinic.email,
          isActive: clinic.isActive,
        })),
      })
    } catch (error) {
      console.error('Get clinics error:', error)
      return response.status(500).json({
        message: 'Failed to fetch clinics',
        error: error.message,
      })
    }
  }

  /**
   * 📊 Get Availability
   * Check RBT/BCBA availability for a specific date/time
   */
  async checkAvailability({ request, response }: HttpContext) {
    try {
      const { date, startTime, endTime, rbtId, bcbaId } = request.only([
        'date',
        'startTime',
        'endTime',
        'rbtId',
        'bcbaId',
      ])

      const conflicts: any = {
        rbt: [],
        bcba: [],
      }

      // Check RBT availability
      if (rbtId) {
        const rbtConflicts = await Schedule.query()
          .where('rbt_id', rbtId)
          .where('date', date)
          .where((query) => {
            query
              .where((q) => {
                q.where('start_time', '<=', startTime).where('end_time', '>', startTime)
              })
              .orWhere((q) => {
                q.where('start_time', '<', endTime).where('end_time', '>=', endTime)
              })
              .orWhere((q) => {
                q.where('start_time', '>=', startTime).where('end_time', '<=', endTime)
              })
          })
          .preload('client')

        conflicts.rbt = rbtConflicts.map(schedule => ({
          id: schedule.id,
          clientName: schedule.client.fullName,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        }))
      }

      // Check BCBA availability
      if (bcbaId) {
        const bcbaConflicts = await Schedule.query()
          .where('bcba_id', bcbaId)
          .where('date', date)
          .where((query) => {
            query
              .where((q) => {
                q.where('start_time', '<=', startTime).where('end_time', '>', startTime)
              })
              .orWhere((q) => {
                q.where('start_time', '<', endTime).where('end_time', '>=', endTime)
              })
              .orWhere((q) => {
                q.where('start_time', '>=', startTime).where('end_time', '<=', endTime)
              })
          })
          .preload('client')

        conflicts.bcba = bcbaConflicts.map(schedule => ({
          id: schedule.id,
          clientName: schedule.client.fullName,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        }))
      }

      const hasConflicts = conflicts.rbt.length > 0 || conflicts.bcba.length > 0

      return response.json({
        available: !hasConflicts,
        conflicts,
      })
    } catch (error) {
      console.error('Check availability error:', error)
      return response.status(500).json({
        message: 'Failed to check availability',
        error: error.message,
      })
    }
  }

  /**
   * 📋 Get Sessions
   * View all sessions for monitoring
   */
  async getSessions({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      let query = SessionLog.query()
        .preload('client')
        .preload('rbt')
        .preload('bcba')

      if (status) {
        query = query.where('status', status)
      }

      if (startDate) {
        query = query.where('date', '>=', startDate)
      }

      if (endDate) {
        query = query.where('date', '<=', endDate)
      }

      const sessions = await query
        .orderBy('date', 'desc')
        .orderBy('start_time', 'desc')
        .paginate(page, limit)

      return response.json({
        data: sessions.all().map(session => ({
          id: session.id,
          clientName: session.client?.fullName || 'N/A',
          rbtName: session.rbt?.name || 'N/A',
          bcbaName: session.bcba?.name || 'N/A',
          date: session.date instanceof DateTime ? session.date.toISODate() : session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          totalHours: session.totalHours,
          status: session.status,
          location: session.location,
        })),
        meta: sessions.getMeta(),
      })
    } catch (error) {
      console.error('Get sessions error:', error)
      return response.status(500).json({
        message: 'Failed to fetch sessions',
        error: error.message,
      })
    }
  }
}
