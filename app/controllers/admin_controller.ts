// import type { HttpContext } from '@adonisjs/core/http'
// import User from '#models/user'
// import Client from '#models/client'
// import SessionLog from '#models/session_log'
// import Clinic from '#models/clinic'
// import { createUserValidator, updateUserValidator } from '#validators/user'

// export default class AdminController {
//   /**
//    * Get admin dashboard data
//    */
//   async dashboard({ response }: HttpContext) {
//     try {
//       // Get total counts
//       const totalUsers = await User.query().count('* as total')
//       const totalClients = await Client.query().count('* as total')
//       const totalSessions = await SessionLog.query().count('* as total')
      
//       // Calculate total revenue (mock calculation)
//       const sessions = await SessionLog.query().where('status', 'approved')
//       const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

//       // Get recent users
//       const recentUsers = await User.query()
//         .orderBy('created_at', 'desc')
//         .limit(5)
//         .select('id', 'name', 'email', 'role', 'created_at')

//       // Get recent sessions
//       const recentSessions = await SessionLog.query()
//         .preload('client')
//         .preload('rbt')
//         .orderBy('created_at', 'desc')
//         .limit(5)

//       // Get monthly stats (last 6 months)
//       const monthlyStats = []
//       for (let i = 5; i >= 0; i--) {
//         const date = new Date()
//         date.setMonth(date.getMonth() - i)
//         const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
//         const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

//         const monthUsers = await User.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .count('* as total')

//         const monthSessions = await SessionLog.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .count('* as total')

//         const monthSessionsData = await SessionLog.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .where('status', 'approved')

//         const monthRevenue = monthSessionsData.reduce((sum, session) => sum + (session.totalHours * 100), 0)

//         monthlyStats.push({
//           month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
//           users: monthUsers[0].$extras.total,
//           sessions: monthSessions[0].$extras.total,
//           revenue: monthRevenue,
//         })
//       }

//       return response.json({
//         totalUsers: totalUsers[0].$extras.total,
//         totalClients: totalClients[0].$extras.total,
//         totalSessions: totalSessions[0].$extras.total,
//         totalRevenue,
//         recentUsers: recentUsers.map(user => ({
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           createdAt: user.createdAt.toISO(),
//         })),
//         recentSessions: recentSessions.map(session => ({
//           id: session.id,
//           clientName: session.client.fullName,
//           therapistName: session.rbt.name,
//           date: session.date.toISODate(),
//           duration: session.duration,
//           status: session.status,
//         })),
//         monthlyStats,
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch dashboard data',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Get all users
//    */
//   async getUsers({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const role = request.input('role')
//       const search = request.input('search')

//       let query = User.query()

//       if (role) {
//         query = query.where('role', role)
//       }

//       if (search) {
//         query = query.where((builder) => {
//           builder
//             .where('name', 'like', `%${search}%`)
//             .orWhere('email', 'like', `%${search}%`)
//         })
//       }

//       const users = await query
//         .orderBy('created_at', 'desc')
//         .paginate(page, limit)

//       return response.json({
//         data: users.all().map(user => ({
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           verified: user.verified,
//           isActive: user.isActive,
//           clinicId: user.clinicId,
//           supervisorId: user.supervisorId,
//           hourlyRate: user.hourlyRate,
//           phone: user.phone,
//           address: user.address,
//           permissions: user.permissions,
//           createdAt: user.createdAt.toISO(),
//           updatedAt: user.updatedAt?.toISO(),
//         })),
//         meta: users.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch users',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Create a new user
//    */
//   async createUser({ request, response }: HttpContext) {
//     try {
//       const payload = await request.validateUsing(createUserValidator)

//       // Check if user already exists
//       const existingUser = await User.findBy('email', payload.email)
//       if (existingUser) {
//         return response.status(400).json({
//           message: 'User with this email already exists',
//         })
//       }

//       const user = await User.create(payload)

//       return response.status(201).json({
//         message: 'User created successfully',
//         data: {
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           verified: user.verified,
//           isActive: user.isActive,
//           clinicId: user.clinicId,
//           supervisorId: user.supervisorId,
//           hourlyRate: user.hourlyRate,
//           phone: user.phone,
//           address: user.address,
//           permissions: user.permissions,
//           createdAt: user.createdAt.toISO(),
//           updatedAt: user.updatedAt?.toISO(),
//         },
//       })
//     } catch (error) {
//       return response.status(400).json({
//         message: 'Failed to create user',
//         errors: error.messages || error.message,
//       })
//     }
//   }

//   /**
//    * Update a user
//    */
//   async updateUser({ params, request, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
//       const payload = await request.validateUsing(updateUserValidator)

//       // Check if email is being changed and if it already exists
//       if (payload.email && payload.email !== user.email) {
//         const existingUser = await User.findBy('email', payload.email)
//         if (existingUser) {
//           return response.status(400).json({
//             message: 'User with this email already exists',
//           })
//         }
//       }

//       user.merge(payload)
//       await user.save()

//       return response.json({
//         message: 'User updated successfully',
//         data: {
//           id: user.id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           verified: user.verified,
//           isActive: user.isActive,
//           clinicId: user.clinicId,
//           supervisorId: user.supervisorId,
//           hourlyRate: user.hourlyRate,
//           phone: user.phone,
//           address: user.address,
//           permissions: user.permissions,
//           createdAt: user.createdAt.toISO(),
//           updatedAt: user.updatedAt?.toISO(),
//         },
//       })
//     } catch (error) {
//       return response.status(400).json({
//         message: 'Failed to update user',
//         errors: error.messages || error.message,
//       })
//     }
//   }

