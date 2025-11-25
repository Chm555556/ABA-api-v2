import { DateTime } from 'luxon'
import SessionLog from '#models/session_log'

interface RecurrenceConfig {
  pattern: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'none'
  days?: number[] // For weekly: [1,3,5] = Mon, Wed, Fri (0=Sun, 6=Sat)
  interval?: number // For custom intervals
  endDate?: string | null
  count?: number | null
}

interface SessionData {
  clientId?: number | null
  clientIds?: number[]
  rbtId: number
  bcbaId: number
  date: string
  startTime: string
  endTime: string
  duration: number
  totalHours: number
  cptCode: string
  serviceType: string
  location: 'clinic' | 'home' | 'school' | 'community'
  locationAddress?: string | null
  sessionType: 'one_to_one' | 'group' | 'community'
  sessionNotes?: string | null
  status?: string
}

export default class RecurringSessionService {
  /**
   * Create recurring sessions based on recurrence pattern
   */
  static async createRecurringSessions(
    sessionData: SessionData,
    recurrence: RecurrenceConfig
  ): Promise<SessionLog[]> {
    const sessions: SessionLog[] = []

    // If no recurrence, create single session
    if (recurrence.pattern === 'none' || !recurrence.pattern) {
      const session = await this.createSingleSession(sessionData, false)
      return [session]
    }

    // Generate occurrence dates
    const occurrenceDates = this.generateOccurrenceDates(
      sessionData.date,
      recurrence
    )

    console.log(`📅 Generating ${occurrenceDates.length} recurring sessions`)

    // Create master session (first occurrence)
    const masterSession = await this.createSingleSession(sessionData, true, {
      isSeriesMaster: true,
      occurrenceNumber: 1,
      recurrencePattern: recurrence.pattern,
      recurrenceDays: recurrence.days || null,
      recurrenceInterval: recurrence.interval || 1,
      recurrenceEndDate: recurrence.endDate
        ? DateTime.fromISO(recurrence.endDate)
        : null,
      recurrenceCount: recurrence.count || null,
    })

    sessions.push(masterSession)

    // Create child sessions for remaining occurrences
    for (let i = 1; i < occurrenceDates.length; i++) {
      const occurrenceDate = occurrenceDates[i]
      const childSessionData = {
        ...sessionData,
        date: occurrenceDate,
        sessionNotes: null, // Notes are unique per occurrence
      }

      const childSession = await this.createSingleSession(childSessionData, true, {
        parentSessionId: masterSession.id,
        occurrenceNumber: i + 1,
        recurrencePattern: recurrence.pattern,
        recurrenceDays: recurrence.days || null,
        recurrenceInterval: recurrence.interval || 1,
      })

      sessions.push(childSession)
    }

    return sessions
  }

  /**
   * Create a single session
   */
  private static async createSingleSession(
    sessionData: SessionData,
    isRecurring: boolean = false,
    recurrenceData?: any
  ): Promise<SessionLog> {
    const session = await SessionLog.create({
      clientId: sessionData.clientId || null,
      sessionType: sessionData.sessionType,
      rbtId: sessionData.rbtId,
      bcbaId: sessionData.bcbaId,
      date: DateTime.fromISO(sessionData.date),
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      duration: sessionData.duration,
      totalHours: sessionData.totalHours,
      cptCode: sessionData.cptCode,
      serviceType: sessionData.serviceType,
      location: sessionData.location,
      locationAddress: sessionData.locationAddress || null,
      sessionNotes: sessionData.sessionNotes || null,
      status: sessionData.status || 'draft',
      rbtSignature: 'Pending',
      parentSignature: null,
      bcbaApproved: false,
      clinicApproved: false,
      isRecurring,
      ...recurrenceData,
    })

    // Handle participants for group/community sessions
    if (
      sessionData.sessionType !== 'one_to_one' &&
      sessionData.clientIds &&
      sessionData.clientIds.length > 0
    ) {
      const SessionParticipant = (await import('#models/session_participant')).default
      
      for (const clientId of sessionData.clientIds) {
        await SessionParticipant.create({
          sessionLogId: session.id,
          clientId: clientId,
        })
      }
    }

    return session
  }

