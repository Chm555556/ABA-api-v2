import SessionLog from '#models/session_log'
import { DateTime } from 'luxon'

/**
 * SessionOverlapService
 * 
 * This service checks if an RBT has overlapping sessions.
 * 
 * RULE: If an RBT has a session from 10:30 AM for 30 minutes,
 * they cannot have another session until 11:30 AM (1 hour buffer).
 * 
 * Example:
 * - Session 1: 10:30 AM - 11:00 AM (30 mins)
 * - Buffer: 11:00 AM - 11:30 AM (30 mins)
 * - Next available: 11:30 AM onwards
 */
export default class SessionOverlapService {
  /**
   * Check if RBT has overlapping sessions
   * 
   * @param rbtId - The RBT user ID
   * @param date - Session date
   * @param startTime - Session start time (HH:mm format)
   * @param duration - Session duration in minutes
   * @param excludeSessionId - Optional: exclude this session ID (for updates)
   * @returns Object with hasOverlap boolean and conflicting sessions
   */
  static async checkOverlap(
    rbtId: number,
    date: DateTime,
    startTime: string,
    duration: number,
    excludeSessionId?: number
  ): Promise<{
    hasOverlap: boolean
    conflictingSessions: SessionLog[]
    message?: string
  }> {
    // Calculate session end time with 1-hour buffer
    const [hours, minutes] = startTime.split(':').map(Number)
    const sessionStart = DateTime.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: hours,
      minute: minutes,
    })
    
    // Session end time + 1 hour buffer
    const sessionEndWithBuffer = sessionStart.plus({ minutes: duration + 60 })
    
    // Query for overlapping sessions
    const query = SessionLog.query()
      .where('rbt_id', rbtId)
      .where('date', date.toSQLDate()!)
      .whereNot('status', 'rejected') // Don't check rejected sessions
    
    // Exclude current session if updating
    if (excludeSessionId) {
      query.whereNot('id', excludeSessionId)
    }
    
    const existingSessions = await query
    
    // Check each existing session for overlap
    const conflictingSessions: SessionLog[] = []
    
    for (const session of existingSessions) {
      const [existingHours, existingMinutes] = session.startTime.split(':').map(Number)
      const existingStart = DateTime.fromObject({
        year: date.year,
        month: date.month,
        day: date.day,
        hour: existingHours,
        minute: existingMinutes,
      })
      
      // Existing session end time + 1 hour buffer
      const existingEndWithBuffer = existingStart.plus({ minutes: session.duration + 60 })
      
      // Check for overlap
      // New session starts before existing session ends (with buffer)
      // OR existing session starts before new session ends (with buffer)
      if (
        (sessionStart < existingEndWithBuffer && sessionStart >= existingStart) ||
        (existingStart < sessionEndWithBuffer && existingStart >= sessionStart) ||
        (sessionStart <= existingStart && sessionEndWithBuffer >= existingEndWithBuffer) ||
        (existingStart <= sessionStart && existingEndWithBuffer >= sessionEndWithBuffer)
      ) {
        conflictingSessions.push(session)
      }
    }
    
    if (conflictingSessions.length > 0) {
      const firstConflict = conflictingSessions[0]
      const conflictLocation = firstConflict.location
      const conflictTime = firstConflict.startTime
      
      return {
        hasOverlap: true,
        conflictingSessions,
        message: `RBT already has a session at ${conflictLocation} starting at ${conflictTime} on this date. Sessions must have 1 hour gap (session duration + buffer).`,
      }
    }
    
    return {
      hasOverlap: false,
      conflictingSessions: [],
    }
  }
  
  /**
   * Get RBT's schedule for a specific date
   * Useful for showing available time slots
   */
  static async getRbtSchedule(rbtId: number, date: DateTime) {
    return await SessionLog.query()
      .where('rbt_id', rbtId)
      .where('date', date.toSQLDate()!)
      .whereNot('status', 'rejected')
      .orderBy('start_time', 'asc')
      .preload('client')
  }
  
  /**
   * Calculate next available time slot for RBT
   */
  static calculateNextAvailableTime(lastSessionEnd: DateTime, duration: number): DateTime {
    // Add 1 hour buffer after last session
    return lastSessionEnd.plus({ minutes: 60 })
  }
}