//   /**
//    * Delete a user
//    */
//   async deleteUser({ params, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
      
//       // Soft delete by setting isActive to false
//       user.isActive = false
//       await user.save()

//       return response.json({
//         message: 'User deleted successfully',
//       })
//     } catch (error) {
//       return response.status(400).json({
//         message: 'Failed to delete user',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Get system statistics
//    */
//   async getStats({ response }: HttpContext) {
//     try {
//       const totalUsers = await User.query().count('* as total')
//       const totalClients = await Client.query().count('* as total')
//       const totalSessions = await SessionLog.query().count('* as total')
//       const activeUsers = await User.query().where('is_active', true).count('* as total')
//       const pendingSessions = await SessionLog.query().where('status', 'submitted').count('* as total')
      
//       // Calculate total revenue
//       const sessions = await SessionLog.query().where('status', 'approved')
//       const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

//       return response.json({
//         totalUsers: totalUsers[0].$extras.total,
//         totalClients: totalClients[0].$extras.total,
//         totalSessions: totalSessions[0].$extras.total,
//         totalRevenue,
//         activeUsers: activeUsers[0].$extras.total,
//         pendingSessions: pendingSessions[0].$extras.total,
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch system stats',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Get all clinics
//    */
//   async getClinics({ response }: HttpContext) {
//     try {
//       const clinics = await Clinic.query().orderBy('name', 'asc')

//       return response.json({
//         data: clinics.map(clinic => ({
//           id: clinic.id,
//           name: clinic.name,
//           address: clinic.address,
//           phone: clinic.phone,
//           email: clinic.email,
//           npiNumber: clinic.npiNumber,
//           taxId: clinic.taxId,
//           isActive: clinic.isActive,
//           createdAt: clinic.createdAt.toISO(),
//           updatedAt: clinic.updatedAt?.toISO(),
//         })),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch clinics',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Get all clients (admin view)
//    */
//   async getClients({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const search = request.input('search')

//       let query = Client.query().preload('parent').preload('clinic')

//       if (search) {
//         query = query.where((builder) => {
//           builder
//             .where('full_name', 'like', `%${search}%`)
//             .orWhere('client_id', 'like', `%${search}%`)
//         })
//       }

//       const clients = await query
//         .orderBy('created_at', 'desc')
//         .paginate(page, limit)

//       return response.json({
//         data: clients.all().map(client => ({
//           id: client.id,
//           clientId: client.clientId,
//           fullName: client.fullName,
//           dateOfBirth: client.dateOfBirth?.toISODate(),
//           diagnosis: client.diagnosis,
//           parentName: client.parent?.name,
//           clinicName: client.clinic?.name,
//           isActive: client.isActive,
//           createdAt: client.createdAt.toISO(),
//           updatedAt: client.updatedAt?.toISO(),
//         })),
//         meta: clients.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch clients',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Create a new client (admin)
//    */
//   async createClient({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'clientId',
//         'fullName',
//         'dateOfBirth',
//         'diagnosis',
//         'parentId',
//         'clinicId',
//         'insuranceInfo',
//         'emergencyContact',
//         'medicalInfo',
//         'behavioralNotes',
//         'isActive'
//       ])

//       // Check if client ID already exists
//       const existingClient = await Client.findBy('client_id', payload.clientId)
//       if (existingClient) {
//         return response.status(400).json({
//           message: 'Client with this ID already exists',
//         })
//       }

//       const client = await Client.create(payload)
//       await client.load('parent')
//       await client.load('clinic')

//       return response.status(201).json({
//         message: 'Client created successfully',
//         data: {
//           id: client.id,
//           clientId: client.clientId,
//           fullName: client.fullName,
//           dateOfBirth: client.dateOfBirth?.toISODate(),
//           diagnosis: client.diagnosis,
//           parentName: client.parent?.name,
//           clinicName: client.clinic?.name,
//           isActive: client.isActive,
//           createdAt: client.createdAt.toISO(),
//           updatedAt: client.updatedAt?.toISO(),
//         },
//       })
//     } catch (error) {
//       return response.status(400).json({
//         message: 'Failed to create client',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Get all sessions (admin view)
//    */
//   async getSessions({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const status = request.input('status')
//       const search = request.input('search')

//       let query = SessionLog.query()
//         .preload('client')
//         .preload('rbt')
//         .preload('bcba')

//       if (status) {
//         query = query.where('status', status)
//       }

//       if (search) {
//         query = query.whereHas('client', (clientQuery) => {
//           clientQuery.where('full_name', 'like', `%${search}%`)
//         }).orWhereHas('rbt', (rbtQuery) => {
//           rbtQuery.where('name', 'like', `%${search}%`)
//         })
//       }

//       const sessions = await query
//         .orderBy('created_at', 'desc')
//         .paginate(page, limit)

