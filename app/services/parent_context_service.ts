import { DateTime } from 'luxon'
import TherapyDataService from '#services/therapy_data_service'
import ParentContextCache from '#models/parent_context_cache'
import Client from '#models/client'
import SessionLog from '#models/session_log'
import TreatmentGoal from '#models/treatment_goal'
import GoalProgress from '#models/goal_progress'

interface TherapyData {
  clients: Array<{
    client: Client
    sessions: SessionLog[]
    goals: Array<{
      goal: TreatmentGoal
      progress: GoalProgress[]
    }>
  }>
}

interface KnowledgeBase {
  parent_summary: string
  children_details: string[]
  recent_activity: string[]
  treatment_goals: string[]
  progress_highlights: string[]
}

interface ParentContext {
  parent_id: number
  knowledge_base: KnowledgeBase
  cache_age: number
  last_updated: string
}

export default class ParentContextService {
  private therapyDataService: TherapyDataService

  constructor() {
    this.therapyDataService = new TherapyDataService()
  }

  /**
   * Get parent context (from cache or generate new)
   * @param parentId - The parent user ID
   * @returns Formatted knowledge base object
   */
  async getParentContext(parentId: number): Promise<ParentContext> {
    // Check cache first
    const cachedContext = await this.getCachedContext(parentId)

    if (cachedContext) {
      return cachedContext
    }

    // Generate new context
    const therapyData = await this.fetchTherapyData(parentId)
    const knowledgeBase = this.formatKnowledgeBase(therapyData)

    const context: ParentContext = {
      parent_id: parentId,
      knowledge_base: knowledgeBase,
      cache_age: 0,
      last_updated: DateTime.now().toISO()!,
    }

    // Cache the context
    await this.cacheContext(parentId, context)

    return context
  }

  /**
   * Get cached context if available and fresh
   * @param parentId - The parent user ID
   * @returns Cached context or null
   */
  async getCachedContext(parentId: number): Promise<ParentContext | null> {
    const cached = await ParentContextCache.query().where('parent_id', parentId).first()

    if (!cached) {
      return null
    }

    // Check if cache is less than 1 hour old
    const cacheAge = DateTime.now().diff(cached.updatedAt, 'hours').hours

    if (cacheAge >= 1) {
      // Cache is stale
      return null
    }

    // Return cached context
    const cacheAgeMs = DateTime.now().diff(cached.updatedAt, 'milliseconds').milliseconds

    return {
      parent_id: parentId,
      knowledge_base: cached.contextData as KnowledgeBase,
      cache_age: cacheAgeMs,
      last_updated: cached.updatedAt.toISO()!,
    }
  }

  /**
   * Force refresh of parent context
   * @param parentId - The parent user ID
   * @returns Newly generated context
   */
  async refreshContext(parentId: number): Promise<ParentContext> {
    // Generate new context
    const therapyData = await this.fetchTherapyData(parentId)
    const knowledgeBase = this.formatKnowledgeBase(therapyData)

    const context: ParentContext = {
      parent_id: parentId,
      knowledge_base: knowledgeBase,
      cache_age: 0,
      last_updated: DateTime.now().toISO()!,
    }

    // Update cache
    await this.cacheContext(parentId, context)

    return context
  }

  /**
   * Store context in cache
   * @param parentId - The parent user ID
   * @param context - The context to cache
   */
  async cacheContext(parentId: number, context: ParentContext): Promise<void> {
    const existing = await ParentContextCache.query().where('parent_id', parentId).first()

    if (existing) {
      // Update existing cache
      existing.contextData = context.knowledge_base
      existing.updatedAt = DateTime.now()
      await existing.save()
    } else {
      // Create new cache entry
      await ParentContextCache.create({
        parentId: parentId,
        contextData: context.knowledge_base,
      })
    }
  }

  /**
   * Fetch therapy data for a parent
   * @param parentId - The parent user ID
   * @returns Raw therapy data
   */
  private async fetchTherapyData(parentId: number): Promise<TherapyData> {
    console.log('=== FETCHING THERAPY DATA ===')
    console.log('Parent ID:', parentId)

    const clients = await this.therapyDataService.fetchClientsByParent(parentId)
    console.log('Clients found:', clients.length)

    const therapyData: TherapyData = {
      clients: [],
    }

    for (const client of clients) {
      console.log(`Processing client: ${client.firstName} ${client.lastName} (ID: ${client.id})`)

      const sessions = await this.therapyDataService.fetchRecentSessions(client.id, 10)
      console.log(`  - Sessions found: ${sessions.length}`)

      const goals = await this.therapyDataService.fetchActiveGoals(client.id)
      console.log(`  - Active goals found: ${goals.length}`)

      const goalsWithProgress = []
      for (const goal of goals) {
        const progress = await this.therapyDataService.fetchGoalProgress(goal.id, 5)
        console.log(`    - Progress records for goal "${goal.title}": ${progress.length}`)
        goalsWithProgress.push({
          goal,
          progress,
        })
      }

      therapyData.clients.push({
        client,
        sessions,
        goals: goalsWithProgress,
      })
    }

    console.log('=== THERAPY DATA FETCH COMPLETE ===')
    console.log('Total clients:', therapyData.clients.length)
    console.log('Total sessions:', therapyData.clients.reduce((sum, c) => sum + c.sessions.length, 0))
    console.log('Total goals:', therapyData.clients.reduce((sum, c) => sum + c.goals.length, 0))

    return therapyData
  }

