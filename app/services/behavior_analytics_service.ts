import BehaviorData from '#models/behavior_data'
import TreatmentGoal from '#models/treatment_goal'
import { DateTime } from 'luxon'

export interface BehaviorTrend {
  goalId: number
  goalTitle: string
  currentValue: number
  baselineValue: number | null
  percentageChange: number
  trend: 'improving' | 'maintaining' | 'regressing'
  significantChange: boolean
  recommendedAction: string
}

export interface BehaviorAnalytics {
  clientId: number
  analysisDate: DateTime
  behaviorTrends: BehaviorTrend[]
  overallProgress: 'excellent' | 'good' | 'fair' | 'poor'
  interventionEffectiveness: number // 0-100 scale
  recommendations: string[]
}

export default class BehaviorAnalyticsService {
  /**
   * Calculate behavior analytics for a client over a time period
   */
  static async calculateBehaviorAnalytics(
    clientId: number, 
    startDate: DateTime, 
    endDate: DateTime
  ): Promise<BehaviorAnalytics> {
    // Get all behavior data for the client in the time period
    const behaviorData = await BehaviorData.query()
      .whereHas('session', (sessionQuery) => {
        sessionQuery.where('client_id', clientId)
      })
      .whereBetween('created_at', [startDate.toISO(), endDate.toISO()])
      .orderBy('created_at', 'asc')

    // Group by goal
    const dataByGoal = new Map<number, BehaviorData[]>()
    behaviorData.forEach(data => {
      if (!dataByGoal.has(data.goalId)) {
        dataByGoal.set(data.goalId, [])
      }
      dataByGoal.get(data.goalId)!.push(data)
    })

    // Calculate trends for each goal
    const behaviorTrends: BehaviorTrend[] = []
    for (const [goalId, goalData] of dataByGoal) {
      const trend = await this.calculateBehaviorTrend(goalId, goalData)
      behaviorTrends.push(trend)
    }

    // Calculate overall progress
    const overallProgress = this.calculateOverallProgress(behaviorTrends)
    
    // Calculate intervention effectiveness
    const interventionEffectiveness = this.calculateInterventionEffectiveness(behaviorTrends)

    // Generate recommendations
    const recommendations = this.generateBehaviorRecommendations(behaviorTrends)

    return {
      clientId,
      analysisDate: DateTime.now(),
      behaviorTrends,
      overallProgress,
      interventionEffectiveness,
      recommendations,
    }
  }

  /**
   * Calculate trend for a specific behavior/goal
   */
  private static async calculateBehaviorTrend(goalId: number, data: BehaviorData[]): Promise<BehaviorTrend> {
    const goal = await TreatmentGoal.findOrFail(goalId)
    
    if (data.length === 0) {
      return {
        goalId,
        goalTitle: goal.title,
        currentValue: 0,
        baselineValue: goal.baselineScore || null,
        percentageChange: 0,
        trend: 'maintaining',
        significantChange: false,
        recommendedAction: 'Collect more data'
      }
    }

    // Get current and baseline values
    const currentValue = data[data.length - 1].percentage
    const baselineValue = goal.baselineScore || data[0].percentage

    // Calculate percentage change
    const percentageChange = baselineValue > 0 
      ? ((currentValue - baselineValue) / baselineValue) * 100 
      : 0

    // Determine trend
    let trend: 'improving' | 'maintaining' | 'regressing'
    if (Math.abs(percentageChange) < 10) {
      trend = 'maintaining'
    } else if (this.isTargetBehavior(goal)) {
      // For target behaviors (skills to increase), higher is better
      trend = percentageChange > 0 ? 'improving' : 'regressing'
    } else {
      // For problem behaviors (to decrease), lower is better
      trend = percentageChange < 0 ? 'improving' : 'regressing'
    }

    // Check for significant change (>25% change)
    const significantChange = Math.abs(percentageChange) > 25

    // Generate recommended action
    const recommendedAction = this.getRecommendedAction(trend, significantChange, percentageChange)

    return {
      goalId,
      goalTitle: goal.title,
      currentValue,
      baselineValue,
      percentageChange: Math.round(percentageChange * 100) / 100,
      trend,
      significantChange,
      recommendedAction
    }
  }