//       return response.json({
//         data: sessions.all().map(session => ({
//           id: session.id,
//           clientName: session.client.fullName,
//           rbtName: session.rbt.name,
//           bcbaName: session.bcba?.name,
//           date: session.date.toISODate(),
//           startTime: session.startTime,
//           endTime: session.endTime,
//           duration: session.duration,
//           totalHours: session.totalHours,
//           status: session.status,
//           sessionType: session.sessionType,
//           location: session.location,
//           createdAt: session.createdAt.toISO(),
//           updatedAt: session.updatedAt?.toISO(),
//         })),
//         meta: sessions.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch sessions',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * Create a new session (admin)
//    */
//   async createSession({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'clientId',
//         'rbtId',
//         'bcbaId',
//         'date',
//         'startTime',
//         'endTime',
//         'duration',
//         'sessionType',
//         'location',
//         'notes',
//         'status'
//       ])

//       // Calculate total hours if not provided
//       if (!payload.totalHours && payload.startTime && payload.endTime) {
//         const start = new Date(`2000-01-01 ${payload.startTime}`)
//         const end = new Date(`2000-01-01 ${payload.endTime}`)
//         const diffMs = end.getTime() - start.getTime()
//         payload.totalHours = diffMs / (1000 * 60 * 60) // Convert to hours
//       }

//       const session = await SessionLog.create(payload)
//       await session.load('client')
//       await session.load('rbt')
//       await session.load('bcba')

//       return response.status(201).json({
//         message: 'Session created successfully',
//         data: {
//           id: session.id,
//           clientName: session.client.fullName,
//           rbtName: session.rbt.name,
//           bcbaName: session.bcba?.name,
//           date: session.date.toISODate(),
//           startTime: session.startTime,
//           endTime: session.endTime,
//           duration: session.duration,
//           totalHours: session.totalHours,
//           status: session.status,
//           sessionType: session.sessionType,
//           location: session.location,
//           createdAt: session.createdAt.toISO(),
//           updatedAt: session.updatedAt?.toISO(),
//         },
//       })
//     } catch (error) {
//       return response.status(400).json({
//         message: 'Failed to create session',
//         error: error.message,
//       })
//     }
//   }
// }







// import type { HttpContext } from '@adonisjs/core/http'
// import User from '#models/user'
// import Client from '#models/client'
// import SessionLog from '#models/session_log'
// import Clinic from '#models/clinic'
// import { createUserValidator, updateUserValidator } from '#validators/user'

// export default class AdminController {
//   /**
//    * -----------------------------
//    * DASHBOARD SUMMARY
//    * -----------------------------
//    */
//   public async dashboard({ response }: HttpContext) {
//     try {
//       const totalUsers = await User.query().count('* as total')
//       const totalClients = await Client.query().count('* as total')
//       const totalSessions = await SessionLog.query().count('* as total')

//       const approvedSessions = await SessionLog.query().where('status', 'approved')
//       const totalRevenue = approvedSessions.reduce(
//         (sum, session) => sum + (session.totalHours * 100),
//         0
//       )

//       const recentUsers = await User.query()
//         .orderBy('created_at', 'desc')
//         .limit(5)
//         .select('id', 'name', 'email', 'role', 'created_at')

//       const recentSessions = await SessionLog.query()
//         .preload('client')
//         .preload('rbt')
//         .orderBy('created_at', 'desc')
//         .limit(5)

//       const monthlyStats = []
//       for (let i = 5; i >= 0; i--) {
//         const date = new Date()
//         date.setMonth(date.getMonth() - i)
//         const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
//         const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

//         const usersCount = await User.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .count('* as total')

//         const sessionsCount = await SessionLog.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .count('* as total')

//         const sessionsData = await SessionLog.query()
//           .whereBetween('created_at', [monthStart, monthEnd])
//           .where('status', 'approved')

//         const monthRevenue = sessionsData.reduce(
//           (sum, session) => sum + (session.totalHours * 100),
//           0
//         )

//         monthlyStats.push({
//           month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
//           users: usersCount[0].$extras.total,
//           sessions: sessionsCount[0].$extras.total,
//           revenue: monthRevenue,
//         })
//       }

//       return response.json({
//         totalUsers: totalUsers[0].$extras.total,
//         totalClients: totalClients[0].$extras.total,
//         totalSessions: totalSessions[0].$extras.total,
//         totalRevenue,
//         recentUsers,
//         recentSessions: recentSessions.map((s) => ({
//           id: s.id,
//           clientName: s.client?.fullName,
//           therapistName: s.rbt?.name,
//           date: s.date.toISODate(),
//           duration: s.duration,
//           status: s.status,
//         })),
//         monthlyStats,
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch dashboard data',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * -----------------------------
//    * USER MANAGEMENT
//    * -----------------------------
//    */
//   public async getUsers({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const role = request.input('role')
//       const search = request.input('search')

//       let query = User.query()
//       if (role) query = query.where('role', role)
//       if (search) {
//         query = query.where((builder) => {
//           builder.where('name', 'like', `%${search}%`).orWhere('email', 'like', `%${search}%`)
//         })
//       }

//       const users = await query.orderBy('created_at', 'desc').paginate(page, limit)

//       return response.json({
//         data: users.all(),
//         meta: users.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch users',
//         error: error.message,
//       })
//     }
//   }

//   public async createUser({ request, response }: HttpContext) {
//     try {
//       const payload = await request.validateUsing(createUserValidator)
//       const existingUser = await User.findBy('email', payload.email)
//       if (existingUser) return response.badRequest({ message: 'User already exists' })

//       const user = await User.create(payload)
//       return response.created({ message: 'User created successfully', data: user })
//     } catch (error) {
//       return response.badRequest({
//         message: 'Failed to create user',
//         errors: error.messages || error.message,
//       })
//     }
//   }

