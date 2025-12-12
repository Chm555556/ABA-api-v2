import Trial from '#models/trial'
import TreatmentGoal from '#models/treatment_goal'
import BehaviorData from '#models/behavior_data'
import { DateTime } from 'luxon'

export interface TrialAnalytics {
  goalId: number
  goalTitle: string
  totalTrials: number
  correctTrials: number
  incorrectTrials: number
  promptedTrials: number
  independentTrials: number
  percentageCorrect: number
  percentageIndependent: number
  promptDependenceRatio: number
  trend: 'ascending' | 'stable' | 'descending'
  masteryMet: boolean
  averageResponseTime: number
  promptLevelDistribution: { [key: number]: number }
  errorPatterns: string[]
  recommendations: string[]
}

export interface SessionAnalytics {
  sessionId: number
  totalTrials: number
  overallPercentage: number
  engagementScore: number | null
  sessionDuration: number
  trialsPerMinute: number
  goalAnalytics: TrialAnalytics[]
  behaviorReduction: number | null
  environmentalFactors: string[]
}

export default class TrialAnalyticsService {
  /**
   * Calculate comprehensive analytics for a session
   */
  static async calculateSessionAnalytics(sessionId: number): Promise<SessionAnalytics> {
    // Get all trials for this session
    const trials = await Trial.query()
      .where('session_id', sessionId)
      .orderBy('timestamp', 'asc')

    // Get session info
    const SessionLog = (await import('#models/session_log')).default
    const session = await SessionLog.findOrFail(sessionId)

    // Group trials by goal
    const trialsByGoal = new Map<number, Trial[]>()
    trials.forEach(trial => {
      if (trial.goalId) {
        if (!trialsByGoal.has(trial.goalId)) {
          trialsByGoal.set(trial.goalId, [])
        }
        trialsByGoal.get(trial.goalId)!.push(trial)
      }
    })

    // Calculate analytics for each goal
    const goalAnalytics: TrialAnalytics[] = []
    for (const [goalId, goalTrials] of trialsByGoal) {
      const analytics = await this.calculateGoalAnalytics(goalId, goalTrials)
      goalAnalytics.push(analytics)
    }

    // Calculate overall session metrics
    const totalTrials = trials.length
    const totalCorrect = trials.filter(t => t.response === 'correct').length
    const overallPercentage = totalTrials > 0 ? Math.round((totalCorrect / totalTrials) * 100) : 0
    const sessionDuration = session.duration || 0
    const trialsPerMinute = sessionDuration > 0 ? totalTrials / sessionDuration : 0

    return {
      sessionId,
      totalTrials,
      overallPercentage,
      engagementScore: session.engagementScore,
      sessionDuration,
      trialsPerMinute: Math.round(trialsPerMinute * 100) / 100,
      goalAnalytics,
      behaviorReduction: null, // Will be calculated by BehaviorAnalyticsService
      environmentalFactors: this.extractEnvironmentalFactors(session.environmentNotes),
    }
  }

