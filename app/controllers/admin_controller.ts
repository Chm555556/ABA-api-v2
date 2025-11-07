import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import Clinic from '#models/clinic'
import { createUserValidator, updateUserValidator } from '#validators/user'

export default class AdminController {
  /**
   * Get admin dashboard data
   */
  async dashboard({ response }: HttpContext) {
    try {
      // Get total counts
      const totalUsers = await User.query().count('* as total')
      const totalClients = await Client.query().count('* as total')
      const totalSessions = await SessionLog.query().count('* as total')
      
      // Calculate total revenue (mock calculation)
      const sessions = await SessionLog.query().where('status', 'approved')
      const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

      // Get recent users
      const recentUsers = await User.query()
        .orderBy('created_at', 'desc')
        .limit(5)
        .select('id', 'name', 'email', 'role', 'created_at')

      // Get recent sessions
      const recentSessions = await SessionLog.query()
        .preload('client')
        .preload('rbt')
        .orderBy('created_at', 'desc')
        .limit(5)

      // Get monthly stats (last 6 months)
      const monthlyStats = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        const monthUsers = await User.query()
          .whereBetween('created_at', [monthStart, monthEnd])
          .count('* as total')

        const monthSessions = await SessionLog.query()
          .whereBetween('created_at', [monthStart, monthEnd])
          .count('* as total')

        const monthSessionsData = await SessionLog.query()
          .whereBetween('created_at', [monthStart, monthEnd])
          .where('status', 'approved')

        const monthRevenue = monthSessionsData.reduce((sum, session) => sum + (session.totalHours * 100), 0)

        monthlyStats.push({
          month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          users: monthUsers[0].$extras.total,
          sessions: monthSessions[0].$extras.total,
          revenue: monthRevenue,
        })
      }

      return response.json({
        totalUsers: totalUsers[0].$extras.total,
        totalClients: totalClients[0].$extras.total,
        totalSessions: totalSessions[0].$extras.total,
        totalRevenue,
        recentUsers: recentUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISO(),
        })),
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          clientName: session.client.fullName,
          therapistName: session.rbt.name,
          date: session.date.toISODate(),
          duration: session.duration,
          status: session.status,
        })),
        monthlyStats,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch dashboard data',
        error: error.message,
      })
    }
  }

  /**
   * Get all users
   */
  async getUsers({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const role = request.input('role')
      const search = request.input('search')

      let query = User.query()

      if (role) {
        query = query.where('role', role)
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .where('name', 'like', `%${search}%`)
            .orWhere('email', 'like', `%${search}%`)
        })
      }

      const users = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.json({
        data: users.all().map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verified: user.verified,
          isActive: user.isActive,
          clinicId: user.clinicId,
          supervisorId: user.supervisorId,
          hourlyRate: user.hourlyRate,
          phone: user.phone,
          address: user.address,
          permissions: user.permissions,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO(),
        })),
        meta: users.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch users',
        error: error.message,
      })
    }
  }

  /**
   * Create a new user
   */
  async createUser({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createUserValidator)

      // Check if user already exists
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.status(400).json({
          message: 'User with this email already exists',
        })
      }

      const user = await User.create(payload)

      return response.status(201).json({
        message: 'User created successfully',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verified: user.verified,
          isActive: user.isActive,
          clinicId: user.clinicId,
          supervisorId: user.supervisorId,
          hourlyRate: user.hourlyRate,
          phone: user.phone,
          address: user.address,
          permissions: user.permissions,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create user',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Update a user
   */
  async updateUser({ params, request, response }: HttpContext) {
    try {
      const user = await User.findOrFail(params.id)
      const payload = await request.validateUsing(updateUserValidator)

      // Check if email is being changed and if it already exists
      if (payload.email && payload.email !== user.email) {
        const existingUser = await User.findBy('email', payload.email)
        if (existingUser) {
          return response.status(400).json({
            message: 'User with this email already exists',
          })
        }
      }

      user.merge(payload)
      await user.save()

      return response.json({
        message: 'User updated successfully',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verified: user.verified,
          isActive: user.isActive,
          clinicId: user.clinicId,
          supervisorId: user.supervisorId,
          hourlyRate: user.hourlyRate,
          phone: user.phone,
          address: user.address,
          permissions: user.permissions,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update user',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Delete a user
   */
  async deleteUser({ params, response }: HttpContext) {
    try {
      const user = await User.findOrFail(params.id)
      
      // Soft delete by setting isActive to false
      user.isActive = false
      await user.save()

      return response.json({
        message: 'User deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to delete user',
        error: error.message,
      })
    }
  }

  /**
   * Get system statistics
   */
  async getStats({ response }: HttpContext) {
    try {
      const totalUsers = await User.query().count('* as total')
      const totalClients = await Client.query().count('* as total')
      const totalSessions = await SessionLog.query().count('* as total')
      const activeUsers = await User.query().where('is_active', true).count('* as total')
      const pendingSessions = await SessionLog.query().where('status', 'submitted').count('* as total')
      
      // Calculate total revenue
      const sessions = await SessionLog.query().where('status', 'approved')
      const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

      return response.json({
        totalUsers: totalUsers[0].$extras.total,
        totalClients: totalClients[0].$extras.total,
        totalSessions: totalSessions[0].$extras.total,
        totalRevenue,
        activeUsers: activeUsers[0].$extras.total,
        pendingSessions: pendingSessions[0].$extras.total,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch system stats',
        error: error.message,
      })
    }
  }

  /**
   * Get all clinics
   */
  async getClinics({ response }: HttpContext) {
    try {
      const clinics = await Clinic.query().orderBy('name', 'asc')

      return response.json({
        data: clinics.map(clinic => ({
          id: clinic.id,
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email,
          npiNumber: clinic.npiNumber,
          taxId: clinic.taxId,
          isActive: clinic.isActive,
          createdAt: clinic.createdAt.toISO(),
          updatedAt: clinic.updatedAt?.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch clinics',
        error: error.message,
      })
    }
  }

  /**
   * Get all clients (admin view)
   */
  async getClients({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')

      let query = Client.query().preload('parent').preload('clinic')

      if (search) {
        query = query.where((builder) => {
          builder
            .where('full_name', 'like', `%${search}%`)
            .orWhere('client_id', 'like', `%${search}%`)
        })
      }

      const clients = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.json({
        data: clients.all().map(client => ({
          id: client.id,
          clientId: client.clientId,
          fullName: client.fullName,
          dateOfBirth: client.dateOfBirth?.toISODate(),
          diagnosis: client.diagnosis,
          parentName: client.parent?.name,
          clinicName: client.clinic?.name,
          isActive: client.isActive,
          createdAt: client.createdAt.toISO(),
          updatedAt: client.updatedAt?.toISO(),
        })),
        meta: clients.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch clients',
        error: error.message,
      })
    }
  }

  /**
   * Create a new client (admin)
   */
  async createClient({ request, response }: HttpContext) {
    try {
      const payload = request.only([
        'clientId',
        'fullName',
        'dateOfBirth',
        'diagnosis',
        'parentId',
        'clinicId',
        'insuranceInfo',
        'emergencyContact',
        'medicalInfo',
        'behavioralNotes',
        'isActive'
      ])

      // Check if client ID already exists
      const existingClient = await Client.findBy('client_id', payload.clientId)
      if (existingClient) {
        return response.status(400).json({
          message: 'Client with this ID already exists',
        })
      }

      const client = await Client.create(payload)
      await client.load('parent')
      await client.load('clinic')

      return response.status(201).json({
        message: 'Client created successfully',
        data: {
          id: client.id,
          clientId: client.clientId,
          fullName: client.fullName,
          dateOfBirth: client.dateOfBirth?.toISODate(),
          diagnosis: client.diagnosis,
          parentName: client.parent?.name,
          clinicName: client.clinic?.name,
          isActive: client.isActive,
          createdAt: client.createdAt.toISO(),
          updatedAt: client.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create client',
        error: error.message,
      })
    }
  }

  /**
   * Get all sessions (admin view)
   */
  async getSessions({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      let query = SessionLog.query()
        .preload('client')
        .preload('rbt')
        .preload('bcba')

      if (status) {
        query = query.where('status', status)
      }

      if (search) {
        query = query.whereHas('client', (clientQuery) => {
          clientQuery.where('full_name', 'like', `%${search}%`)
        }).orWhereHas('rbt', (rbtQuery) => {
          rbtQuery.where('name', 'like', `%${search}%`)
        })
      }

      const sessions = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.json({
        data: sessions.all().map(session => ({
          id: session.id,
          clientName: session.client.fullName,
          rbtName: session.rbt.name,
          bcbaName: session.bcba?.name,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          status: session.status,
          sessionType: session.sessionType,
          location: session.location,
          createdAt: session.createdAt.toISO(),
          updatedAt: session.updatedAt?.toISO(),
        })),
        meta: sessions.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch sessions',
        error: error.message,
      })
    }
  }

  /**
   * Create a new session (admin)
   */
  async createSession({ request, response }: HttpContext) {
    try {
      const payload = request.only([
        'clientId',
        'rbtId',
        'bcbaId',
        'date',
        'startTime',
        'endTime',
        'duration',
        'sessionType',
        'location',
        'notes',
        'status'
      ])

      // Calculate total hours if not provided
      if (!payload.totalHours && payload.startTime && payload.endTime) {
        const start = new Date(`2000-01-01 ${payload.startTime}`)
        const end = new Date(`2000-01-01 ${payload.endTime}`)
        const diffMs = end.getTime() - start.getTime()
        payload.totalHours = diffMs / (1000 * 60 * 60) // Convert to hours
      }

      const session = await SessionLog.create(payload)
      await session.load('client')
      await session.load('rbt')
      await session.load('bcba')

      return response.status(201).json({
        message: 'Session created successfully',
        data: {
          id: session.id,
          clientName: session.client.fullName,
          rbtName: session.rbt.name,
          bcbaName: session.bcba?.name,
          date: session.date.toISODate(),
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          status: session.status,
          sessionType: session.sessionType,
          location: session.location,
          createdAt: session.createdAt.toISO(),
          updatedAt: session.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create session',
        error: error.message,
      })
    }
  }
}