//   public async updateUser({ params, request, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
//       const payload = await request.validateUsing(updateUserValidator)

//       if (payload.email && payload.email !== user.email) {
//         const existing = await User.findBy('email', payload.email)
//         if (existing) return response.badRequest({ message: 'Email already in use' })
//       }

//       user.merge(payload)
//       await user.save()

//       return response.json({ message: 'User updated successfully', data: user })
//     } catch (error) {
//       return response.badRequest({
//         message: 'Failed to update user',
//         errors: error.messages || error.message,
//       })
//     }
//   }

//   public async deleteUser({ params, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
//       user.isActive = false
//       await user.save()
//       return response.json({ message: 'User deactivated successfully' })
//     } catch (error) {
//       return response.badRequest({
//         message: 'Failed to delete user',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * -----------------------------
//    * CLIENT MANAGEMENT
//    * -----------------------------
//    */
//   public async getClients({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const search = request.input('search')

//       let query = Client.query().preload('clinic').preload('bcba').preload('assignedRbts')

//       if (search) {
//         query = query.where((builder) => {
//           builder.where('first_name', 'like', `%${search}%`).orWhere('last_name', 'like', `%${search}%`)
//         })
//       }

//       const clients = await query.orderBy('created_at', 'desc').paginate(page, limit)

//       return response.json({
//         data: clients.all().map((c) => ({
//           id: c.id,
//           fullName: c.fullName,
//           clinicName: c.clinic?.name,
//           bcba: c.bcba?.name,
//           email: c.email,
//           phone: c.phone,
//           status: c.status,
//           createdAt: c.createdAt.toISO(),
//         })),
//         meta: clients.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch clients',
//         error: error.message,
//       })
//     }
//   }

//   public async createClient({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'firstName',
//         'lastName',
//         'dateOfBirth',
//         'clinicId',
//         'parentId',
//         'assignedBcba',
//         'email',
//         'phone',
//         'insuranceType',
//         'insuranceId',
//         'status',
//       ])

//       // ✅ Validate clinicId
//       if (!payload.clinicId) throw new Error('clinicId is required')
//       const clinic = await Clinic.find(payload.clinicId)
//       if (!clinic) throw new Error(`Clinic with id ${payload.clinicId} not found`)

//       // ✅ Validate BCBA if provided
//       if (payload.assignedBcba) {
//         const bcba = await User.find(payload.assignedBcba)
//         if (!bcba) throw new Error(`BCBA with id ${payload.assignedBcba} not found`)
//       }

//       // ✅ Validate Parent if provided
//       if (payload.parentId) {
//         const parent = await User.find(payload.parentId)
//         if (!parent) throw new Error(`Parent with id ${payload.parentId} not found`)
//       }

//       // ✅ Create new client
//       const client = await Client.create({
//         firstName: payload.firstName,
//         lastName: payload.lastName,
//         dateOfBirth: payload.dateOfBirth,
//         clinicId: payload.clinicId,
//         assignedBcba: payload.assignedBcba || null,
//         email: payload.email,
//         phone: payload.phone,
//         insuranceType: payload.insuranceType,
//         insuranceId: payload.insuranceId,
//         status: payload.status || 'active',
//       })

//       await client.load('clinic')

//       return response.created({
//         message: 'Client created successfully',
//         data: client,
//       })
//     } catch (error) {
//       console.error('Create client error:', error)
//       return response.badRequest({
//         message: 'Failed to create client',
//         error: error.message,
//       })
//     }
//   }

//   /**
//    * -----------------------------
//    * CLINICS + SESSIONS
//    * -----------------------------
//    */
//   public async getClinics({ response }: HttpContext) {
//     try {
//       const clinics = await Clinic.query().orderBy('name', 'asc')
//       return response.json({ data: clinics })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch clinics',
//         error: error.message,
//       })
//     }
//   }

//   public async getSessions({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const status = request.input('status')
//       const search = request.input('search')

//       let query = SessionLog.query()
//         .preload('client')
//         .preload('rbt')
//         .preload('bcba')

//       if (status) query = query.where('status', status)
//       if (search) {
//         query = query
//           .whereHas('client', (c) => c.where('first_name', 'like', `%${search}%`))
//           .orWhereHas('rbt', (r) => r.where('name', 'like', `%${search}%`))
//       }

//       const sessions = await query.orderBy('created_at', 'desc').paginate(page, limit)

//       return response.json({
//         data: sessions.all().map((s) => ({
//           id: s.id,
//           clientName: s.client?.fullName,
//           rbtName: s.rbt?.name,
//           bcbaName: s.bcba?.name,
//           date: s.date.toISODate(),
//           startTime: s.startTime,
//           endTime: s.endTime,
//           totalHours: s.totalHours,
//           status: s.status,
//         })),
//         meta: sessions.getMeta(),
//       })
//     } catch (error) {
//       return response.status(500).json({
//         message: 'Failed to fetch sessions',
//         error: error.message,
//       })
//     }
//   }

//   public async createSession({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'clientId',
//         'rbtId',
//         'bcbaId',
//         'date',
//         'startTime',
//         'endTime',
//         'duration',
//         'sessionType',
//         'location',
//         'notes',
//         'status',
//       ])

//       if (!payload.totalHours && payload.startTime && payload.endTime) {
//         const start = new Date(`2000-01-01T${payload.startTime}`)
//         const end = new Date(`2000-01-01T${payload.endTime}`)
//         payload.totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
//       }

