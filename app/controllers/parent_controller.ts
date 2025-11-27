import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import Schedule from '#models/schedule'
import Message from '#models/message'
import ProgressReport from '#models/progress_report'
import ClientDocument from '#models/client_document'

export default class ParentController {
  /**
   * Get parent dashboard data
   */
  async dashboard({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('🔵 Parent dashboard called for user:', user.id, user.email, user.role)

      // Find children associated with this parent (assuming parent email matches client email or similar logic)
      const children = await Client.query()
        .where('email', user.email)
        .orWhere((builder) => {
          // You might need to implement a proper parent-child relationship
          // For now, we'll use a simple email match or create a parent_clients table
          builder.where('emergency_contact_name', 'like', `%${user.name}%`)
        })
        .preload('assignedRbts')
        .preload('bcba')

      console.log('🔵 Found children:', children.length)

      // Get upcoming appointments (only if children exist)
      const upcomingAppointments = children.length > 0 
        ? await Schedule.query()
            .whereIn('client_id', children.map(child => child.id))
            .where('date', '>=', new Date())
            .where('status', 'scheduled')
            .preload('client')
            .preload('rbt')
            .orderBy('date', 'asc')
            .orderBy('start_time', 'asc')
            .limit(10)
        : []

      console.log('🔵 Found appointments:', upcomingAppointments.length)

      // Get unread messages
      const unreadMessages = await Message.query()
        .where('to_user_id', user.id)
        .where('is_read', false)
        .preload('fromUser')
        .orderBy('created_at', 'desc')
        .limit(10)

      console.log('🔵 Found unread messages:', unreadMessages.length)

      // Get recent sessions for children (only if children exist)
      const recentSessions = children.length > 0
        ? await SessionLog.query()
            .whereIn('client_id', children.map(child => child.id))
            .where('status', 'approved')
            .preload('client')
            .preload('rbt')
            .orderBy('date', 'desc')
            .limit(10)
        : []

      console.log('🔵 Found recent sessions:', recentSessions.length)

      // Calculate summary statistics
      const totalSessionsResult = children.length > 0
        ? await SessionLog.query()
            .whereIn('client_id', children.map(child => child.id))
            .where('status', 'approved')
            .count('* as total')
        : [{ $extras: { total: 0 } }]

      const totalSessions = totalSessionsResult[0].$extras.total

      const dashboardData = {
        children: children.map(child => ({
          id: child.id,
          fullName: child.fullName,
          firstName: child.firstName,
          lastName: child.lastName,
          age: child.age,
          status: child.status,
          assignedBcba: child.bcba?.name || 'Not assigned',
          assignedRbts: child.assignedRbts.map(rbt => rbt.name),
          recentSessions: recentSessions.filter(session => session.clientId === child.id).slice(0, 3),
        })),
        upcomingAppointments: upcomingAppointments.map(appointment => ({
          id: appointment.id,
          clientName: appointment.client.fullName,
          therapistName: appointment.rbt.name,
          date: appointment.date?.toISODate() || null,
          time: appointment.time,
          location: appointment.location,
          status: appointment.status,
        })),
        unreadMessages: unreadMessages.map(message => ({
          id: message.id,
          senderName: message.fromUser.name,
          subject: message.subject,
          content: message.content.substring(0, 100) + '...',
          priority: message.priority,
          createdAt: message.createdAt.toISO(),
        })),
        summary: {
          totalChildren: children.length,
          totalSessions: totalSessions,
          upcomingAppointments: upcomingAppointments.length,
          unreadMessages: unreadMessages.length,
        },
      }

      console.log('✅ Parent dashboard data prepared successfully')
      return response.json(dashboardData)
    } catch (error) {
      console.error('❌ Parent dashboard error:', error)
      console.error('❌ Error stack:', error.stack)
      return response.status(500).json({
        message: 'Failed to fetch parent dashboard',
        error: error.message,
      })
    }
  }