  /**
   * Generate occurrence dates based on recurrence pattern
   */
  private static generateOccurrenceDates(
    startDate: string,
    recurrence: RecurrenceConfig
  ): string[] {
    const dates: string[] = []
    let currentDate = DateTime.fromISO(startDate)
    const endDate = recurrence.endDate
      ? DateTime.fromISO(recurrence.endDate)
      : null
    const maxOccurrences = recurrence.count || 52 // Default max 52 occurrences (1 year weekly)

    dates.push(currentDate.toISODate()!)

    let occurrenceCount = 1

    while (occurrenceCount < maxOccurrences) {
      // Calculate next occurrence based on pattern
      switch (recurrence.pattern) {
        case 'daily':
          currentDate = currentDate.plus({ days: recurrence.interval || 1 })
          break

        case 'weekly':
        case 'biweekly':
          currentDate = this.getNextWeeklyOccurrence(
            currentDate,
            recurrence.days || [],
            recurrence.interval || (recurrence.pattern === 'biweekly' ? 2 : 1)
          )
          break

        case 'monthly':
          currentDate = currentDate.plus({ months: recurrence.interval || 1 })
          break

        default:
          return dates
      }

      // Check if we've exceeded the end date
      if (endDate && currentDate > endDate) {
        break
      }

      dates.push(currentDate.toISODate()!)
      occurrenceCount++
    }

    return dates
  }

  /**
   * Get next weekly occurrence based on selected days
   */
  private static getNextWeeklyOccurrence(
    currentDate: DateTime,
    selectedDays: number[],
    weekInterval: number
  ): DateTime {
    if (selectedDays.length === 0) {
      // If no specific days selected, just add weeks
      return currentDate.plus({ weeks: weekInterval })
    }

    // Sort selected days
    const sortedDays = [...selectedDays].sort((a, b) => a - b)
    const currentDayOfWeek = currentDate.weekday % 7 // Convert to 0-6 (Sun-Sat)

    // Find next day in current week
    const nextDayInWeek = sortedDays.find((day) => day > currentDayOfWeek)

    if (nextDayInWeek !== undefined) {
      // Next occurrence is in the same week
      const daysToAdd = nextDayInWeek - currentDayOfWeek
      return currentDate.plus({ days: daysToAdd })
    } else {
      // Next occurrence is in the next interval week
      const daysUntilNextWeek = 7 - currentDayOfWeek + sortedDays[0]
      const weeksToAdd = weekInterval - 1
      return currentDate.plus({
        days: daysUntilNextWeek,
        weeks: weeksToAdd,
      })
    }
  }

  /**
   * Update a single occurrence in a recurring series
   */
  static async updateSingleOccurrence(
    sessionId: number,
    updates: Partial<SessionData>
  ): Promise<SessionLog> {
    const session = await SessionLog.findOrFail(sessionId)

    // Update only the specified fields
    session.merge({
      date: updates.date ? DateTime.fromISO(updates.date) : session.date,
      startTime: updates.startTime || session.startTime,
      endTime: updates.endTime || session.endTime,
      duration: updates.duration || session.duration,
      totalHours: updates.totalHours || session.totalHours,
      location: updates.location || session.location,
      sessionNotes: updates.sessionNotes !== undefined ? updates.sessionNotes : session.sessionNotes,
    })

    await session.save()
    return session
  }

  /**
   * Delete a single occurrence from a recurring series
   */
  static async deleteSingleOccurrence(sessionId: number): Promise<void> {
    const session = await SessionLog.findOrFail(sessionId)

    // If it's the master session, we need to handle it differently
    if (session.isSeriesMaster) {
      // Promote the next occurrence to master
      const nextOccurrence = await SessionLog.query()
        .where('parent_session_id', session.id)
        .orderBy('occurrence_number', 'asc')
        .first()

      if (nextOccurrence) {
        nextOccurrence.isSeriesMaster = true
        nextOccurrence.parentSessionId = null
        await nextOccurrence.save()

        // Update other occurrences to point to new master
        await SessionLog.query()
          .where('parent_session_id', session.id)
          .whereNot('id', nextOccurrence.id)
          .update({ parent_session_id: nextOccurrence.id })
      }
    }

    await session.delete()
  }

  /**
   * Delete entire recurring series
   */
  static async deleteRecurringSeries(masterSessionId: number): Promise<void> {
    const masterSession = await SessionLog.findOrFail(masterSessionId)

    if (!masterSession.isSeriesMaster) {
      throw new Error('Session is not a series master')
    }

    // Delete all child sessions
    await SessionLog.query()
      .where('parent_session_id', masterSessionId)
      .delete()

    // Delete master session
    await masterSession.delete()
  }
}
