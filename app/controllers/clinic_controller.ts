import type { HttpContext } from '@adonisjs/core/http'
import Client from '#models/client'
import User from '#models/user'
import SessionLog from '#models/session_log'
import Schedule from '#models/schedule'
import Invoice from '#models/invoice'
import TreatmentGoal from '#models/treatment_goal'
import { DateTime } from 'luxon'
// import { createClientValidator, createScheduleValidator } from '#validators/client_validator'
import {
  createClientValidator,
  createScheduleValidator,
  validateWithNormalizer,
} from '#validators/client_validator'



export default class ClinicController {
  /**
   * Get clinic dashboard data
   */
  async dashboard({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('Dashboard called for user:', user.id, 'clinic:', user.clinicId)

      // Check if user has a clinic assigned
      if (!user.clinicId) {
        console.error('User does not have a clinic assigned:', user.id, user.email)
        return response.status(400).json({
          success: false,
          message: 'Your account is not associated with a clinic. Please contact your administrator to assign you to a clinic.',
          error: 'CLINIC_NOT_ASSIGNED',
        })
      }
const clinicId = user.clinicId // Store in variable for TypeScript

      // Get total active clients for this clinic using Lucid ORM
      const totalClientsQuery = await Client.query()
        .where('clinic_id', clinicId)
        .where('status', 'active')
        .count('* as total')
      const totalClients = totalClientsQuery[0].$extras.total

      // Get active staff for this clinic using Lucid ORM
      const activeStaffQuery = await User.query()
        .where('clinic_id', clinicId)
        .where('is_active', true)
        .whereIn('role', ['BCBA', 'RBT', 'CLINIC', 'ADMIN'])
        .count('* as total')
      const activeStaff = activeStaffQuery[0].$extras.total

      // Get today's appointments using Lucid ORM with relationships
      const today = DateTime.now().toISODate()
      const todayAppointmentsQuery = await Schedule.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
        .whereRaw('DATE(date) = ?', [today])
        .count('* as total')
      const todayAppointments = todayAppointmentsQuery[0].$extras.total

      // Calculate monthly revenue from approved sessions using Lucid ORM
      const currentMonth = DateTime.now()
      const monthStart = currentMonth.startOf('month')
      const monthEnd = currentMonth.endOf('month')

      const monthlySessions = await SessionLog.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
        .where('status', 'approved')
        .whereBetween('date', [monthStart.toISODate(), monthEnd.toISODate()])

      const totalHours = monthlySessions.reduce((sum, session) => sum + session.totalHours, 0)
      const monthlyRevenue = Math.round(totalHours * 100) // $100 per hour

      // Get pending claims using Lucid ORM
      const pendingClaimsQuery = await SessionLog.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
        .where('status', 'submitted')
        .count('* as total')
      const pendingClaims = pendingClaimsQuery[0].$extras.total

      // Calculate completion rate using Lucid ORM
      const totalScheduledQuery = await Schedule.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
        .whereBetween('date', [monthStart.toISODate(), monthEnd.toISODate()])
        .count('* as total')
      const totalScheduled = totalScheduledQuery[0].$extras.total

      const completedScheduledQuery = await Schedule.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', clinicId)
        })
        .where('status', 'completed')
        .whereBetween('date', [monthStart.toISODate(), monthEnd.toISODate()])
        .count('* as total')
      const completedScheduled = completedScheduledQuery[0].$extras.total

      const completionRate = totalScheduled > 0 
        ? Math.round((completedScheduled / totalScheduled) * 100) 
        : 0

      const summary = {
        totalClients,
        activeStaff,
        todayAppointments,
        monthlyRevenue,
        pendingClaims,
        completionRate,
      }

      console.log('Dashboard summary:', summary)