  /**
   * Determine if this is a target behavior (skill) or problem behavior
   */
  private static isTargetBehavior(goal: TreatmentGoal): boolean {
    const title = goal.title.toLowerCase()
    const description = goal.description?.toLowerCase() || ''
    
    // Keywords that indicate problem behaviors (to decrease)
    const problemKeywords = [
      'aggression', 'tantrum', 'self-injury', 'disruption', 'elopement',
      'screaming', 'hitting', 'biting', 'throwing', 'crying'
    ]
    
    // Keywords that indicate target behaviors (to increase)
    const targetKeywords = [
      'communication', 'request', 'mand', 'tact', 'imitation',
      'compliance', 'following', 'social', 'play', 'academic'
    ]

    const hasProblems = problemKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword)
    )
    
    const hasTargets = targetKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword)
    )

    // Default to target behavior if unclear
    return !hasProblems || hasTargets
  }

  /**
   * Get recommended action based on trend analysis
   */
  private static getRecommendedAction(
    trend: 'improving' | 'maintaining' | 'regressing',
    significantChange: boolean,
    percentageChange: number
  ): string {
    if (trend === 'improving') {
      if (significantChange) {
        return 'Continue current intervention - excellent progress'
      } else {
        return 'Maintain current approach with minor adjustments'
      }
    } else if (trend === 'regressing') {
      if (significantChange) {
        return 'Immediate intervention review required'
      } else {
        return 'Monitor closely and consider strategy modifications'
      }
    } else {
      // maintaining
      if (percentageChange > 80) {
        return 'Consider moving to maintenance phase'
      } else {
        return 'Increase intervention intensity or modify approach'
      }
    }
  }

  /**
   * Calculate overall progress across all behaviors
   */
  private static calculateOverallProgress(trends: BehaviorTrend[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (trends.length === 0) return 'fair'

    const improvingCount = trends.filter(t => t.trend === 'improving').length
    const regressingCount = trends.filter(t => t.trend === 'regressing').length
    const maintainingCount = trends.filter(t => t.trend === 'maintaining').length

    const improvingRatio = improvingCount / trends.length
    const regressingRatio = regressingCount / trends.length

    if (improvingRatio >= 0.8) return 'excellent'
    if (improvingRatio >= 0.6 && regressingRatio <= 0.2) return 'good'
    if (improvingRatio >= 0.4 && regressingRatio <= 0.4) return 'fair'
    return 'poor'
  }

  /**
   * Calculate intervention effectiveness score
   */
  private static calculateInterventionEffectiveness(trends: BehaviorTrend[]): number {
    if (trends.length === 0) return 50

    let totalScore = 0
    trends.forEach(trend => {
      let score = 50 // baseline

      if (trend.trend === 'improving') {
        score += Math.min(trend.percentageChange, 50) // Cap at 50 points
      } else if (trend.trend === 'regressing') {
        score -= Math.min(Math.abs(trend.percentageChange), 50)
      }

      if (trend.significantChange && trend.trend === 'improving') {
        score += 10 // Bonus for significant improvement
      }

      totalScore += Math.max(0, Math.min(100, score)) // Keep between 0-100
    })

    return Math.round(totalScore / trends.length)
  }

  /**
   * Generate behavior-specific recommendations
   */
  private static generateBehaviorRecommendations(trends: BehaviorTrend[]): string[] {
    const recommendations: string[] = []

    const improvingCount = trends.filter(t => t.trend === 'improving').length
    const regressingCount = trends.filter(t => t.trend === 'regressing').length
    const maintainingCount = trends.filter(t => t.trend === 'maintaining').length

    // Overall recommendations
    if (regressingCount > improvingCount) {
      recommendations.push('Schedule team meeting to review intervention strategies')
      recommendations.push('Consider environmental modifications or antecedent interventions')
    }

    if (improvingCount > trends.length * 0.7) {
      recommendations.push('Excellent progress - consider introducing generalization opportunities')
      recommendations.push('Begin planning for maintenance and fade procedures')
    }

    // Specific behavior recommendations
    trends.forEach(trend => {
      if (trend.trend === 'regressing' && trend.significantChange) {
        recommendations.push(`${trend.goalTitle}: Immediate strategy review needed`)
      }
      
      if (trend.trend === 'improving' && trend.currentValue > 80) {
        recommendations.push(`${trend.goalTitle}: Ready for mastery criteria assessment`)
      }

      if (trend.trend === 'maintaining' && trend.currentValue < 50) {
        recommendations.push(`${trend.goalTitle}: Consider breaking into smaller steps`)
      }
    })

    // Data collection recommendations
    if (trends.some(t => t.baselineValue === null)) {
      recommendations.push('Establish baseline data for goals missing baseline measurements')
    }

    // Frequency recommendations
    const lowDataGoals = trends.filter(t => t.currentValue === 0)
    if (lowDataGoals.length > 0) {
      recommendations.push('Increase data collection frequency for goals with limited data')
    }

    return recommendations.slice(0, 8) // Limit to 8 recommendations
  }

  /**
   * Calculate behavior frequency reduction percentage
   */
  static calculateFrequencyReduction(
    currentFrequency: number, 
    baselineFrequency: number
  ): number {
    if (baselineFrequency === 0) return 0
    return ((baselineFrequency - currentFrequency) / baselineFrequency) * 100
  }

  /**
   * Detect if replacement behavior is increasing appropriately
   */
  static analyzeReplacementBehavior(
    problemBehaviorData: BehaviorData[],
    replacementBehaviorData: BehaviorData[]
  ): {
    correlationStrength: number
    replacementEffective: boolean
    recommendation: string
  } {
    if (problemBehaviorData.length === 0 || replacementBehaviorData.length === 0) {
      return {
        correlationStrength: 0,
        replacementEffective: false,
        recommendation: 'Insufficient data for replacement behavior analysis'
      }
    }

    // Calculate correlation between problem behavior decrease and replacement increase
    // Simplified correlation calculation
    const problemTrend = this.calculateSimpleTrend(problemBehaviorData.map(d => d.percentage))
    const replacementTrend = this.calculateSimpleTrend(replacementBehaviorData.map(d => d.percentage))

    const correlationStrength = Math.abs(problemTrend + replacementTrend) // Inverse correlation
    const replacementEffective = problemTrend < 0 && replacementTrend > 0

    let recommendation = ''
    if (replacementEffective) {
      recommendation = 'Replacement behavior intervention is effective - continue current approach'
    } else if (problemTrend >= 0 && replacementTrend <= 0) {
      recommendation = 'Both behaviors stable/increasing - review intervention strategy'
    } else {
      recommendation = 'Mixed results - consider modifying replacement behavior teaching'
    }

    return {
      correlationStrength: Math.round(correlationStrength * 100) / 100,
      replacementEffective,
      recommendation
    }
  }

  /**
   * Calculate simple trend (positive = increasing, negative = decreasing)
   */
  private static calculateSimpleTrend(values: number[]): number {
    if (values.length < 2) return 0
    
    const first = values[0]
    const last = values[values.length - 1]
    
    return first > 0 ? (last - first) / first : 0
  }
}