  /**
   * Calculate detailed analytics for a specific goal
   */
  static async calculateGoalAnalytics(goalId: number, trials: Trial[]): Promise<TrialAnalytics> {
    const goal = await TreatmentGoal.findOrFail(goalId)
    
    // Basic counts
    const totalTrials = trials.length
    const correctTrials = trials.filter(t => t.response === 'correct').length
    const incorrectTrials = trials.filter(t => t.response === 'incorrect').length
    const promptedTrials = trials.filter(t => t.response === 'prompted').length
    const independentTrials = trials.filter(t => t.independent).length

    // Percentages
    const percentageCorrect = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0
    const percentageIndependent = totalTrials > 0 ? Math.round((independentTrials / totalTrials) * 100) : 0
    
    // Prompt dependence ratio (higher = more dependent on prompts)
    const promptDependenceRatio = totalTrials > 0 ? promptedTrials / totalTrials : 0

    // Calculate trend using linear regression
    const trend = this.calculateTrend(trials)

    // Check mastery criteria
    const masteryMet = this.checkMasteryCriteria(goal, trials)

    // Average response time
    const timedTrials = trials.filter(t => t.durationSeconds)
    const averageResponseTime = timedTrials.length > 0 
      ? timedTrials.reduce((sum, t) => sum + (t.durationSeconds || 0), 0) / timedTrials.length 
      : 0

    // Prompt level distribution
    const promptLevelDistribution: { [key: number]: number } = {}
    trials.forEach(trial => {
      if (trial.promptLevel !== null) {
        promptLevelDistribution[trial.promptLevel] = (promptLevelDistribution[trial.promptLevel] || 0) + 1
      }
    })

    // Error patterns
    const errorPatterns = this.identifyErrorPatterns(trials)

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      percentageCorrect,
      percentageIndependent,
      promptDependenceRatio,
      trend,
      masteryMet,
      errorPatterns
    })

    return {
      goalId,
      goalTitle: goal.title,
      totalTrials,
      correctTrials,
      incorrectTrials,
      promptedTrials,
      independentTrials,
      percentageCorrect,
      percentageIndependent,
      promptDependenceRatio: Math.round(promptDependenceRatio * 100) / 100,
      trend,
      masteryMet,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      promptLevelDistribution,
      errorPatterns,
      recommendations,
    }
  }

  /**
   * Calculate trend using simple linear regression
   */
  private static calculateTrend(trials: Trial[]): 'ascending' | 'stable' | 'descending' {
    if (trials.length < 3) return 'stable'

    // Convert trials to success rate over time
    const dataPoints = trials.map((trial, index) => ({
      x: index,
      y: trial.response === 'correct' ? 1 : 0
    }))

    // Simple linear regression
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0)
    const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0)
    const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0)
    const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    if (slope > 0.1) return 'ascending'
    if (slope < -0.1) return 'descending'
    return 'stable'
  }

  /**
   * Check if mastery criteria is met
   */
  private static checkMasteryCriteria(goal: TreatmentGoal, trials: Trial[]): boolean {
    if (trials.length < 3) return false

    // Parse mastery criteria (e.g., "80% correct for 3 consecutive sessions")
    const masteryCriteria = goal.masteryCriteria || ''
    const percentageMatch = masteryCriteria.match(/(\d+)%/)
    const targetPercentage = percentageMatch ? parseInt(percentageMatch[1]) : 80

    // Check last few trials for consistency
    const recentTrials = trials.slice(-5) // Last 5 trials
    const recentCorrect = recentTrials.filter(t => t.response === 'correct').length
    const recentPercentage = (recentCorrect / recentTrials.length) * 100

    return recentPercentage >= targetPercentage
  }

  /**
   * Identify error patterns
   */
  private static identifyErrorPatterns(trials: Trial[]): string[] {
    const patterns: string[] = []
    
    // Check for consecutive errors
    let consecutiveErrors = 0
    let maxConsecutiveErrors = 0
    
    trials.forEach(trial => {
      if (trial.response === 'incorrect') {
        consecutiveErrors++
        maxConsecutiveErrors = Math.max(maxConsecutiveErrors, consecutiveErrors)
      } else {
        consecutiveErrors = 0
      }
    })

    if (maxConsecutiveErrors >= 3) {
      patterns.push(`${maxConsecutiveErrors} consecutive errors detected`)
    }

    // Check for prompt dependency
    const promptedCount = trials.filter(t => t.response === 'prompted').length
    const promptDependency = promptedCount / trials.length
    
    if (promptDependency > 0.5) {
      patterns.push('High prompt dependency (>50%)')
    }

    // Check for specific error types
    const errorTrials = trials.filter(t => t.response === 'incorrect')
    if (errorTrials.length > 0) {
      // Analyze error correction patterns
      const errorCorrections = errorTrials
        .map(t => t.errorCorrection)
        .filter(ec => ec)
        .reduce((acc, ec) => {
          acc[ec!] = (acc[ec!] || 0) + 1
          return acc
        }, {} as { [key: string]: number })

      Object.entries(errorCorrections).forEach(([correction, count]) => {
        if (count >= 2) {
          patterns.push(`Frequent ${correction} errors (${count} times)`)
        }
      })
    }

    return patterns
  }

  /**
   * Generate recommendations based on analytics
   */
  private static generateRecommendations(data: {
    percentageCorrect: number
    percentageIndependent: number
    promptDependenceRatio: number
    trend: string
    masteryMet: boolean
    errorPatterns: string[]
  }): string[] {
    const recommendations: string[] = []

    // Performance-based recommendations
    if (data.percentageCorrect < 50) {
      recommendations.push('Consider breaking down the skill into smaller steps')
      recommendations.push('Increase reinforcement frequency')
    } else if (data.percentageCorrect < 80) {
      recommendations.push('Continue current teaching strategy with minor adjustments')
    } else if (data.masteryMet) {
      recommendations.push('Consider moving to maintenance phase')
      recommendations.push('Introduce generalization opportunities')
    }

    // Independence recommendations
    if (data.percentageIndependent < 30) {
      recommendations.push('Focus on fading prompts systematically')
      recommendations.push('Use least-to-most prompting hierarchy')
    }

    // Trend-based recommendations
    if (data.trend === 'descending') {
      recommendations.push('Review teaching procedures for effectiveness')
      recommendations.push('Consider environmental modifications')
    } else if (data.trend === 'ascending') {
      recommendations.push('Continue current successful approach')
    }

    // Error pattern recommendations
    data.errorPatterns.forEach(pattern => {
      if (pattern.includes('consecutive errors')) {
        recommendations.push('Implement error correction procedure')
      }
      if (pattern.includes('prompt dependency')) {
        recommendations.push('Implement systematic prompt fading')
      }
    })

    return recommendations
  }

  /**
   * Extract environmental factors from notes
   */
  private static extractEnvironmentalFactors(notes: string | null): string[] {
    if (!notes) return []

    const factors: string[] = []
    const lowerNotes = notes.toLowerCase()

    // Common environmental factors
    const factorKeywords = {
      'noise': ['noise', 'loud', 'quiet', 'sound'],
      'distractions': ['distraction', 'distracted', 'focus', 'attention'],
      'mood': ['happy', 'sad', 'frustrated', 'excited', 'calm', 'upset'],
      'energy': ['tired', 'energetic', 'sleepy', 'alert'],
      'social': ['peers', 'siblings', 'alone', 'group'],
      'physical': ['hungry', 'thirsty', 'sick', 'comfortable']
    }

    Object.entries(factorKeywords).forEach(([factor, keywords]) => {
      if (keywords.some(keyword => lowerNotes.includes(keyword))) {
        factors.push(factor)
      }
    })

    return factors
  }

  /**
   * Store calculated analytics in behavior_data table
   */
  static async storeBehaviorData(sessionId: number, goalId: number, analytics: TrialAnalytics): Promise<BehaviorData> {
    return await BehaviorData.create({
      sessionId,
      goalId,
      correct: analytics.correctTrials,
      incorrect: analytics.incorrectTrials,
      prompted: analytics.promptedTrials,
      total: analytics.totalTrials,
      percentage: analytics.percentageCorrect,
      durationSeconds: Math.round(analytics.averageResponseTime),
      frequencyCount: analytics.totalTrials,
      antecedent: 'Session-based trial data',
      consequence: analytics.recommendations.join('; '),
      environmentNotes: `Trend: ${analytics.trend}, Independence: ${analytics.percentageIndependent}%`,
    })
  }
}