  /**
   * Get child's schedule
   */
  async getSchedule({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.clientId
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      // Verify parent has access to this child
      const child = await Client.query()
        .where('id', clientId)
        .where((builder) => {
          builder
            .where('email', user.email)
            .orWhere('emergency_contact_name', 'like', `%${user.name}%`)
        })
        .firstOrFail()

      let query = Schedule.query()
        .where('client_id', child.id)
        .preload('rbt')
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
          clientName: child.fullName,
          therapistName: schedule.rbt.name,
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

  /**
   * Get child's progress reports
   */
  async getProgressReports({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.clientId

      // Verify parent has access to this child
      const child = await Client.query()
        .where('id', clientId)
        .where((builder) => {
          builder
            .where('email', user.email)
            .orWhere('emergency_contact_name', 'like', `%${user.name}%`)
        })
        .firstOrFail()

      const reports = await ProgressReport.query()
        .where('client_id', child.id)
        .preload('generator')
        .orderBy('created_at', 'desc')

      return response.json({
        data: reports.map(report => ({
          id: report.id,
          clientName: child.fullName,
          generatedBy: report.generator.name,
          reportPeriod: report.reportPeriod,
          overallSummary: report.overallSummary,
          recommendations: report.recommendations,
          goals: [], // TODO: Implement goals relationship
          graphData: report.graphData,
          createdAt: report.createdAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch progress reports',
        error: error.message,
      })
    }
  }

  /**
   * Get messages
   */
  async getMessages({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const messages = await Message.query()
        .where((builder) => {
          builder
            .where('from_user_id', user.id)
            .orWhere('to_user_id', user.id)
        })
        .preload('fromUser')
        .preload('toUser')
        .preload('client')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.json({
        data: messages.all().map(message => ({
          id: message.id,
          fromUserId: message.fromUserId,
          fromUserName: message.fromUser.name,
          fromUserRole: message.fromUser.role,
          toUserId: message.toUserId,
          toUserName: message.toUser.name,
          toUserRole: message.toUser.role,
          clientId: message.clientId,
          clientName: message.client?.fullName,
          subject: message.subject,
          content: message.content,
          isRead: message.isRead,
          priority: message.priority,
          createdAt: message.createdAt.toISO(),
        })),
        meta: messages.getMeta(),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch messages',
        error: error.message,
      })
    }
  }

  /**
   * Send a message
   */
  async sendMessage({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { toUserId, clientId, subject, content, priority } = request.only([
        'toUserId',
        'clientId',
        'subject',
        'content',
        'priority',
      ])

      const message = await Message.create({
        fromUserId: user.id,
        toUserId,
        clientId,
        subject,
        content,
        priority: priority || 'normal',
        isRead: false,
      })

      await message.load('toUser')
      await message.load('client')

      return response.status(201).json({
        message: 'Message sent successfully',
        data: {
          id: message.id,
          fromUserId: message.fromUserId,
          fromUserName: user.name,
          fromUserRole: user.role,
          toUserId: message.toUserId,
          toUserName: message.toUser.name,
          toUserRole: message.toUser.role,
          clientId: message.clientId,
          clientName: message.client?.fullName,
          subject: message.subject,
          content: message.content,
          isRead: message.isRead,
          priority: message.priority,
          createdAt: message.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to send message',
        error: error.message,
      })
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const messageId = params.id

      const message = await Message.query()
        .where('id', messageId)
        .where('to_user_id', user.id)
        .firstOrFail()

      message.isRead = true
      await message.save()

      return response.json({
        message: 'Message marked as read',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to mark message as read',
        error: error.message,
      })
    }
  }

  /**
   * Get child's documents
   */
  async getDocuments({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.clientId

      // Verify parent has access to this child
      const child = await Client.query()
        .where('id', clientId)
        .where((builder) => {
          builder
            .where('email', user.email)
            .orWhere('emergency_contact_name', 'like', `%${user.name}%`)
        })
        .firstOrFail()

      const documents = await ClientDocument.query()
        .where('client_id', child.id)
        .preload('uploader')
        .orderBy('uploaded_at', 'desc')

      return response.json({
        data: documents.map(document => ({
          id: document.id,
          clientName: child.fullName,
          name: document.name,
          type: document.type,
          url: document.url,
          uploadedBy: document.uploader.name,
          uploadedAt: document.uploadedAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch documents',
        error: error.message,
      })
    }
  }

  /**
   * Upload a document for a child
   */
  async uploadDocument({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      console.log('🔵 Upload document called by user:', user.id, user.email, user.role)
      
      const {
        clientId,
        name,
        type,
        fileContent,
        fileType,
      } = request.only(['clientId', 'name', 'type', 'fileContent', 'fileType'])

      console.log('🔵 Upload request data:', { clientId, name, type, fileType, hasFileContent: !!fileContent })

      // Validate required fields
      if (!clientId) {
        return response.status(400).json({
          message: 'Client ID is required',
          error: 'Missing clientId field',
        })
      }

      if (!name) {
        return response.status(400).json({
          message: 'Document name is required',
          error: 'Missing name field',
        })
      }

      if (!type) {
        return response.status(400).json({
          message: 'Document type is required',
          error: 'Missing type field',
        })
      }

      if (!fileContent) {
        return response.status(400).json({
          message: 'File content is required',
          error: 'Missing fileContent field',
        })
      }

      // Verify parent has access to this child
      const child = await Client.query()
        .where('id', clientId)
        .where((builder) => {
          builder
            .where('email', user.email)
            .orWhere('emergency_contact_name', 'like', `%${user.name}%`)
        })
        .first()

      if (!child) {
        console.log('❌ Parent does not have access to client:', clientId)
        return response.status(403).json({
          message: 'You do not have access to this child',
          error: 'Access denied',
        })
      }

      console.log('✅ Parent has access to child:', child.id, child.fullName)

      // Create the document record
      const document = await ClientDocument.create({
        clientId: child.id,
        name,
        type,
        url: fileContent || '', // Store base64 content as URL for now
        uploadedBy: user.id,
        uploadedAt: DateTime.now(),
      })

      await document.load('uploader')

      console.log('✅ Document created successfully:', document.id)

      return response.status(201).json({
        message: 'Document uploaded successfully',
        data: {
          id: document.id,
          clientId: document.clientId,
          clientName: child.fullName,
          name: document.name,
          type: document.type,
          url: document.url,
          uploadedBy: document.uploader.name,
          uploadedAt: document.uploadedAt.toISO(),
        },
      })
    } catch (error) {
      console.error('❌ Error uploading document:', error)
      console.error('❌ Error stack:', error.stack)
      return response.status(400).json({
        message: 'Failed to upload document',
        error: error.message,
      })
    }
  }

  /**
   * Add a new child (client) for the parent
   */
  async addChild({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      
      const {
        firstName,
        lastName,
        dateOfBirth,
        diagnosis,
        insuranceType,
        insuranceId,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
      } = request.only([
        'firstName',
        'lastName',
        'dateOfBirth',
        'diagnosis',
        'insuranceType',
        'insuranceId',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyContactRelationship',
      ])

      // Map frontend insurance type to backend enum
      let mappedInsuranceType: 'insurance' | 'private' | 'regional' = 'private'
      if (insuranceType === 'Medicaid' || insuranceType === 'Medicare') {
        mappedInsuranceType = 'insurance'
      } else if (insuranceType === 'Private' || insuranceType === 'Self-Pay') {
        mappedInsuranceType = 'private'
      } else if (insuranceType === 'Regional') {
        mappedInsuranceType = 'regional'
      }

      // Create the child/client
      const child = await Client.create({
        firstName,
        lastName,
        dateOfBirth,
        email: user.email, // Link to parent's email
        phone: emergencyContactPhone || '0000000000',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        diagnosis: diagnosis ? [diagnosis] : [],
        insuranceType: mappedInsuranceType,
        insuranceId: insuranceId || 'PENDING',
        clinicId: 1, // Default clinic - you may want to make this dynamic
        assignedBcba: null,
        admissionDate: DateTime.now(),
        emergencyContactName: emergencyContactName || user.name,
        emergencyContactPhone: emergencyContactPhone || '',
        emergencyContactRelationship: emergencyContactRelationship || 'Parent',
        status: 'active',
      })

      console.log('✅ Child added successfully:', child.id, child.fullName)

      return response.status(201).json({
        message: 'Child added successfully',
        data: {
          id: child.id,
          fullName: child.fullName,
          firstName: child.firstName,
          lastName: child.lastName,
          age: child.age,
          status: child.status,
        },
      })
    } catch (error) {
      console.error('❌ Error adding child:', error)
      return response.status(400).json({
        message: 'Failed to add child',
        error: error.message,
      })
    }
  }
}