//       const session = await SessionLog.create(payload)
//       await session.load('client')
//       await session.load('rbt')
//       await session.load('bcba')

//       return response.created({
//         message: 'Session created successfully',
//         data: session,
//       })
//     } catch (error) {
//       return response.badRequest({
//         message: 'Failed to create session',
//         error: error.message,
//       })
//     }
//   }
// }





// import type { HttpContext } from '@adonisjs/core/http'
// import User from '#models/user'
// import Client from '#models/client'
// import Clinic from '#models/clinic'
// import SessionLog from '#models/session_log'
// import { createUserValidator, updateUserValidator } from '#validators/user'

// export default class AdminController {
//   /**
//    * 📊 Admin Dashboard
//    */
//   async dashboard({ response }: HttpContext) {
//     try {
//       const totalUsers = await User.query().count('* as total')
//       const totalClients = await Client.query().count('* as total')
//       const totalSessions = await SessionLog.query().count('* as total')
//       const sessions = await SessionLog.query().where('status', 'approved')

//       const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

//       const recentUsers = await User.query().orderBy('created_at', 'desc').limit(5)
//       const recentSessions = await SessionLog.query()
//         .preload('client')
//         .preload('rbt')
//         .orderBy('created_at', 'desc')
//         .limit(5)

//       return response.json({
//         totals: {
//           users: totalUsers[0].$extras.total,
//           clients: totalClients[0].$extras.total,
//           sessions: totalSessions[0].$extras.total,
//           revenue: totalRevenue,
//         },
//         recentUsers,
//         recentSessions,
//       })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to load dashboard', error: error.message })
//     }
//   }

//   /**
//    * 👥 Get all users
//    */
//   async getUsers({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const role = request.input('role')
//       const search = request.input('search')

//       let query = User.query()

//       if (role) query = query.where('role', role)
//       if (search) {
//         query = query.where((builder) => {
//           builder.where('name', 'like', `%${search}%`).orWhere('email', 'like', `%${search}%`)
//         })
//       }

//       const users = await query.orderBy('created_at', 'desc').paginate(page, limit)

//       return response.json({ data: users.all(), meta: users.getMeta() })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to fetch users', error: error.message })
//     }
//   }

//   /**
//    * ➕ Create user
//    */
//   async createUser({ request, response }: HttpContext) {
//     try {
//       const payload = await request.validateUsing(createUserValidator)

//       const existingUser = await User.findBy('email', payload.email)
//       if (existingUser)
//         return response.status(400).json({ message: 'User with this email already exists' })

//       const user = await User.create(payload)
//       return response.status(201).json({ message: 'User created successfully', data: user })
//     } catch (error) {
//       return response.status(400).json({ message: 'Failed to create user', error: error.messages || error.message })
//     }
//   }

//   /**
//    * ✏️ Update user
//    */
//   async updateUser({ params, request, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
//       const payload = await request.validateUsing(updateUserValidator)

//       if (payload.email && payload.email !== user.email) {
//         const exists = await User.findBy('email', payload.email)
//         if (exists)
//           return response.status(400).json({ message: 'User with this email already exists' })
//       }

//       user.merge(payload)
//       await user.save()
//       return response.json({ message: 'User updated successfully', data: user })
//     } catch (error) {
//       return response.status(400).json({ message: 'Failed to update user', error: error.messages || error.message })
//     }
//   }

//   /**
//    * ❌ Soft delete user
//    */
//   async deleteUser({ params, response }: HttpContext) {
//     try {
//       const user = await User.findOrFail(params.id)
//       user.isActive = false
//       await user.save()
//       return response.json({ message: 'User deactivated successfully' })
//     } catch (error) {
//       return response.status(400).json({ message: 'Failed to delete user', error: error.message })
//     }
//   }

//   /**
//    * 🏥 Get all clinics
//    */
//   async getClinics({ response }: HttpContext) {
//     try {
//       const clinics = await Clinic.query().orderBy('name', 'asc')
//       return response.json({ data: clinics })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to fetch clinics', error: error.message })
//     }
//   }

//   /**
//    * 👶 Get all clients
//    */
//   async getClients({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const search = request.input('search')

//       let query = Client.query().preload('clinic').preload('bcba')

//       if (search) {
//         query = query.where((builder) => {
//           builder.where('first_name', 'like', `%${search}%`).orWhere('last_name', 'like', `%${search}%`)
//         })
//       }

//       const clients = await query.orderBy('created_at', 'desc').paginate(page, limit)
//       return response.json({ data: clients.all(), meta: clients.getMeta() })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to fetch clients', error: error.message })
//     }
//   }

//   /**
//    * ➕ Create new client
//    */
//   async createClient({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'firstName',
//         'lastName',
//         'dateOfBirth',
//         'clinicId',
//         'parentId',
//         'assignedBcba',
//         'email',
//         'phone',
//         'insuranceType',
//         'insuranceId',
//         'status',
//       ])

//       // Set optional default values to avoid NOT NULL errors
//       const defaults = {
//         street: '',
//         city: '',
//         state: '',
//         zipCode: '',
//         emergencyContactName: '',
//         emergencyContactRelationship: '',
//         emergencyContactPhone: '',
//         admissionDate: new Date(),
//         dischargeDate: null,
//         diagnosis: [],
//       }

//       const client = await Client.create({ ...defaults, ...payload })