      return response.json({
        success: true,
        summary,
        clinic: {
          id: clinicId,
          name: 'ABA Connect Clinic',
        },
      })
    } catch (error) {
      console.error('Dashboard error:', error)
      return response.status(500).json({
        message: 'Failed to fetch clinic dashboard',
        error: error.message,
      })
    }
  }

  /**
   * Get all clients
   */
  async getClients({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('getClients called by user:', user.id, 'clinic:', user.clinicId)
      
      // Check if user has a clinic assigned
      if (!user.clinicId) {
        console.error('User has no clinic_id:', user.id)
        return response.status(400).json({
          success: false,
          message: 'Your account is not associated with a clinic.',
          error: 'CLINIC_NOT_ASSIGNED',
        })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      console.log('Querying clients for clinic:', user.clinicId)

      let query = Client.query()
        .where('clinic_id', user.clinicId)
        .preload('bcba')
        .preload('assignedRbts')

      if (status) {
        query = query.where('status', status)
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .where('first_name', 'like', `%${search}%`)
            .orWhere('last_name', 'like', `%${search}%`)
        })
      }

      const clients = await query
        .orderBy('first_name', 'asc')
        .paginate(page, limit)

      console.log('Found', clients.all().length, 'clients')

      return response.json({
        data: clients.all().map(client => ({
          id: client.id,
          fullName: client.fullName,
          firstName: client.firstName,
          lastName: client.lastName,
          age: client.age,
          dateOfBirth: client.dateOfBirth?.toISODate() || null,
          status: client.status,
          insuranceType: client.insuranceType,
          insuranceId: client.insuranceId,
          bcbaName: client.bcba?.name || 'Not assigned',
          assignedRbts: client.assignedRbts.map(rbt => rbt.name),
          admissionDate: client.admissionDate?.toISODate() || null,
          createdAt: client.createdAt.toISO(),
        })),
        meta: clients.getMeta(),
      })
    } catch (error) {
      console.error('getClients error:', error)
      console.error('Error stack:', error.stack)
      return response.status(500).json({
        message: 'Failed to fetch clients',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }

  /**
   * Test client creation
   */
  async testClient({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('Test endpoint called by user:', user.id, 'clinic:', user.clinicId)
      
      return response.json({
        message: 'Test endpoint working',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId
        }
      })
    } catch (error) {
      console.error('Test endpoint error:', error)
      return response.status(500).json({
        message: 'Test endpoint failed',
        error: error.message
      })
    }
  }

  /**
   * Create new client
   */
  // async createClient({ auth, request, response }: HttpContext) {
  //   try {
  //     const user = auth.user!
  //     console.log('Creating client for user:', user.id, 'clinic:', user.clinicId)
      
  //     const clientData = request.only([
  //       'firstName',
  //       'lastName',
  //       'dateOfBirth',
  //       'street',
  //       'city',
  //       'state',
  //       'zipCode',
  //       'phone',
  //       'email',
  //       'emergencyContactName',
  //       'emergencyContactRelationship',
  //       'emergencyContactPhone',
  //       'insuranceType',
  //       'insuranceId',
  //       'assignedBcba',
  //       'diagnosis',
  //     ])

  //     console.log('Client data received:', clientData)

  //     const clientPayload = {
  //       firstName: clientData.firstName,
  //       lastName: clientData.lastName,
  //       dateOfBirth: new Date(clientData.dateOfBirth),
  //       street: clientData.street,
  //       city: clientData.city,
  //       state: clientData.state,
  //       zipCode: clientData.zipCode,
  //       phone: clientData.phone,
  //       email: clientData.email,
  //       emergencyContactName: clientData.emergencyContactName,
  //       emergencyContactRelationship: clientData.emergencyContactRelationship,
  //       emergencyContactPhone: clientData.emergencyContactPhone,
  //       insuranceType: clientData.insuranceType,
  //       insuranceId: clientData.insuranceId,
  //       clinicId: user.clinicId!,
  //       assignedBcba: clientData.assignedBcba || null,
  //       status: 'active',
  //       admissionDate: new Date(),
  //       diagnosis: clientData.diagnosis || [],
  //     }

  //     console.log('Client payload for creation:', clientPayload)

  //     // Temporarily use raw SQL to bypass model issues
  //     const [result] = await db.rawQuery(
  //       'INSERT INTO clients (first_name, last_name, date_of_birth, street, city, state, zip_code, phone, email, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, insurance_type, insurance_id, clinic_id, assigned_bcba, status, admission_date, diagnosis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  //       [
  //         clientPayload.firstName,
  //         clientPayload.lastName,
  //         clientPayload.dateOfBirth.toISOString().split('T')[0],
  //         clientPayload.street,
  //         clientPayload.city,
  //         clientPayload.state,
  //         clientPayload.zipCode,
  //         clientPayload.phone,
  //         clientPayload.email,
  //         clientPayload.emergencyContactName,
  //         clientPayload.emergencyContactRelationship,
  //         clientPayload.emergencyContactPhone,
  //         clientPayload.insuranceType,
  //         clientPayload.insuranceId,
  //         clientPayload.clinicId,
  //         clientPayload.assignedBcba,
  //         clientPayload.status,
  //         clientPayload.admissionDate.toISOString().split('T')[0],
  //         JSON.stringify(clientPayload.diagnosis)
  //       ]
  //     )
      
  //     const clientId = result.insertId
  //     const client = await Client.find(clientId)

  //     console.log('Client created successfully:', client.id)

  //     await client.load('bcba')

  //     return response.status(201).json({
  //       message: 'Client created successfully',
  //       data: {
  //         id: client.id,
  //         fullName: client.fullName,
  //         firstName: client.firstName,
  //         lastName: client.lastName,
  //         dateOfBirth: client.dateOfBirth.toISODate(),
  //         status: client.status,
  //         insuranceType: client.insuranceType,
  //         insuranceId: client.insuranceId,
  //         bcbaName: client.bcba?.name || 'Not assigned',
  //         admissionDate: client.admissionDate.toISODate(),
  //         createdAt: client.createdAt.toISO(),
  //       },
  //     })
  //   } catch (error) {
  //     console.error('Client creation error:', error)
  //     console.error('Error stack:', error.stack)
  //     return response.status(400).json({
  //       message: 'Failed to create client',
  //       error: error.message,
  //       details: error.code || 'Unknown error code',
  //       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  //     })
  //   }
  // }

// async createClient({ auth, request, response }: HttpContext) {
//   try {
//     const user = auth.user!
//     // const clientData = await request.validateUsing(createClientValidator)

//     const clientData = await validateWithNormalizer(request, createClientValidator)


//     const client = await Client.create({
//       ...clientData,
//       dateOfBirth: new Date(clientData.dateOfBirth),
//       clinicId: user.clinicId!,
//       status: 'active',
//       admissionDate: new Date(),
//     })

//     await client.load('bcba')

//     return response.status(201).json({
//       success: true,
//       message: 'Client created successfully',
//       data: client.serialize(),
//     })
//   } catch (error) {
//     console.error('createClient error:', error)
//     return response.status(400).json({
//       success: false,
//       message: 'Failed to create client',
//       error: error.messages || error.message,
//     })
//   }
// }


//import { DateTime } from 'luxon'

async createClient({ auth, request, response }: HttpContext) {
  try {
    const user = auth.user!
    
    console.log('🔵 createClient called by user:', user.id, 'clinic:', user.clinicId)
    console.log('🔵 Request body:', JSON.stringify(request.all(), null, 2))
    
    // Check if user has a clinic assigned
    if (!user.clinicId) {
      console.error('❌ User does not have a clinic assigned:', user.id, user.email)
      return response.status(400).json({
        success: false,
        message: 'Your account is not associated with a clinic. Please contact your administrator.',
        error: 'CLINIC_NOT_ASSIGNED',
      })
    }

    let clientData
    try {
      clientData = await validateWithNormalizer(request, createClientValidator)
      console.log('🔵 Validated client data:', JSON.stringify(clientData, null, 2))
    } catch (validationError) {
      console.error('❌ Validation error:', validationError)
      console.error('❌ Validation messages:', validationError.messages)
      return response.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationError.messages || validationError.message,
        details: validationError.messages,
      })
    }

    // Handle both string and Date values safely
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

    console.log('🔵 Creating client with clinicId:', user.clinicId)

    try {
      const client = await Client.create({
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        dateOfBirth: parsedDate,
        clinicId: user.clinicId,
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
        assignedBcba: clientData.assignedBcba || null,
        diagnosis: clientData.diagnosis || null,
      })

      console.log('🔵 Client created successfully:', client.id)

      await client.load('bcba')

      return response.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: client.serialize(),
      })
    } catch (createError) {
      console.error('❌ Client creation error:', createError)
      console.error('❌ Error message:', createError.message)
      console.error('❌ Error code:', createError.code)
      throw createError // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('❌ createClient error:', error)
    console.error('❌ Error details:', {
      message: error.message,
      messages: error.messages,
      stack: error.stack,
    })
    
    return response.status(400).json({
      success: false,
      message: 'Failed to create client',
      error: error.messages || error.message,
      details: process.env.NODE_ENV === 'development' ? error.messages : undefined,
    })
  }
}



