import type { HttpContext } from '@adonisjs/core/http'
import TreatmentGoal from '#models/treatment_goal'
import Client from '#models/client'
import BehaviorData from '#models/behavior_data'

export default class TreatmentGoalsController {
  /**
   * Get treatment goals
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const clientId = request.input('clientId')
      const status = request.input('status')

      let query = TreatmentGoal.query()
        .preload('client')
        .preload('creator')
        .preload('baselineData', (baselineQuery) => {
          baselineQuery.orderBy('collectionDate', 'desc')
        })
        .preload('targetBehaviors', (targetQuery) => {
          targetQuery.preload('creator').orderBy('createdAt', 'asc')
        })

      // Role-based filtering
      if (user.role === 'BCBA') {
        query = query.where('created_by', user.id)
      } else if (user.role === 'RBT') {
        // RBT can see goals for their assigned clients
        const assignedClients = await Client.query()
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
        query = query.whereIn('client_id', assignedClients.map(c => c.id))
      } else if (user.role === 'PARENT') {
        // Parents can see goals for their children using parentId
        const parentClients = await Client.query()
          .where('parentId', user.id)
        
        if (parentClients.length > 0) {
          query = query.whereIn('client_id', parentClients.map(c => c.id))
        } else {
          return response.json({ data: [] })
        }
      } else if (user.role === 'CLINIC') {
        // Clinic can see all goals for their clients
        const clinicClients = await Client.query().where('clinic_id', user.clinicId!)
        query = query.whereIn('client_id', clinicClients.map(c => c.id))
      }

      if (clientId) {
        query = query.where('client_id', clientId)
      }

      if (status) {
        query = query.where('status', status)
      }

      const goals = await query.orderBy('created_at', 'desc')

      return response.json({
        data: goals.map(goal => ({
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client.fullName,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          domain: goal.domain,
          promptHierarchy: goal.promptHierarchy,
          baselineScore: goal.baselineScore,
          baselineTrials: goal.baselineTrials,
          targetPercentage: goal.targetPercentage,
          consecutiveSessions: goal.consecutiveSessions,
          goalPhase: goal.goalPhase,
          createdBy: goal.createdBy,
          createdByName: goal.creator.name,
          createdAt: goal.createdAt.toISO(),
          updatedAt: goal.updatedAt?.toISO(),
          baselineData: goal.baselineData.map(baseline => ({
            id: baseline.id,
            score: baseline.score,
            trials: baseline.trials,
            collectionDate: baseline.collectionDate.toISODate(),
            notes: baseline.notes,
          })),
          targetBehaviors: goal.targetBehaviors.map(behavior => ({
            id: behavior.id,
            name: behavior.name,
            description: behavior.description,
            baselinePercentage: behavior.baselinePercentage,
            intensity: behavior.intensity,
            notes: behavior.notes,
            status: behavior.status,
            currentPercentage: behavior.currentPercentage,
            masteryDate: behavior.masteryDate?.toISODate() || null,
            createdBy: behavior.createdBy,
            creatorName: behavior.creator?.name || null,
            createdAt: behavior.createdAt.toISO(),
          })),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch treatment goals',
        error: error.message,
      })
    }
  }

  /**
   * Create a new treatment goal
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        clientId,
        title,
        description,
        targetBehavior,
        measurementType,
        masteryCriteria,
        domain,
        promptHierarchy,
        baselineScore,
        baselineTrials,
        targetPercentage,
        consecutiveSessions,
        goalPhase,
      } = request.only([
        'clientId',
        'title',
        'description',
        'targetBehavior',
        'measurementType',
        'masteryCriteria',
        'domain',
        'promptHierarchy',
        'baselineScore',
        'baselineTrials',
        'targetPercentage',
        'consecutiveSessions',
        'goalPhase',
      ])

      // Verify user has access to this client
      const client = await Client.findOrFail(clientId)
      
      if (user.role === 'BCBA' && client.assignedBcba !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this client',
        })
      }

      if (user.role === 'CLINIC' && client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this client',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this client',
          })
        }
      }

      const goal = await TreatmentGoal.create({
        clientId: client.id,
        title,
        description,
        targetBehavior,
        measurementType,
        masteryCriteria,
        status: 'active',
        domain,
        promptHierarchy,
        baselineScore,
        baselineTrials,
        targetPercentage,
        consecutiveSessions,
        goalPhase: goalPhase || 'baseline',
        createdBy: user.id,
      })

      await goal.load('client')
      await goal.load('creator')

      return response.status(201).json({
        message: 'Treatment goal created successfully',
        data: {
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client.fullName,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          domain: goal.domain,
          promptHierarchy: goal.promptHierarchy,
          baselineScore: goal.baselineScore,
          baselineTrials: goal.baselineTrials,
          targetPercentage: goal.targetPercentage,
          consecutiveSessions: goal.consecutiveSessions,
          goalPhase: goal.goalPhase,
          createdBy: goal.createdBy,
          createdByName: goal.creator.name,
          createdAt: goal.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create treatment goal',
        error: error.message,
      })
    }
  }

  /**
   * Update a treatment goal
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = params.id
      const updates = request.only([
        'title',
        'description',
        'targetBehavior',
        'measurementType',
        'masteryCriteria',
        'status',
        'domain',
        'promptHierarchy',
        'baselineScore',
        'baselineTrials',
        'targetPercentage',
        'consecutiveSessions',
        'goalPhase',
      ])

      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      goal.merge(updates)
      await goal.save()

      await goal.load('creator')

      return response.json({
        message: 'Treatment goal updated successfully',
        data: {
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client.fullName,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          domain: goal.domain,
          promptHierarchy: goal.promptHierarchy,
          baselineScore: goal.baselineScore,
          baselineTrials: goal.baselineTrials,
          targetPercentage: goal.targetPercentage,
          consecutiveSessions: goal.consecutiveSessions,
          goalPhase: goal.goalPhase,
          createdBy: goal.createdBy,
          createdByName: goal.creator.name,
          updatedAt: goal.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update treatment goal',
        error: error.message,
      })
    }
  }

  /**
   * Delete a treatment goal
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = params.id

      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      await goal.delete()

      return response.json({
        message: 'Treatment goal deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to delete treatment goal',
        error: error.message,
      })
    }
  }

  /**
   * Bulk create treatment goals
   */
  async bulkCreate({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { clientId, goals } = request.only(['clientId', 'goals'])

      if (!Array.isArray(goals) || goals.length === 0) {
        return response.status(400).json({
          message: 'Goals array is required and must not be empty',
        })
      }

      // Verify BCBA has access to this client
      const client = await Client.findOrFail(clientId)
      
      if (user.role === 'BCBA' && client.assignedBcba !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this client',
        })
      }