//       await client.load('clinic')
//       await client.load('bcba')

//       return response.status(201).json({ message: 'Client created successfully', data: client })
//     } catch (error) {
//       return response.status(400).json({ message: 'Failed to create client', error: error.message })
//     }
//   }

//   /**
//    * 🧾 Get all sessions
//    */
//   async getSessions({ request, response }: HttpContext) {
//     try {
//       const page = request.input('page', 1)
//       const limit = request.input('limit', 10)
//       const status = request.input('status')

//       let query = SessionLog.query().preload('client').preload('rbt').preload('bcba')

//       if (status) query = query.where('status', status)

//       const sessions = await query.orderBy('created_at', 'desc').paginate(page, limit)
//       return response.json({ data: sessions.all(), meta: sessions.getMeta() })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to fetch sessions', error: error.message })
//     }
//   }

//   /**
//    * ➕ Create new session
//    */
//   async createSession({ request, response }: HttpContext) {
//     try {
//       const payload = request.only([
//         'clientId',
//         'rbtId',
//         'bcbaId',
//         'date',
//         'startTime',
//         'endTime',
//         'duration',
//         'sessionType',
//         'location',
//         'notes',
//         'status',
//       ])

//       if (!payload.totalHours && payload.startTime && payload.endTime) {
//         const start = new Date(`2000-01-01 ${payload.startTime}`)
//         const end = new Date(`2000-01-01 ${payload.endTime}`)
//         const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
//         payload.totalHours = diff
//       }

//       const session = await SessionLog.create(payload)
//       await session.load('client')
//       await session.load('rbt')
//       await session.load('bcba')

//       return response.status(201).json({ message: 'Session created successfully', data: session })
//     } catch (error) {
//       return response.status(400).json({ message: 'Failed to create session', error: error.message })
//     }
//   }

//   /**
//    * 📈 System Stats (for Admin Dashboard Widgets)
//    */
//   async getStats({ response }: HttpContext) {
//     try {
//       const totalUsers = await User.query().count('* as total')
//       const totalClients = await Client.query().count('* as total')
//       const totalSessions = await SessionLog.query().count('* as total')
//       const activeUsers = await User.query().where('is_active', true).count('* as total')
//       const pendingSessions = await SessionLog.query().where('status', 'submitted').count('* as total')

//       const sessions = await SessionLog.query().where('status', 'approved')
//       const totalRevenue = sessions.reduce((sum, session) => sum + (session.totalHours * 100), 0)

//       return response.json({
//         totalUsers: totalUsers[0].$extras.total,
//         totalClients: totalClients[0].$extras.total,
//         totalSessions: totalSessions[0].$extras.total,
//         totalRevenue,
//         activeUsers: activeUsers[0].$extras.total,
//         pendingSessions: pendingSessions[0].$extras.total,
//       })
//     } catch (error) {
//       return response.status(500).json({ message: 'Failed to fetch system stats', error: error.message })
//     }
//   }
// }



import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import Client from '#models/client'
import Clinic from '#models/clinic'
import SessionLog from '#models/session_log'
import { createUserValidator, updateUserValidator } from '#validators/user'

export default class AdminController {
  /**
   * 📊 Admin Dashboard Overview
   */
  async dashboard({ response }: HttpContext) {
    try {
      const totalUsers = await User.query().count('* as total')
      const totalClients = await Client.query().count('* as total')
      const totalSessions = await SessionLog.query().count('* as total')

      const sessions = await SessionLog.query().where('status', 'approved')
      const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalHours * 100), 0)