// async createClient({ auth, request, response }: HttpContext) {
//   try {
//     const user = auth.user!
//     const clientData = await validateWithNormalizer(request, createClientValidator)

//     const client = await Client.create({
//       ...clientData,
//       dateOfBirth: DateTime.fromISO(clientData.dateOfBirth), // ✅ Luxon DateTime
//       clinicId: user.clinicId!,
//       status: 'active',
//       admissionDate: DateTime.now(), // ✅ Luxon DateTime
//     })

//     await client.load('bcba')

//     return response.status(201).json({
//       success: true,
//       message: 'Client created successfully',
//       data: client.serialize(),
//     })
//   } catch (error) {
//     console.error('createClient error:', error)
//     return response.status(400).json({
//       success: false,
//       message: 'Failed to create client',
//       error: error.messages || error.message,
//     })
//   }
// }



  /**
   * Get sessions
   */
  async getSessions({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 50)
      const status = request.input('status')
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      let query = SessionLog.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', user.clinicId!)
        })
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
        .paginate(page, limit)

      return response.json({
        data: sessions.all().map(session => ({
          id: session.id,
          clientId: session.clientId,
          clientName: session.client.fullName,
          rbtId: session.rbtId,
          rbtName: session.rbt.name,
          bcbaId: session.bcbaId,
          bcbaName: session.bcba.name,
          date: session.date?.toISODate() || null,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalHours: session.totalHours,
          cptCode: session.cptCode,
          serviceType: session.serviceType,
          status: session.status,
          notes: session.sessionNotes,
          createdAt: session.createdAt.toISO(),
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
   * Get staff members
   */
  async getStaff({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const role = request.input('role')

      let query = User.query()
        .where('clinic_id', user.clinicId!)
        .whereIn('role', ['BCBA', 'RBT'])

      if (role) {
        query = query.where('role', role)
      }

      const staff = await query
        .orderBy('name', 'asc')

      return response.json({
        data: staff.map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          hourlyRate: member.hourlyRate,
          phone: member.phone,
          isActive: member.isActive,
          verified: member.verified,
          supervisorId: member.supervisorId,
          createdAt: member.createdAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch staff',
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
      const clientId = request.input('clientId')
      const rbtId = request.input('rbtId')

      let query = Schedule.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', user.clinicId!)
        })
        .preload('client')
        .preload('rbt')
        .preload('bcba')

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
          bcbaName: schedule.bcba.name,
          date: schedule.date?.toISODate() || null,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
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

  /**
   * Update schedule
   */
  async updateSchedule({ auth, params, request, response }: HttpContext) {
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

      // Check permissions - clinic can update schedules for their clients
      if (schedule.client.clinicId !== user.clinicId) {
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
          date: schedule.date?.toISODate() || null,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          notes: schedule.notes,
          updatedAt: schedule.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      console.error('Schedule update error:', error)
      return response.status(400).json({
        message: 'Failed to update schedule',
        error: error.message,
      })
    }
  }

  /**
   * Delete schedule
   */
  async deleteSchedule({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const scheduleId = params.id

      const schedule = await Schedule.query()
        .where('id', scheduleId)
        .preload('client')
        .firstOrFail()

      // Check permissions - clinic can delete schedules for their clients
      if (schedule.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      await schedule.delete()

      return response.json({
        message: 'Schedule deleted successfully',
      })
    } catch (error) {
      console.error('Schedule delete error:', error)
      return response.status(400).json({
        message: 'Failed to delete schedule',
        error: error.message,
      })
    }
  }

  /**
   * Create schedule
   */
  // async createSchedule({ auth, request, response }: HttpContext) {
  //   try {
  //     const user = auth.user!
  //     const { clientId, rbtId, bcbaId, date, startTime, endTime, location, notes } = request.only([
  //       'clientId',
  //       'rbtId',
  //       'bcbaId',
  //       'date',
  //       'startTime',
  //       'endTime',
  //       'location',
  //       'notes',
  //     ])

  //     // Verify client belongs to this clinic
  //     const client = await Client.query()
  //       .where('id', clientId)
  //       .where('clinic_id', user.clinicId!)
  //       .firstOrFail()

  //     const schedule = await Schedule.create({
  //       clientId: client.id,
  //       rbtId,
  //       bcbaId,
  //       date: new Date(date),
  //       startTime,
  //       endTime,
  //       location,
  //       notes,
  //       status: 'scheduled',
  //     })

  //     await schedule.load('client')
  //     await schedule.load('rbt')
  //     await schedule.load('bcba')

  //     return response.status(201).json({
  //       message: 'Schedule created successfully',
  //       data: {
  //         id: schedule.id,
  //         clientName: schedule.client.fullName,
  //         rbtName: schedule.rbt.name,
  //         bcbaName: schedule.bcba.name,
  //         date: schedule.date.toISODate(),
  //         startTime: schedule.startTime,
  //         endTime: schedule.endTime,
  //         location: schedule.location,
  //         status: schedule.status,
  //         notes: schedule.notes,
  //       },
  //     })
  //   } catch (error) {
  //     return response.status(400).json({
  //       message: 'Failed to create schedule',
  //       error: error.message,
  //     })
  //   }
  // }

// async createSchedule({ auth, request, response }: HttpContext) {
//   try {
//     const user = auth.user!
//     // const payload = await request.validateUsing(createScheduleValidator)
// const payload = await validateWithNormalizer(request, createScheduleValidator)


//     const client = await Client.query()
//       .where('id', payload.clientId)
//       .where('clinic_id', user.clinicId!)
//       .firstOrFail()

//     const schedule = await Schedule.create({
//       ...payload,
//       date: new Date(payload.date),
//       status: 'scheduled',
//     })

//     await schedule.load('client')
//     await schedule.load('rbt')
//     await schedule.load('bcba')

//     return response.status(201).json({
//       success: true,
//       message: 'Schedule created successfully',
//       data: schedule.serialize(),
//     })
//   } catch (error) {
//     console.error('createSchedule error:', error)
//     return response.status(400).json({
//       success: false,
//       message: 'Failed to create schedule',
//       error: error.messages || error.message,
//     })
//   }
// }

//import { DateTime } from 'luxon'

async createSchedule({ auth, request, response }: HttpContext) {
  try {
    const user = auth.user!
    
    console.log('🔵 createSchedule called by user:', user.id, 'clinic:', user.clinicId)
    console.log('🔵 Request body:', JSON.stringify(request.all(), null, 2))
    
    // Check if user has a clinic assigned
    if (!user.clinicId) {
      console.error('❌ User has no clinic_id')
      return response.status(400).json({
        success: false,
        message: 'Your account is not associated with a clinic.',
        error: 'CLINIC_NOT_ASSIGNED',
      })
    }

    let payload
    try {
      payload = await validateWithNormalizer(request, createScheduleValidator)
      console.log('🔵 Validated payload:', JSON.stringify(payload, null, 2))
    } catch (validationError) {
      console.error('❌ Validation error:', validationError)
      console.error('❌ Validation messages:', validationError.messages)
      return response.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationError.messages || validationError.message,
      })
    }

    // Verify client exists and belongs to this clinic
    const client = await Client.query()
      .where('id', payload.clientId)
      .where('clinic_id', user.clinicId)
      .first()

    if (!client) {
      console.error('❌ Client not found or does not belong to clinic')
      return response.status(400).json({
        success: false,
        message: 'Client not found or does not belong to your clinic',
        error: 'CLIENT_NOT_FOUND',
      })
    }

    console.log('🔵 Client found:', client.id, client.fullName)

    // Parse date carefully
    let parsedDate: DateTime
    try {
      parsedDate = DateTime.fromISO(payload.date)
      if (!parsedDate.isValid) {
        throw new Error('Invalid date format')
      }
      console.log('🔵 Parsed date:', parsedDate.toISODate())
    } catch (dateError) {
      console.error('❌ Date parsing error:', dateError)
      return response.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD',
        error: 'INVALID_DATE',
      })
    }

    // Create schedule
    const schedule = await Schedule.create({
      clientId: payload.clientId,
      rbtId: payload.rbtId,
      bcbaId: payload.bcbaId,
      date: parsedDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      location: payload.location || 'clinic',
      notes: payload.notes || null,
      status: 'scheduled',
    })

    console.log('🔵 Schedule created:', schedule.id)

    await schedule.load('client')
    await schedule.load('rbt')
    await schedule.load('bcba')

    return response.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule.serialize(),
    })
  } catch (error) {
    console.error('❌ createSchedule error:', error)
    console.error('❌ Error details:', {
      message: error.message,
      messages: error.messages,
      stack: error.stack,
    })
    
    return response.status(400).json({
      success: false,
      message: 'Failed to create schedule',
      error: error.messages || error.message,
      details: process.env.NODE_ENV === 'development' ? error.messages : undefined,
    })
  }
}


  /**
   * Get billing data
   */
  async getBilling({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      let query = SessionLog.query()
        .whereHas('client', (clientQuery) => {
          clientQuery.where('clinic_id', user.clinicId!)
        })
        .where('status', 'approved')
        .preload('client')
        .preload('rbt')
        .preload('bcba')

      if (startDate) {
        query = query.where('date', '>=', startDate)
      }

      if (endDate) {
        query = query.where('date', '<=', endDate)
      }

      const sessions = await query.orderBy('date', 'desc')

      // Group sessions by client for billing
      const billingData = sessions.reduce((acc: any, session) => {
        const clientId = session.clientId
        if (!clientId) return acc
        
        if (!acc[clientId]) {
          acc[clientId] = {
            client: {
              id: session.client.id,
              fullName: session.client.fullName,
              insuranceType: session.client.insuranceType,
              insuranceId: session.client.insuranceId,
            },
            sessions: [],
            totalHours: 0,
            totalAmount: 0,
          }
        }

        acc[clientId].sessions.push({
          id: session.id,
          date: session.date?.toISODate() || null,
          duration: session.duration,
          totalHours: session.totalHours,
          cptCode: session.cptCode,
          rbtName: session.rbt.name,
          bcbaName: session.bcba.name,
          amount: session.totalHours * 100, // Mock rate
        })

        acc[clientId].totalHours += session.totalHours
        acc[clientId].totalAmount += session.totalHours * 100
        return acc
      }, {})

      return response.json({
        data: Object.values(billingData),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch billing data',
        error: error.message,
      })
    }
  }

  /**
   * Generate invoice
   */
  async generateInvoice({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { clientId, sessionIds, periodStart, periodEnd } = request.only([
        'clientId',
        'sessionIds',
        'periodStart',
        'periodEnd',
      ])

      // Verify client belongs to this clinic
      const client = await Client.query()
        .where('id', clientId)
        .where('clinic_id', user.clinicId!)
        .firstOrFail()

      // Get sessions
      const sessions = await SessionLog.query()
        .whereIn('id', sessionIds)
        .where('client_id', client.id)
        .where('status', 'approved')

      if (sessions.length === 0) {
        return response.status(400).json({
          message: 'No approved sessions found for invoice',
        })
      }

      const totalHours = sessions.reduce((sum, session) => sum + session.totalHours, 0)
      const amount = totalHours * 100 // Mock rate

      const invoice = await Invoice.create({
        clientId: client.id,
        rbtId: sessions[0].rbtId,
        bcbaId: sessions[0].bcbaId,
        clinicId: user.clinicId!,
        sessionIds: sessionIds,
        periodStart: DateTime.fromJSDate(new Date(periodStart)),
        periodEnd: DateTime.fromJSDate(new Date(periodEnd)),
        sessionCount: sessions.length,
        totalHours,
        amount,
        status: 'draft',
      })

      return response.status(201).json({
        message: 'Invoice generated successfully',
        data: {
          id: invoice.id,
          clientId: invoice.clientId,
          sessionCount: invoice.sessionCount,
          totalHours: invoice.totalHours,
          amount: invoice.amount,
          status: invoice.status,
          createdAt: invoice.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to generate invoice',
        error: error.message,
      })
    }
  }

  /**
   * Get staff performance data with real-time metrics
   */
  async getStaffPerformance({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Get all staff members for this clinic
      const staff = await User.query()
        .where('clinic_id', user.clinicId!)
        .whereIn('role', ['BCBA', 'RBT', 'CLINIC', 'ADMIN'])
        .orderBy('name', 'asc')

      // Get performance data for each staff member
      const staffWithPerformance = await Promise.all(
        staff.map(async (member) => {
          // Get sessions for this staff member (last 30 days)
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          let sessionQuery = SessionLog.query()
            .whereHas('client', (clientQuery) => {
              clientQuery.where('clinic_id', user.clinicId!)
            })
            .where('date', '>=', thirtyDaysAgo)

          if (member.role === 'RBT') {
            sessionQuery = sessionQuery.where('rbt_id', member.id)
          } else if (member.role === 'BCBA') {
            sessionQuery = sessionQuery.where('bcba_id', member.id)
          }

          const sessions = await sessionQuery

          // Calculate performance metrics
          const totalSessions = sessions.length
          const totalHours = sessions.reduce((sum, session) => sum + session.totalHours, 0)
          const approvedSessions = sessions.filter(s => s.status === 'approved').length
          const approvalRate = totalSessions > 0 ? Math.round((approvedSessions / totalSessions) * 100) : 0
          const avgSessionDuration = totalSessions > 0 ? Math.round(totalHours / totalSessions * 60) : 0

          // Get client count for this staff member using Lucid ORM
          let clientCount = 0
          if (member.role === 'RBT') {
            // Count clients assigned to this RBT using the many-to-many relationship
            const clientsQuery = await Client.query()
              .whereHas('assignedRbts', (rbtQuery) => {
                rbtQuery.where('users.id', member.id)
              })
              .where('status', 'active')
              .count('* as total')
            clientCount = clientsQuery[0].$extras.total
          } else if (member.role === 'BCBA') {
            const clients = await Client.query()
              .where('assigned_bcba', member.id)
              .where('status', 'active')
              .count('* as total')
            clientCount = clients[0].$extras.total
          }

          return {
            id: member.id,
            name: member.name,
            email: member.email,
            phone: member.phone,
            role: member.role,
            status: member.isActive ? 'active' : 'inactive',
            hourlyRate: member.hourlyRate,
            hireDate: member.createdAt?.toISODate() || null,
            supervisorId: member.supervisorId,
            clinicId: member.clinicId,
            permissions: member.permissions || [],
            performance: {
              totalSessions,
              totalHours: Math.round(totalHours * 100) / 100,
              approvedSessions,
              approvalRate,
              avgSessionDuration,
              clientCount,
              lastActive: sessions.length > 0 ? sessions[0].date?.toISODate() || null : member.updatedAt?.toISODate() || member.createdAt?.toISODate() || null,
            },
          }
        })
      )

      return response.json({
        data: staffWithPerformance,
      })
    } catch (error) {
      console.error('Staff performance error:', error)
      return response.status(500).json({
        message: 'Failed to fetch staff performance data',
        error: error.message,
      })
    }
  }

  /**
   * Get all staff members for the clinic
   */
  async getAllStaff({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('Getting all staff for clinic:', user.clinicId)

      // Check if user has a clinic assigned
      if (!user.clinicId) {
        return response.status(400).json({
          success: false,
          message: 'Your account is not associated with a clinic.',
          error: 'CLINIC_NOT_ASSIGNED',
        })
      }

      // Get all staff members for this clinic
      const staff = await User.query()
        .where('clinic_id', user.clinicId)
        .whereIn('role', ['RBT', 'BCBA', 'CLINIC', 'ADMIN'])
        .orderBy('name', 'asc')

      const staffData = staff.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        isActive: member.isActive,
        hourlyRate: member.hourlyRate,
        createdAt: member.createdAt.toISO(),
        updatedAt: member.updatedAt?.toISO(),
      }))

      console.log(`Found ${staffData.length} staff members`)

      return response.json({
        success: true,
        data: staffData,
      })
    } catch (error) {
      console.error('Get all staff error:', error)
      return response.status(500).json({
        message: 'Failed to fetch staff members',
        error: error.message,
      })
    }
  }

  /**
   * Create new staff member
   */
  async createStaff({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // Check if user has a clinic assigned
      if (!user.clinicId) {
        return response.status(400).json({
          success: false,
          message: 'Your account is not associated with a clinic.',
          error: 'CLINIC_NOT_ASSIGNED',
        })
      }

      const staffData = request.only([
        'name',
        'email',
        'phone',
        'role',
        'hourlyRate',
        'isActive',
      ])

      console.log('Creating staff member:', staffData)

      // Generate default password based on name
      const defaultPassword = staffData.name.toLowerCase().replace(/\s+/g, '') + '123'

      // Create user with default password
      const newStaff = await User.create({
        name: staffData.name,
        email: staffData.email,
        password: defaultPassword, // Should be changed on first login
        role: staffData.role,
        clinicId: user.clinicId,
        phone: staffData.phone || null,
        hourlyRate: staffData.hourlyRate || null,
        isActive: staffData.isActive !== undefined ? staffData.isActive : true,
        verified: false,
      })

      console.log('Staff member created:', newStaff.id)

      return response.status(201).json({
        message: 'Staff member created successfully',
        data: {
          id: newStaff.id,
          name: newStaff.name,
          email: newStaff.email,
          phone: newStaff.phone,
          role: newStaff.role,
          isActive: newStaff.isActive,
          hourlyRate: newStaff.hourlyRate,
          createdAt: newStaff.createdAt.toISO(),
        },
      })
    } catch (error) {
      console.error('Create staff error:', error)
      return response.status(400).json({
        message: 'Failed to create staff member',
        error: error.message,
      })
    }
  }

  /**
   * Update staff member
   */
  async updateStaff({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const staffId = params.id
      const updates = request.only([
        'name',
        'email',
        'phone',
        'role',
        'hourlyRate',
        'isActive',
      ])

      console.log('Updating staff member:', staffId, updates)

      const staff = await User.query()
        .where('id', staffId)
        .where('clinic_id', user.clinicId!)
        .firstOrFail()

      // Update the staff member
      staff.merge(updates)
      await staff.save()

      console.log('Staff member updated successfully')

      return response.json({
        message: 'Staff member updated successfully',
        data: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          isActive: staff.isActive,
          hourlyRate: staff.hourlyRate,
          updatedAt: staff.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      console.error('Update staff error:', error)
      return response.status(400).json({
        message: 'Failed to update staff member',
        error: error.message,
      })
    }
  }

  /**
   * Get detailed patient information including parents and documents
   */
  async getPatientsDetailed({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Get all clients with detailed information
      const clients = await Client.query()
        .where('clinic_id', user.clinicId!)
        .preload('bcba')
        .orderBy('first_name', 'asc')

      // Get additional data for each client
      const patientsWithDetails = await Promise.all(
        clients.map(async (client) => {
          // Get treatment goals using Lucid ORM
          const treatmentGoals = await TreatmentGoal.query()
            .where('client_id', client.id)
            .orderBy('created_at', 'desc')

          // Get sessions
          const sessions = await SessionLog.query()
            .where('client_id', client.id)
            .preload('rbt')
            .orderBy('date', 'desc')
            .limit(20)

          // Mock parent data (in real app, this would come from a parents table)
          const parents = [
            {
              id: `parent_${client.id}_1`,
              name: client.emergencyContactName,
              email: `${client.firstName.toLowerCase()}.parent@email.com`,
              phone: client.emergencyContactPhone,
              relationship: client.emergencyContactRelationship?.toLowerCase() || 'parent',
              isActive: true,
              lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ]

          // Mock documents (in real app, this would come from a documents table)
          const documents = [
            {
              id: `doc_${client.id}_1`,
              name: `${client.firstName}_Assessment_Report.pdf`,
              type: 'assessment',
              uploadDate: client.createdAt.toISO(),
              uploadedBy: client.bcba?.name || 'System',
              fileSize: 1024 * 1024 * 2.5, // 2.5MB
              fileType: 'application/pdf',
              url: `/documents/${client.id}/assessment.pdf`,
            },
            {
              id: `doc_${client.id}_2`,
              name: `${client.firstName}_Insurance_Card.jpg`,
              type: 'insurance',
              uploadDate: client.createdAt.toISO(),
              uploadedBy: 'Parent Portal',
              fileSize: 1024 * 512, // 512KB
              fileType: 'image/jpeg',
              url: `/documents/${client.id}/insurance.jpg`,
            },
          ]

          // Mock reports
          const reports = [
            {
              id: `report_${client.id}_1`,
              title: `Monthly Progress Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              type: 'progress',
              date: new Date().toISOString(),
              createdBy: client.bcba?.name || 'BCBA',
              status: 'completed',
              summary: `Progress report showing improvements in target behaviors and goal achievement for ${client.firstName}.`,
            },
          ]

          return {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            dateOfBirth: client.dateOfBirth?.toISODate() || null,
            age: client.age,
            diagnosis: Array.isArray(client.diagnosis) ? client.diagnosis : [client.diagnosis].filter(Boolean),
            status: client.status,
            admissionDate: client.admissionDate?.toISODate() || null,
            assignedBCBA: client.assignedBcba?.toString() || '',
            bcbaName: client.bcba?.name || 'Not assigned',
            insuranceType: client.insuranceType,
            insuranceId: client.insuranceId,
            address: {
              street: client.street,
              city: client.city,
              state: client.state,
              zipCode: client.zipCode,
            },
            emergencyContact: {
              name: client.emergencyContactName,
              relationship: client.emergencyContactRelationship,
              phone: client.emergencyContactPhone,
            },
            parents,
            documents,
            reports,
            treatmentGoals: treatmentGoals.map((goal) => ({
              id: goal.id,
              title: goal.title || goal.description?.substring(0, 50) + '...' || 'Treatment Goal',
              description: goal.description || '',
              status: goal.status || 'active',
              targetBehavior: goal.targetBehavior || '',
              measurementMethod: goal.measurementType || '',
              targetCriteria: goal.masteryCriteria || '',
              progress: Math.floor(Math.random() * 100), // Mock progress
            })),
            sessions: sessions.map(session => ({
              id: session.id,
              date: session.date?.toISODate() || null,
              duration: session.duration,
              rbtName: session.rbt?.name || 'Unknown',
              status: session.status,
              notes: session.sessionNotes,
            })),
          }
        })
      )

      return response.json({
        data: patientsWithDetails,
      })
    } catch (error) {
      console.error('Patients detailed error:', error)
      return response.status(500).json({
        message: 'Failed to fetch detailed patient data',
        error: error.message,
      })
    }
  }

  /**
   * Download document
   */
  async downloadDocument({ response }: HttpContext) {
    try {
      // const user = auth.user!
      // const documentId = params.id

      // In a real app, you would:
      // 1. Verify the document exists and belongs to a client in this clinic
      // 2. Get the actual file from storage (S3, local filesystem, etc.)
      // 3. Return the file with proper headers

      // For now, return a mock response
      return response.status(404).json({
        message: 'Document not found or access denied',
      })
    } catch (error) {
      console.error('Download document error:', error)
      return response.status(500).json({
        message: 'Failed to download document',
        error: error.message,
      })
    }
  }

  /**
   * Get reports
   */
  async getReports({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const reportType = request.input('type', 'summary')
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      const dateFilter = {
        start: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: endDate ? new Date(endDate) : new Date(),
      }

      if (reportType === 'summary') {
        // Summary report
        const totalClients = await Client.query()
          .where('clinic_id', user.clinicId!)
          .count('* as total')

        const activeClients = await Client.query()
          .where('clinic_id', user.clinicId!)
          .where('status', 'active')
          .count('* as total')

        const totalSessions = await SessionLog.query()
          .whereHas('client', (clientQuery) => {
            clientQuery.where('clinic_id', user.clinicId!)
          })
          .whereBetween('date', [dateFilter.start, dateFilter.end])
          .count('* as total')

        const approvedSessions = await SessionLog.query()
          .whereHas('client', (clientQuery) => {
            clientQuery.where('clinic_id', user.clinicId!)
          })
          .whereBetween('date', [dateFilter.start, dateFilter.end])
          .where('status', 'approved')
          .count('* as total')

        const totalRevenue = await SessionLog.query()
          .whereHas('client', (clientQuery) => {
            clientQuery.where('clinic_id', user.clinicId!)
          })
          .whereBetween('date', [dateFilter.start, dateFilter.end])
          .where('status', 'approved')

        const revenue = totalRevenue.reduce((sum, session) => sum + (session.totalHours * 100), 0)

        return response.json({
          type: 'summary',
          period: {
            start: dateFilter.start.toISOString().split('T')[0],
            end: dateFilter.end.toISOString().split('T')[0],
          },
          data: {
            totalClients: totalClients[0].$extras.total,
            activeClients: activeClients[0].$extras.total,
            totalSessions: totalSessions[0].$extras.total,
            approvedSessions: approvedSessions[0].$extras.total,
            approvalRate: totalSessions[0].$extras.total > 0
              ? Math.round((approvedSessions[0].$extras.total / totalSessions[0].$extras.total) * 100)
              : 0,
            totalRevenue: revenue,
          },
        })
      }

      return response.status(400).json({
        message: 'Invalid report type',
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to generate report',
        error: error.message,
      })
    }
  }

  /**
   * Get all clinics
   */
  async getClinics({ response }: HttpContext) {
    try {
      const Clinic = (await import('#models/clinic')).default
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
        })),
      })
    } catch (error: any) {
      return response.status(500).json({
        message: 'Failed to fetch clinics',
        error: error.message,
      })
    }
  }
}