      if (user.role === 'CLINIC' && client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this client',
        })
      }

      // Create all goals
      const createdGoals = []
      for (const goalData of goals) {
        const goal = await TreatmentGoal.create({
          clientId: client.id,
          title: goalData.title,
          description: goalData.description,
          targetBehavior: goalData.targetBehavior,
          measurementType: goalData.measurementType,
          masteryCriteria: goalData.masteryCriteria,
          status: 'active',
          domain: goalData.domain,
          promptHierarchy: goalData.promptHierarchy,
          baselineScore: goalData.baselineScore,
          baselineTrials: goalData.baselineTrials,
          targetPercentage: goalData.targetPercentage,
          consecutiveSessions: goalData.consecutiveSessions,
          goalPhase: goalData.goalPhase || 'baseline',
          createdBy: user.id,
        })

        await goal.load('client')
        await goal.load('creator')
        
        // Create target behaviors if provided
        if (goalData.targetBehaviors && Array.isArray(goalData.targetBehaviors)) {
          const TargetBehavior = (await import('#models/target_behavior')).default
          
          for (const behaviorData of goalData.targetBehaviors) {
            if (behaviorData.name && behaviorData.name.trim()) {
              await TargetBehavior.create({
                goalId: goal.id,
                name: behaviorData.name,
                description: behaviorData.description || null,
                baselinePercentage: behaviorData.baselinePercentage || null,
                intensity: behaviorData.intensity || 'moderate',
                notes: behaviorData.notes || null,
                status: 'active',
                createdBy: user.id,
              })
            }
          }
          
          // Reload target behaviors
          await goal.load('targetBehaviors', (targetQuery) => {
            targetQuery.preload('creator').orderBy('createdAt', 'asc')
          })
        }
        
        createdGoals.push(goal)
      }

      return response.status(201).json({
        message: `${createdGoals.length} treatment goals created successfully`,
        data: createdGoals.map(goal => ({
          id: goal.id,
          clientId: goal.clientId,
          clientName: goal.client.fullName,
          title: goal.title,
          description: goal.description,
          targetBehavior: goal.targetBehavior,
          measurementType: goal.measurementType,
          masteryCriteria: goal.masteryCriteria,
          status: goal.status,
          domain: goal.domain,
          promptHierarchy: goal.promptHierarchy,
          baselineScore: goal.baselineScore,
          baselineTrials: goal.baselineTrials,
          targetPercentage: goal.targetPercentage,
          consecutiveSessions: goal.consecutiveSessions,
          goalPhase: goal.goalPhase,
          createdBy: goal.createdBy,
          createdByName: goal.creator.name,
          createdAt: goal.createdAt.toISO(),
          targetBehaviors: goal.targetBehaviors ? goal.targetBehaviors.map(behavior => ({
            id: behavior.id,
            name: behavior.name,
            description: behavior.description,
            baselinePercentage: behavior.baselinePercentage,
            intensity: behavior.intensity,
            notes: behavior.notes,
            status: behavior.status,
            currentPercentage: behavior.currentPercentage,
            masteryDate: behavior.masteryDate?.toISODate() || null,
            createdBy: behavior.createdBy,
            creatorName: behavior.creator?.name || null,
            createdAt: behavior.createdAt.toISO(),
          })) : [],
        })),
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to bulk create treatment goals',
        error: error.message,
      })
    }
  }

  /**
   * Get goal progress data
   */
  async progress({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = params.id
      const startDate = request.input('startDate')
      const endDate = request.input('endDate')

      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'PARENT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .where('parentId', user.id)
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied',
          })
        }
      }

      // Get behavior data for this goal
      let behaviorQuery = BehaviorData.query()
        .where('goal_id', goal.id)
        .preload('session' as any)

      if (startDate) {
        behaviorQuery = behaviorQuery.whereHas('session' as any, (sessionQuery) => {
          sessionQuery.where('date', '>=', startDate)
        })
      }

      if (endDate) {
        behaviorQuery = behaviorQuery.whereHas('session' as any, (sessionQuery) => {
          sessionQuery.where('date', '<=', endDate)
        })
      }

      const behaviorData = await behaviorQuery
        .orderBy('created_at', 'asc')

      const progressData = behaviorData.map(data => ({
        date: data.session.date.toISODate(),
        percentage: data.percentage,
        correct: data.correct,
        incorrect: data.incorrect,
        prompted: data.prompted,
        total: data.total,
      }))

      return response.json({
        data: {
          goal: {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            targetBehavior: goal.targetBehavior,
            measurementType: goal.measurementType,
            masteryCriteria: goal.masteryCriteria,
            status: goal.status,
          },
          progressData,
          summary: {
            totalSessions: progressData.length,
            averagePercentage: progressData.length > 0 
              ? Math.round(progressData.reduce((sum, data) => sum + data.percentage, 0) / progressData.length)
              : 0,
            trend: progressData.length >= 2 
              ? (progressData[progressData.length - 1].percentage > progressData[0].percentage ? 'improving' : 'declining')
              : 'stable',
          },
        },
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch goal progress',
        error: error.message,
      })
    }
  }
}