      const recentUsers = await User.query().orderBy('created_at', 'desc').limit(5)
      const recentSessions = await SessionLog.query()
        .preload('client')
        .preload('rbt')
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.json({
        totals: {
          users: totalUsers[0].$extras.total,
          clients: totalClients[0].$extras.total,
          sessions: totalSessions[0].$extras.total,
          revenue: totalRevenue,
        },
        recentUsers,
        recentSessions: recentSessions.map((session) => ({
          id: session.id,
          clientName: session.client?.fullName || null,
          rbtName: session.rbt?.name || null,
          date: session.date instanceof DateTime ? session.date.toISODate() : session.date,
          status: session.status,
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to load dashboard data',
        error: error.message,
      })
    }
  }

  /**
   * 👥 Fetch all users
   */
  async getUsers({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const role = request.input('role')
      const search = request.input('search')

      let query = User.query()
      if (role) query = query.where('role', role)
      if (search) {
        query = query.where((builder) => {
          builder.where('name', 'like', `%${search}%`).orWhere('email', 'like', `%${search}%`)
        })
      }

      const users = await query.orderBy('created_at', 'desc').paginate(page, limit)
      return response.json({ data: users.all(), meta: users.getMeta() })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch users',
        error: error.message,
      })
    }
  }

  /**
   * ➕ Create new user
   */
  async createUser({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createUserValidator)
      const existing = await User.findBy('email', payload.email)
      if (existing) return response.status(400).json({ message: 'User with this email already exists' })

      const user = await User.create(payload)
      return response.status(201).json({ message: 'User created successfully', data: user })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create user',
        error: error.messages || error.message,
      })
    }
  }

  /**
   * ✏️ Update user
   */
  async updateUser({ params, request, response }: HttpContext) {
    try {
      const user = await User.findOrFail(params.id)
      const payload = await request.validateUsing(updateUserValidator)

      if (payload.email && payload.email !== user.email) {
        const exists = await User.findBy('email', payload.email)
        if (exists) return response.status(400).json({ message: 'User with this email already exists' })
      }

      user.merge(payload)
      await user.save()
      return response.json({ message: 'User updated successfully', data: user })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update user',
        error: error.messages || error.message,
      })
    }
  }

  /**
   * ❌ Deactivate user (soft delete)
   */
  async deleteUser({ params, response }: HttpContext) {
    try {
      const user = await User.findOrFail(params.id)
      user.isActive = false
      await user.save()
      return response.json({ message: 'User deactivated successfully' })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to deactivate user',
        error: error.message,
      })
    }
  }

  /**
   * 👶 Get all clients
   */
  async getClients({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')

      let query = Client.query().preload('clinic').preload('bcba')
      if (search) {
        query = query.where((builder) => {
          builder.where('first_name', 'like', `%${search}%`).orWhere('last_name', 'like', `%${search}%`)
        })
      }

      const clients = await query.orderBy('created_at', 'desc').paginate(page, limit)
      return response.json({ data: clients.all(), meta: clients.getMeta() })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch clients',
        error: error.message,
      })
    }
  }

  /**
   * ➕ Create new client
   */
  async createClient({ request, response }: HttpContext) {
    try {
      const payload = request.only([
        'firstName',
        'lastName',
        'dateOfBirth',
        'clinicId',
        'parentId',
        'assignedBcba',
        'email',
        'phone',
        'insuranceType',
        'insuranceId',
        'status',
      ])

      // Convert dateOfBirth string to DateTime
      if (payload.dateOfBirth) {
        payload.dateOfBirth = DateTime.fromISO(payload.dateOfBirth)
      }

      const defaults = {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactPhone: '',
        admissionDate: DateTime.now(),
        dischargeDate: null,
        diagnosis: [],
      }

      const client = await Client.create({ ...defaults, ...payload })
      await client.load('clinic')
      
      // Only load bcba if assigned
      if (client.assignedBcba) {
        await client.load('bcba')
      }

      return response.status(201).json({
        message: 'Client created successfully',
        data: client,
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create client',
        error: error.message,
      })
    }
  }

  /**
   * 🧾 Get all sessions
   */
  async getSessions({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')

      let query = SessionLog.query()
        .preload('client')
        .preload('rbt')
        .preload('bcba')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client')
        })
      
      if (status) query = query.where('status', status)

      const sessions = await query.orderBy('created_at', 'desc').paginate(page, limit)
      
      // Format the response to include participant count
      const formattedSessions = sessions.all().map((session) => {
        const sessionData = session.toJSON()
        return {
          ...sessionData,
          participantCount: session.sessionType !== 'one_to_one' 
            ? session.participants?.length || 0 
            : 1,
        }
      })
      
      return response.json({ data: formattedSessions, meta: sessions.getMeta() })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch sessions',
        error: error.message,
      })
    }
  }

  /**
   * 🔍 Get single session with full details (Admin)
   */
  async getSession({ params, response }: HttpContext) {
    try {
      const session = await SessionLog.query()
        .where('id', params.id)
        .preload('client', (clientQuery) => {
          clientQuery.preload('clinic').preload('bcba')
        })
        .preload('rbt')
        .preload('bcba')
        .preload('participants', (participantsQuery) => {
          participantsQuery.preload('client', (clientQuery) => {
            clientQuery.preload('clinic')
          })
        })
        .firstOrFail()

      // Get all occurrences if this is a recurring session
      let allOccurrences: any[] = []
      if (session.isRecurring) {
        const occurrencesQuery = session.isSeriesMaster
          ? SessionLog.query().where('parent_session_id', session.id).orWhere('id', session.id)
          : SessionLog.query().where('parent_session_id', session.parentSessionId || session.id).orWhere('id', session.parentSessionId || session.id)
        
        const occurrences = await occurrencesQuery
          .select('id', 'date', 'start_time', 'end_time', 'occurrence_number')
          .orderBy('occurrence_number', 'asc')
        
        allOccurrences = occurrences.map((occ) => ({
          id: occ.id,
          date: occ.date instanceof DateTime ? occ.date.toISODate() : occ.date,
          startTime: occ.startTime,
          endTime: occ.endTime,
          occurrenceNumber: occ.occurrenceNumber,
        }))
      }

      // Format the response with full details
      const sessionData = {
        id: session.id,
        sessionType: session.sessionType,
        clientId: session.clientId,
        client: session.client ? {
          id: session.client.id,
          name: session.client.fullName,
          fullName: session.client.fullName,
          age: session.client.age,
          diagnosis: session.client.diagnosis,
          parentName: session.client.emergencyContactName,
          parentPhone: session.client.emergencyContactPhone,
          clinicName: session.client.clinic?.name || 'N/A',
        } : null,
        rbtId: session.rbtId,
        rbt: {
          id: session.rbt.id,
          name: session.rbt.name,
          email: session.rbt.email,
        },
        bcbaId: session.bcbaId,
        bcba: {
          id: session.bcba.id,
          name: session.bcba.name,
          email: session.bcba.email,
        },
        date: session.date instanceof DateTime ? session.date.toISODate() : session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        totalHours: session.totalHours,
        location: session.location,
        locationAddress: session.locationAddress,
        sessionNotes: session.sessionNotes,
        status: session.status,
        isRecurring: session.isRecurring,
        recurrencePattern: session.recurrencePattern,
        recurrenceDays: session.recurrenceDays,
        recurrenceEndDate: session.recurrenceEndDate instanceof DateTime ? session.recurrenceEndDate.toISODate() : session.recurrenceEndDate,
        recurrenceCount: session.recurrenceCount,
        isSeriesMaster: session.isSeriesMaster,
        occurrenceNumber: session.occurrenceNumber,
        parentSessionId: session.parentSessionId,
        allOccurrences,
        participantCount: session.sessionType !== 'one_to_one' 
          ? session.participants?.length || 0 
          : 1,
        participants: session.participants?.map((participant) => ({
          id: participant.id,
          clientId: participant.clientId,
          clientName: participant.client?.fullName || `Client ${participant.clientId}`,
          clientAge: participant.client?.age,
          parentName: participant.client?.emergencyContactName || 'N/A',
          parentPhone: participant.client?.emergencyContactPhone || 'N/A',
          clinicName: participant.client?.clinic?.name || 'N/A',
        })) || [],
      }

      return response.json(sessionData)
    } catch (error) {
      console.error('Error fetching session:', error)
      return response.status(404).json({
        message: 'Session not found',
        error: error.message,
      })
    }
  }

  /**
   * ➕ Create new session (Admin)
   */
  async createSession({ request, response }: HttpContext) {
    try {
      const payload: any = request.only([
        'clientId',
        'rbtId',
        'bcbaId',
        'date',
        'startTime',
        'endTime',
        'duration',
        'serviceType',
        'cptCode',
        'location',
        'sessionNotes',
        'status',
      ])

      // ✅ Convert date
      if (payload.date) {
        payload.date = DateTime.fromISO(payload.date)
      }

      // ✅ Calculate total hours
      if (!payload.totalHours && payload.startTime && payload.endTime) {
        const start = new Date(`2000-01-01T${payload.startTime}:00`)
        const end = new Date(`2000-01-01T${payload.endTime}:00`)
        const diffMs = end.getTime() - start.getTime()
        payload.totalHours = diffMs / (1000 * 60 * 60)
      }

      // ✅ Safe defaults
      payload.bcbaApproved = false
      payload.clinicApproved = false
      payload.rbtSignature = 'Not signed'
      payload.parentSignature = null

      const session = await SessionLog.create(payload)
      await session.load('client')
      await session.load('rbt')
      await session.load('bcba')

      return response.status(201).json({
        message: 'Session created successfully',
        data: {
          id: session.id,
          clientName: session.client?.fullName || null,
          rbtName: session.rbt?.name || null,
          bcbaName: session.bcba?.name || null,
          date: session.date instanceof DateTime ? session.date.toISODate() : session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          serviceType: session.serviceType,
          cptCode: session.cptCode,
          location: session.location,
          sessionNotes: session.sessionNotes,
          status: session.status,
          createdAt: session.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create session',
        error: error.message,
      })
    }
  }

  /**
   * 📈 System Statistics
   */
  async getStats({ response }: HttpContext) {
    try {
      const totalUsers = await User.query().count('* as total')
      const totalClients = await Client.query().count('* as total')
      const totalSessions = await SessionLog.query().count('* as total')
      const activeUsers = await User.query().where('is_active', true).count('* as total')
      const pendingSessions = await SessionLog.query().where('status', 'submitted').count('* as total')
      const sessions = await SessionLog.query().where('status', 'approved')

      const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalHours * 100), 0)

      return response.json({
        totalUsers: totalUsers[0].$extras.total,
        totalClients: totalClients[0].$extras.total,
        totalSessions: totalSessions[0].$extras.total,
        activeUsers: activeUsers[0].$extras.total,
        pendingSessions: pendingSessions[0].$extras.total,
        totalRevenue,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch system stats',
        error: error.message,
      })
    }
  }

  /**
   * 🏥 Get all clinics
   */
  async getClinics({ response }: HttpContext) {
    try {
      const clinics = await Clinic.query().orderBy('name', 'asc')

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
          npiNumber: clinic.npiNumber,
          taxId: clinic.taxId,
          isActive: clinic.isActive,
          createdAt: clinic.createdAt.toISO(),
        }))
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch clinics',
        error: error.message,
      })
    }
  }

  /**
   * 🏥 Create a new clinic
   */
  async createClinic({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'name',
        'street',
        'city',
        'state',
        'zipCode',
        'phone',
        'email',
        'npiNumber',
        'taxId',
      ])

      const clinic = await Clinic.create({
        ...data,
        isActive: true,
      })

      return response.status(201).json({
        message: 'Clinic created successfully',
        data: {
          id: clinic.id,
          name: clinic.name,
          email: clinic.email,
          createdAt: clinic.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create clinic',
        error: error.message,
      })
    }
  }

  /**
   * 🏥 Update a clinic
   */
  async updateClinic({ params, request, response }: HttpContext) {
    try {
      const clinic = await Clinic.findOrFail(params.id)
      
      const data = request.only([
        'name',
        'street',
        'city',
        'state',
        'zipCode',
        'phone',
        'email',
        'npiNumber',
        'taxId',
      ])

      clinic.merge(data)
      await clinic.save()

      return response.json({
        message: 'Clinic updated successfully',
        data: {
          id: clinic.id,
          name: clinic.name,
          email: clinic.email,
          updatedAt: clinic.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update clinic',
        error: error.message,
      })
    }
  }
}
