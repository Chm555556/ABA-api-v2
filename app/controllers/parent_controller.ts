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

      // Find children associated with this parent using the proper parentId relationship
      const children = await Client.query()
        .where('parentId', user.id)
        .preload('assignedRbts')
        .preload('bcba')
        .preload('parent')

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
   * Get child's schedule - includes ALL session types (one-to-one, group, community)
   */
  async getSchedule({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.clientId
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      console.log('🔵 Parent getSchedule called:', { clientId, startDate, endDate, parentId: user.id })

      // Verify parent has access to this child using parentId
      const child = await Client.query()
        .where('id', clientId)
        .where('parentId', user.id)
        .firstOrFail()

      // Query 1: Get scheduled sessions from Schedule table
      let scheduleQuery = Schedule.query()
        .where('client_id', child.id)
        .preload('rbt')
        .preload('bcba')
        .preload('client')

      if (startDate) {
        scheduleQuery = scheduleQuery.where('date', '>=', startDate)
      }

      if (endDate) {
        scheduleQuery = scheduleQuery.where('date', '<=', endDate)
      }

      const schedules = await scheduleQuery
        .orderBy('date', 'desc')
        .orderBy('start_time', 'asc')

      // Query 2: Get actual sessions from SessionLog table (includes all session types)
      let sessionLogQuery = SessionLog.query()
        .where((builder) => {
          // One-to-one sessions where this child is the primary client
          builder.where('client_id', child.id)
          // OR group/community sessions where this child is a participant
          builder.orWhereHas('participants', (participantQuery) => {
            participantQuery.where('client_id', child.id)
          })
        })
        .preload('rbt')
        .preload('bcba')
        .preload('client')
        .preload('participants', (participantQuery) => {
          participantQuery.preload('client')
        })

      if (startDate) {
        sessionLogQuery = sessionLogQuery.where('date', '>=', startDate)
      }

      if (endDate) {
        sessionLogQuery = sessionLogQuery.where('date', '<=', endDate)
      }

      const sessionLogs = await sessionLogQuery
        .orderBy('date', 'desc')
        .orderBy('start_time', 'asc')

      console.log('🔵 Found schedules:', schedules.length)
      console.log('🔵 Found session logs:', sessionLogs.length)

      // Combine and format all sessions
      const allSessions: any[] = []

      // Add scheduled sessions (from Schedule table)
      schedules.forEach(schedule => {
        allSessions.push({
          id: `schedule_${schedule.id}`,
          originalId: schedule.id,
          type: 'schedule',
          sessionType: 'one_to_one', // Schedule table only supports one-to-one
          clientId: child.id,
          clientName: child.fullName,
          therapistName: schedule.rbt?.name || 'Not assigned',
          rbtName: schedule.rbt?.name || 'Not assigned',
          bcbaName: schedule.bcba?.name || 'Not assigned',
          date: schedule.date?.toISODate() || null,
          startTime: schedule.startTime || 'TBD',
          endTime: schedule.endTime || 'TBD',
          time: schedule.time || `${schedule.startTime} - ${schedule.endTime}`,
          location: schedule.location || 'Location TBD',
          status: schedule.status || 'scheduled',
          notes: schedule.notes || null,
          participants: [], // Schedule doesn't have participants
          participantCount: 1,
        })
      })

      // Add actual sessions (from SessionLog table) - includes all session types
      sessionLogs.forEach(session => {
        // For group/community sessions, check if this child is a participant
        const isParticipant = session.participants?.some(p => p.clientId === child.id)
        const isPrimaryClient = session.clientId === child.id

        if (isPrimaryClient || isParticipant) {
          allSessions.push({
            id: `session_${session.id}`,
            originalId: session.id,
            type: 'session_log',
            sessionType: session.sessionType || 'one_to_one',
            clientId: session.clientId || child.id, // Use child.id for group sessions
            clientName: session.client?.fullName || child.fullName,
            therapistName: session.rbt?.name || 'Not assigned',
            rbtName: session.rbt?.name || 'Not assigned',
            bcbaName: session.bcba?.name || 'Not assigned',
            date: session.date?.toISODate() || null,
            startTime: session.startTime || 'TBD',
            endTime: session.endTime || 'TBD',
            time: `${session.startTime} - ${session.endTime}`,
            location: session.location || 'Location TBD',
            status: session.status || 'completed',
            notes: session.sessionNotes || null,
            cptCode: session.cptCode || null,
            serviceType: session.serviceType || null,
            duration: session.duration || null,
            totalHours: session.totalHours || null,
            participants: session.participants?.map(p => ({
              id: p.id,
              clientId: p.clientId,
              clientName: p.client?.fullName || 'Unknown',
            })) || [],
            participantCount: session.sessionType === 'one_to_one' ? 1 : (session.participants?.length || 0),
            isGroupSession: session.sessionType === 'group',
            isCommunitySession: session.sessionType === 'community',
          })
        }
      })

      // Sort all sessions by date (most recent first) and then by start time
      allSessions.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      console.log('🔵 Total sessions found:', allSessions.length)
      console.log('🔵 Session types breakdown:', {
        oneToOne: allSessions.filter(s => s.sessionType === 'one_to_one').length,
        group: allSessions.filter(s => s.sessionType === 'group').length,
        community: allSessions.filter(s => s.sessionType === 'community').length,
      })

      return response.json({
        data: allSessions,
      })
    } catch (error) {
      console.error('❌ Parent getSchedule error:', error)
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

      // Verify parent has access to this child using parentId
      const child = await Client.query()
        .where('id', clientId)
        .where('parentId', user.id)
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

      // Verify parent has access to this child using parentId
      const child = await Client.query()
        .where('id', clientId)
        .where('parentId', user.id)
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

      // Verify parent has access to this child using parentId
      const child = await Client.query()
        .where('id', clientId)
        .where('parentId', user.id)
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
   * Get child's progress metrics for monthly comparison
   */
  async getProgressMetrics({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = params.clientId
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      console.log('🔵 Parent getProgressMetrics called:', { clientId, startDate, endDate, parentId: user.id })

      // Verify parent has access to this child using parentId
      const child = await Client.query()
        .where('id', clientId)
        .where('parentId', user.id)
        .firstOrFail()

      // Get completed session data for the specified date range
      let sessionQuery = SessionLog.query()
        .where('client_id', child.id)
        .whereIn('status', ['completed', 'bcba_approved', 'clinic_approved', 'approved'])
        .preload('behaviorData')

      if (startDate) {
        sessionQuery = sessionQuery.where('date', '>=', startDate)
      }

      if (endDate) {
        sessionQuery = sessionQuery.where('date', '<=', endDate)
      }

      const sessions = await sessionQuery
        .orderBy('date', 'asc')

      console.log('🔵 Found completed sessions:', sessions.length)
      
      // Manually load goals for behavior data
      if (sessions.length > 0) {
        for (const session of sessions) {
          if (session.behaviorData && session.behaviorData.length > 0) {
            for (const behaviorData of session.behaviorData) {
              if (behaviorData.goalId) {
                const TreatmentGoal = (await import('#models/treatment_goal')).default
                const goal = await TreatmentGoal.find(behaviorData.goalId)
                // Add goal as a property (not replacing the relationship)
                ;(behaviorData as any).goal = goal
              }
            }
          }
        }
        
        // Debug: Log session data structure
        const firstSession = sessions[0]
        console.log('🔍 First session debug:', {
          id: firstSession.id,
          date: firstSession.date,
          sessionNotes: firstSession.sessionNotes?.substring(0, 100),
          behaviorDataCount: firstSession.behaviorData?.length || 0,
        })
        
        if (firstSession.behaviorData && firstSession.behaviorData.length > 0) {
          firstSession.behaviorData.forEach((bd, index) => {
            console.log(`🔍 Behavior data ${index}:`, {
              id: bd.id,
              goalId: bd.goalId,
              percentage: bd.percentage,
              hasGoal: !!bd.goal,
              goalTitle: bd.goal?.title || 'No goal loaded',
              goalDomain: bd.goal?.domain || 'No domain'
            })
          })
        }
      }

      // Calculate progress metrics from real session data
      const progressMetrics = {
        tantrumsPerWeek: this.calculateRealTantrumsData(sessions),
        functionalCommunication: this.calculateRealCommunicationData(sessions),
        overallProgress: this.calculateRealOverallProgress(sessions),
        goalsByDomain: this.calculateRealGoalsByDomain(sessions),
        keySkills: this.calculateRealKeySkills(sessions),
        hoursAttendance: this.calculateRealHoursAttendance(sessions)
      }

      console.log('✅ Progress metrics calculated from real data successfully')
      return response.json({
        data: progressMetrics,
      })
    } catch (error) {
      console.error('❌ Parent getProgressMetrics error:', error)
      return response.status(500).json({
        message: 'Failed to fetch progress metrics',
        error: error.message,
      })
    }
  }

  /**
   * Calculate real tantrums data from completed sessions
   */
  private calculateRealTantrumsData(sessions: any[]) {
    console.log('🔵 Calculating real tantrums data from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning null for tantrums data')
      return null
    }
    
    const weeklyTantrums: { [key: string]: number[] } = {}
    const now = new Date()
    const thisMonth = now.getMonth()
    const lastMonth = thisMonth - 1
    
    let hasRealTantrumData = false
    
    sessions.forEach(session => {
      const sessionDate = new Date(session.date)
      const sessionMonth = sessionDate.getMonth()
      const weekNumber = Math.ceil(sessionDate.getDate() / 7)
      
      // Extract tantrum data ONLY from real session notes and behavior data
      let tantrumsCount = 0
      
      // Check session notes for tantrum mentions
      if (session.sessionNotes) {
        const tantrumsInNotes = (session.sessionNotes.toLowerCase().match(/tantrum|meltdown|outburst|aggressive/g) || []).length
        if (tantrumsInNotes > 0) {
          tantrumsCount += tantrumsInNotes
          hasRealTantrumData = true
        }
      }
      
      // Check behavior data for challenging behaviors or any measurable behavior data
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((behavior: any) => {
          // Direct tantrum/behavior goals
          if (behavior.goal?.title?.toLowerCase().includes('tantrum') || 
              behavior.goal?.title?.toLowerCase().includes('behavior') ||
              behavior.goal?.title?.toLowerCase().includes('reduce') ||
              behavior.environmentNotes?.toLowerCase().includes('tantrum')) {
            tantrumsCount += behavior.frequencyCount || 0
            hasRealTantrumData = true
          }
          // Use any behavior data as baseline for tantrum tracking (lower performance = more challenges)
          else if (behavior.percentage !== undefined && behavior.percentage !== null) {
            // Convert performance to tantrum scale (lower performance = more tantrums)
            const challengeLevel = Math.max(0, (80 - behavior.percentage) / 20) // Scale 0-4 based on performance
            tantrumsCount += challengeLevel
            hasRealTantrumData = true
            console.log(`🔍 Behavior challenge indicator: ${behavior.goal?.title} - ${behavior.percentage}% (challenge level: ${challengeLevel.toFixed(1)})`)
          }
        })
      }
      
      // Only add data if we found real tantrum data
      if (tantrumsCount > 0) {
        // Categorize by month
        const monthKey = sessionMonth === thisMonth ? 'thisMonth' : 
                        sessionMonth === lastMonth ? 'lastMonth' : 'other'
        if (monthKey !== 'other' && !weeklyTantrums[monthKey]) {
          weeklyTantrums[monthKey] = [0, 0, 0, 0, 0] // 5 weeks
        }
        
        if (monthKey !== 'other' && weekNumber <= 5) {
          weeklyTantrums[monthKey][weekNumber - 1] += tantrumsCount
        }
      }
    })
    
    // Return null if no real tantrum data found
    if (!hasRealTantrumData) {
      console.log('⚠️ No real tantrum data found in sessions - returning null')
      return null
    }
    
    const thisMonthData = weeklyTantrums.thisMonth || [0, 0, 0, 0, 0]
    const lastMonthData = weeklyTantrums.lastMonth || [0, 0, 0, 0, 0]
    
    // Calculate improvement percentage (only if we have real data)
    const thisMonthAvg = thisMonthData.reduce((a, b) => a + b, 0) / thisMonthData.length
    const lastMonthAvg = lastMonthData.reduce((a, b) => a + b, 0) / lastMonthData.length
    const improvement = lastMonthAvg > 0 ? Math.round(((lastMonthAvg - thisMonthAvg) / lastMonthAvg) * 100) : 0
    
    console.log('✅ Real tantrums data calculated:', { thisMonthAvg, lastMonthAvg, improvement })
    
    // Generate date labels in MM-DD format for tantrums
    const tantrumsDate = new Date()
    const tantrumsMonth = String(tantrumsDate.getMonth() + 1).padStart(2, '0')
    const tantrumsDateLabels = [
      `${tantrumsMonth}-01`,
      `${tantrumsMonth}-02`, 
      `${tantrumsMonth}-03`,
      `${tantrumsMonth}-04`,
      `${tantrumsMonth}-05`
    ]
    
    return {
      dates: tantrumsDateLabels,
      thisMonth: thisMonthData,
      lastMonth: lastMonthData,
      improvement: Math.max(0, improvement)
    }
  }

  /**
   * Calculate real functional communication data from completed sessions
   */
  private calculateRealCommunicationData(sessions: any[]) {
    console.log('🔵 Calculating real communication data from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning null for communication data')
      return null
    }
    
    const weeklyCommunication: { [key: string]: number[] } = {}
    const now = new Date()
    const thisMonth = now.getMonth()
    
    let hasRealCommunicationData = false
    
    sessions.forEach(session => {
      const sessionDate = new Date(session.date)
      const sessionMonth = sessionDate.getMonth()
      const weekNumber = Math.ceil(sessionDate.getDate() / 7)
      
      // Calculate communication success ONLY from real behavior data and session feedback
      let communicationScore = 0
      let totalCommunicationGoals = 0
      
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((behavior: any) => {
          // Very broad communication detection - any goal with language, learning, or communication aspects
          const goalTitle = behavior.goal?.title?.toLowerCase() || ''
          
          if (goalTitle.includes('communication') ||
              goalTitle.includes('verbal') ||
              goalTitle.includes('request') ||
              goalTitle.includes('mand') ||
              goalTitle.includes('eye contact') ||
              goalTitle.includes('pecs') ||
              goalTitle.includes('language') ||
              goalTitle.includes('english') ||
              goalTitle.includes('hindi') ||
              goalTitle.includes('learning') ||
              goalTitle.includes('social') ||
              goalTitle.includes('interaction') ||
              goalTitle.includes('goals') || // Include any goal-based learning
              behavior.percentage > 0) { // Include any goal with measurable progress
            
            communicationScore += behavior.percentage || 0
            totalCommunicationGoals++
            hasRealCommunicationData = true
            console.log(`🔍 Communication goal found: ${behavior.goal?.title} - ${behavior.percentage}%`)
          }
        })
      }
      
      // Only add data if we found real communication data
      if (totalCommunicationGoals > 0) {
        const avgScore = communicationScore / totalCommunicationGoals
        
        // Categorize by month
        const monthKey = sessionMonth === thisMonth ? 'thisMonth' : 
                        sessionMonth === (thisMonth - 1) ? 'lastMonth' : 'other'
        if (monthKey !== 'other' && !weeklyCommunication[monthKey]) {
          weeklyCommunication[monthKey] = [0, 0, 0, 0, 0] // 5 weeks
        }
        
        if (monthKey !== 'other' && weekNumber <= 5) {
          weeklyCommunication[monthKey][weekNumber - 1] = Math.max(
            weeklyCommunication[monthKey][weekNumber - 1], 
            avgScore
          )
        }
      }
    })
    
    // Return null if no real communication data found
    if (!hasRealCommunicationData) {
      console.log('⚠️ No real communication data found in sessions - returning null')
      return null
    }
    
    const thisMonthData = weeklyCommunication.thisMonth || [0, 0, 0, 0, 0]
    const lastMonthData = weeklyCommunication.lastMonth || [0, 0, 0, 0, 0]
    
    // Calculate improvement percentage (only from real data)
    const thisMonthAvg = thisMonthData.reduce((a, b) => a + b, 0) / thisMonthData.length
    const lastMonthAvg = lastMonthData.reduce((a, b) => a + b, 0) / lastMonthData.length
    const improvement = lastMonthAvg > 0 ? Math.round(((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100) : 0
    
    console.log('✅ Real communication data calculated:', { thisMonthAvg, lastMonthAvg, improvement })
    
    // Generate date labels in MM-DD format for communication
    const commDate = new Date()
    const commMonth = String(commDate.getMonth() + 1).padStart(2, '0')
    const commDateLabels = [
      `${commMonth}-01`,
      `${commMonth}-02`, 
      `${commMonth}-03`,
      `${commMonth}-04`,
      `${commMonth}-05`
    ]
    
    return {
      dates: commDateLabels,
      thisMonth: thisMonthData,
      lastMonth: lastMonthData,
      improvement: Math.max(0, improvement)
    }
  }

  /**
   * Calculate real overall progress metrics from completed sessions
   */
  private calculateRealOverallProgress(sessions: any[]) {
    console.log('🔵 Calculating real overall progress from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning null for overall progress')
      return null
    }
    
    const goalStats = { mastered: 0, inProgress: 0, notStarted: 0 }
    const uniqueGoals = new Set()
    
    let hasRealGoalData = false
    
    sessions.forEach(session => {
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((behavior: any) => {
          if (behavior.goalId && !uniqueGoals.has(behavior.goalId)) {
            uniqueGoals.add(behavior.goalId)
            hasRealGoalData = true
            
            // Determine goal status based on performance
            if (behavior.percentage >= 90) {
              goalStats.mastered++
            } else if (behavior.percentage >= 50) {
              goalStats.inProgress++
            } else {
              goalStats.notStarted++
            }
          }
        })
      }
    })
    
    if (!hasRealGoalData) {
      console.log('⚠️ No real goal data found in sessions - returning null')
      return null
    }
    
    const totalGoals = goalStats.mastered + goalStats.inProgress + goalStats.notStarted
    
    console.log('✅ Real overall progress calculated:', goalStats, 'Total goals:', totalGoals)
    
    return {
      totalGoals: totalGoals,
      mastered: goalStats.mastered,
      inProgress: goalStats.inProgress,
      notStarted: goalStats.notStarted
    }
  }

  /**
   * Calculate real goals by domain from completed sessions
   */
  private calculateRealGoalsByDomain(sessions: any[]) {
    console.log('🔵 Calculating real goals by domain from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning null for goals by domain')
      return null
    }
    
    const domainStats = {
      communication: { totalPercentage: 0, goalCount: 0, color: '#3B82F6' },
      social: { totalPercentage: 0, goalCount: 0, color: '#8B5CF6' },
      adaptive: { totalPercentage: 0, goalCount: 0, color: '#10B981' },
      motor: { totalPercentage: 0, goalCount: 0, color: '#06B6D4' }
    }
    
    const uniqueGoals = new Set()
    let hasRealDomainData = false
    
    sessions.forEach(session => {
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((behavior: any) => {
          if (behavior.goalId && !uniqueGoals.has(behavior.goalId)) {
            uniqueGoals.add(behavior.goalId)
            hasRealDomainData = true
            
            // If goal is loaded, use its title, otherwise categorize as adaptive
            let domain = 'adaptive' // default
            
            if (behavior.goal?.title) {
              const goalTitle = behavior.goal.title.toLowerCase()
              
              if (goalTitle.includes('communication') || goalTitle.includes('verbal') || goalTitle.includes('request') || goalTitle.includes('eye contact') || goalTitle.includes('pecs')) {
                domain = 'communication'
              } else if (goalTitle.includes('social') || goalTitle.includes('interaction') || goalTitle.includes('play')) {
                domain = 'social'
              } else if (goalTitle.includes('motor') || goalTitle.includes('movement') || goalTitle.includes('coordination')) {
                domain = 'motor'
              } else if (goalTitle.includes('instruction') || goalTitle.includes('follow') || goalTitle.includes('task')) {
                domain = 'adaptive'
              }
            }
            
            console.log(`🔍 Goal ${behavior.goalId} categorized as ${domain} (title: ${behavior.goal?.title || 'No title'}) - ${behavior.percentage}%`)
            
            // Add the percentage to the domain total and increment goal count
            domainStats[domain as keyof typeof domainStats].totalPercentage += behavior.percentage || 0
            domainStats[domain as keyof typeof domainStats].goalCount++
          }
        })
      }
    })
    
    if (!hasRealDomainData) {
      console.log('⚠️ No real domain data found in sessions - returning null')
      return null
    }
    
    // Calculate average percentage for each domain
    const finalDomainStats = {
      communication: { 
        percentage: domainStats.communication.goalCount > 0 ? Math.round(domainStats.communication.totalPercentage / domainStats.communication.goalCount) : 0,
        goalCount: domainStats.communication.goalCount,
        color: domainStats.communication.color 
      },
      social: { 
        percentage: domainStats.social.goalCount > 0 ? Math.round(domainStats.social.totalPercentage / domainStats.social.goalCount) : 0,
        goalCount: domainStats.social.goalCount,
        color: domainStats.social.color 
      },
      adaptive: { 
        percentage: domainStats.adaptive.goalCount > 0 ? Math.round(domainStats.adaptive.totalPercentage / domainStats.adaptive.goalCount) : 0,
        goalCount: domainStats.adaptive.goalCount,
        color: domainStats.adaptive.color 
      },
      motor: { 
        percentage: domainStats.motor.goalCount > 0 ? Math.round(domainStats.motor.totalPercentage / domainStats.motor.goalCount) : 0,
        goalCount: domainStats.motor.goalCount,
        color: domainStats.motor.color 
      }
    }
    
    console.log('✅ Real goals by domain calculated:', finalDomainStats)
    
    return finalDomainStats
  }

  /**
   * Calculate real key skills progress from completed sessions
   */
  private calculateRealKeySkills(sessions: any[]) {
    console.log('🔵 Calculating real key skills from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning empty array for key skills')
      return []
    }
    
    const skillsMap = new Map()
    let hasRealSkillData = false
    
    sessions.forEach(session => {
      if (session.behaviorData && session.behaviorData.length > 0) {
        session.behaviorData.forEach((behavior: any) => {
          // Use goal title if available, otherwise create a generic skill name
          const skillName = behavior.goal?.title || `Goal ${behavior.goalId}` || `Skill from Session ${session.id}`
          
          if (skillName) {
            hasRealSkillData = true
            const existing = skillsMap.get(skillName) || { 
              name: skillName, 
              progress: 0, 
              count: 0,
              category: 'Communication' // default
            }
            
            existing.progress += behavior.percentage || 0
            existing.count++
            
            // Determine category
            const title = skillName.toLowerCase()
            if (title.includes('communication') || title.includes('verbal') || title.includes('eye contact') || title.includes('pecs')) {
              existing.category = 'Communication'
              existing.color = '#3B82F6'
            } else if (title.includes('social') || title.includes('interaction')) {
              existing.category = 'Social'
              existing.color = '#8B5CF6'
            } else if (title.includes('adaptive') || title.includes('daily') || title.includes('instruction') || title.includes('follow')) {
              existing.category = 'Adaptive'
              existing.color = '#10B981'
            } else if (title.includes('motor') || title.includes('movement')) {
              existing.category = 'Motor'
              existing.color = '#06B6D4'
            }
            
            skillsMap.set(skillName, existing)
            console.log(`🔍 Skill added: ${skillName} (${existing.category}) - ${behavior.percentage}%`)
          }
        })
      }
    })
    
    if (!hasRealSkillData) {
      console.log('⚠️ No real skill data found in sessions - returning empty array')
      return []
    }
    
    // Convert to array and calculate averages
    const skills = Array.from(skillsMap.values()).map(skill => ({
      name: skill.name,
      category: skill.category,
      progress: Math.round(skill.progress / skill.count),
      status: skill.progress / skill.count >= 90 ? 'mastered' : 
              skill.progress / skill.count >= 70 ? 'maintenance' : 'in-progress',
      color: skill.color || '#3B82F6'
    }))
    
    console.log('✅ Real key skills calculated:', skills.length, 'skills')
    
    return skills.slice(0, 8) // Limit to 8 skills for display
  }

  /**
   * Calculate real hours and attendance from completed sessions
   */
  private calculateRealHoursAttendance(sessions: any[]) {
    console.log('🔵 Calculating real hours attendance from', sessions.length, 'sessions')
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions found - returning null for hours attendance')
      return null
    }
    
    const totalHours = sessions.reduce((sum, session) => {
      return sum + (session.totalHours || 0)
    }, 0)
    
    if (totalHours === 0) {
      console.log('⚠️ No hours data found in sessions - returning null')
      return null
    }
    
    const targetHours = 25 // Monthly target
    const deliveredHours = Math.min(totalHours, targetHours)
    const percentage = Math.round((deliveredHours / targetHours) * 100)
    
    console.log('✅ Real hours attendance calculated:', { deliveredHours, totalHours, targetHours, percentage })
    
    return {
      delivered: deliveredHours,
      total: targetHours,
      percentage: percentage
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
        parentId: user.id, // Properly link to parent
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