  /**
   * Format therapy data into knowledge base structure
   * @param therapyData - Raw therapy data from database
   * @returns Formatted knowledge base
   */
  formatKnowledgeBase(therapyData: TherapyData): KnowledgeBase {
    const childrenDetails: string[] = []
    const recentActivity: string[] = []
    const treatmentGoals: string[] = []
    const progressHighlights: string[] = []

    // Format each client's data
    for (const clientData of therapyData.clients) {
      const { client, sessions, goals } = clientData

      // Format child summary
      childrenDetails.push(this.formatChildSummary(client))

      // Format session summaries
      for (const session of sessions) {
        recentActivity.push(this.formatSessionSummary(session, client.firstName))
      }

      // Format goal summaries
      for (const goalData of goals) {
        treatmentGoals.push(this.formatGoalSummary(goalData.goal, client.firstName))

        // Format progress summaries
        for (const progress of goalData.progress) {
          progressHighlights.push(
            this.formatProgressSummary(progress, goalData.goal.title, client.firstName)
          )
        }
      }
    }

    // Generate parent summary
    const parentSummary = this.generateParentSummary(therapyData)

    return {
      parent_summary: parentSummary,
      children_details: childrenDetails,
      recent_activity: recentActivity,
      treatment_goals: treatmentGoals,
      progress_highlights: progressHighlights,
    }
  }

  /**
   * Format child summary with name, age, diagnosis
   * @param client - Client model
   * @returns Natural language summary
   */
  private formatChildSummary(client: Client): string {
    const age = client.age
    const diagnosis = Array.isArray(client.diagnosis) ? client.diagnosis.join(', ') : 'not specified'
    const status = client.status

    return `Your child ${client.firstName} is ${age} years old and has been diagnosed with ${diagnosis}. Current status: ${status}.`
  }

  /**
   * Format session summary with date, duration, RBT name, notes preview
   * @param session - SessionLog model
   * @param childName - Child's first name
   * @returns Readable session description
   */
  private formatSessionSummary(session: SessionLog, childName: string): string {
    const date = this.formatDate(session.date)
    const duration = session.duration
    const rbtName = session.rbt?.name || 'therapist'
    const serviceType = session.serviceType
    const location = session.location
    const notesPreview = this.truncateNotes(session.sessionNotes, 200)

    let summary = `On ${date}, ${childName} had a ${duration}-minute ${serviceType} session with ${rbtName} at ${location}.`

    if (notesPreview) {
      summary += ` Notes: ${notesPreview}`
    }

    return summary
  }

  /**
   * Format goal summary with title, target behavior, status
   * @param goal - TreatmentGoal model
   * @param childName - Child's first name
   * @returns Goal description
   */
  private formatGoalSummary(goal: TreatmentGoal, childName: string): string {
    return `${childName}'s goal: ${goal.title}. Target behavior: ${goal.targetBehavior}. Measurement: ${goal.measurementType}. Status: ${goal.status}. Mastery criteria: ${goal.masteryCriteria}.`
  }

  /**
   * Format progress summary with trend
   * @param progress - GoalProgress model
   * @param goalTitle - Goal title
   * @param childName - Child's first name
   * @returns Progress description
   */
  private formatProgressSummary(
    progress: GoalProgress,
    goalTitle: string,
    childName: string
  ): string {
    const date = this.formatDate(progress.createdAt)
    const trend = progress.progress
    const currentLevel = progress.currentLevel
    const targetLevel = progress.targetLevel

    let summary = `${childName}'s progress on "${goalTitle}" as of ${date}: ${trend}. Current level: ${currentLevel}, Target: ${targetLevel}.`

    if (progress.notes) {
      summary += ` Notes: ${progress.notes}`
    }

    return summary
  }

  /**
   * Convert date to "Month Day, Year" format
   * @param date - DateTime object or string
   * @returns Human-readable date string
   */
  private formatDate(date: DateTime | string): string {
    let dateTime: DateTime

    if (typeof date === 'string') {
      dateTime = DateTime.fromISO(date)
    } else {
      dateTime = date
    }

    if (!dateTime.isValid) {
      return 'unknown date'
    }

    return dateTime.toFormat('MMMM d, yyyy')
  }

  /**
   * Calculate age from date of birth
   * @param dateOfBirth - Date of birth
   * @returns Age in years
   */
  private calculateAge(dateOfBirth: DateTime): number {
    const today = DateTime.now()
    return Math.floor(today.diff(dateOfBirth, 'years').years)
  }

  /**
   * Truncate notes to maximum length
   * @param notes - Session notes or other text
   * @param maxLength - Maximum length (default: 200)
   * @returns Truncated text
   */
  private truncateNotes(notes: string | null, maxLength: number = 200): string {
    if (!notes) {
      return ''
    }

    if (notes.length <= maxLength) {
      return notes
    }

    return notes.substring(0, maxLength)
  }

  /**
   * Generate parent summary
   * @param therapyData - Raw therapy data
   * @returns Summary string
   */
  private generateParentSummary(therapyData: TherapyData): string {
    const childCount = therapyData.clients.length

    if (childCount === 0) {
      return 'You are speaking with a parent who has no children currently enrolled in ABA therapy.'
    }

    const childNames = therapyData.clients.map((c) => c.client.firstName).join(', ')
    let summary = `You are speaking with the parent of ${childCount} child${childCount > 1 ? 'ren' : ''}: ${childNames}.`

    // Add total active goals count
    const totalGoals = therapyData.clients.reduce((sum, c) => sum + c.goals.length, 0)
    if (totalGoals > 0) {
      summary += ` There are currently ${totalGoals} active therapy goal${totalGoals > 1 ? 's' : ''}.`
    }

    // Add most recent session info
    const allSessions = therapyData.clients.flatMap((c) => c.sessions)
    if (allSessions.length > 0) {
      const mostRecent = allSessions[0]
      const date = this.formatDate(mostRecent.date)
      const rbtName = mostRecent.rbt?.name || 'therapist'
      summary += ` The most recent session was on ${date} with ${rbtName}.`
    }

    return summary
  }
}
