import Client from '#models/client'
import SessionLog from '#models/session_log'
import TreatmentGoal from '#models/treatment_goal'
import GoalProgress from '#models/goal_progress'

export default class TherapyDataService {
  /**
   * Fetch all clients for a parent
   * @param parentId - The parent user ID
   * @returns Array of clients with relationships
   */
  async fetchClientsByParent(parentId: number): Promise<Client[]> {
    const clients = await Client.query()
      .where('parent_id', parentId)
      .preload('bcba')
      .preload('assignedRbts')

    return clients
  }

  /**
   * Fetch recent sessions for a client
   * @param clientId - The client ID
   * @param limit - Maximum number of sessions (default: 10)
   * @returns Array of session logs with RBT names
   */
  async fetchRecentSessions(clientId: number, limit: number = 10): Promise<SessionLog[]> {
    const sessions = await SessionLog.query()
      .where('client_id', clientId)
      .preload('rbt')
      .orderBy('date', 'desc')
      .limit(limit)

    return sessions
  }

  /**
   * Fetch active treatment goals for a client
   * @param clientId - The client ID
   * @returns Array of active goals
   */
  async fetchActiveGoals(clientId: number): Promise<TreatmentGoal[]> {
    const goals = await TreatmentGoal.query()
      .where('client_id', clientId)
      .where('status', 'active')

    return goals
  }

  /**
   * Fetch recent progress for a goal
   * @param goalId - The goal ID
   * @param limit - Maximum number of progress records (default: 5)
   * @returns Array of goal progress records
   */
  async fetchGoalProgress(goalId: number, limit: number = 5): Promise<GoalProgress[]> {
    const progress = await GoalProgress.query()
      .where('goal_id', goalId)
      .orderBy('created_at', 'desc')
      .limit(limit)

    return progress
  }
}
