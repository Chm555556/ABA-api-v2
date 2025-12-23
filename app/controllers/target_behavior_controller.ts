import type { HttpContext } from '@adonisjs/core/http'
import TargetBehavior from '#models/target_behavior'
import TreatmentGoal from '#models/treatment_goal'
import Client from '#models/client'
import { DateTime } from 'luxon'

export default class TargetBehaviorController {
  /**
   * Get target behaviors for a treatment goal
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = request.input('goalId')

      if (!goalId) {
        return response.status(400).json({
          message: 'Goal ID is required',
        })
      }

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions based on user role
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      if (user.role === 'PARENT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .where('parentId', user.id)
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Get target behaviors for this goal
      const targetBehaviors = await TargetBehavior.query()
        .where('goalId', goalId)
        .preload('creator')
        .orderBy('createdAt', 'asc')

      return response.json({
        data: targetBehaviors.map(behavior => ({
          id: behavior.id,
          goalId: behavior.goalId,
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
          updatedAt: behavior.updatedAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch target behaviors',
        error: error.message,
      })
    }
  }

  /**
   * Create new target behavior
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        goalId,
        name,
        description,
        baselinePercentage,
        intensity,
        notes,
      } = request.only([
        'goalId',
        'name',
        'description',
        'baselinePercentage',
        'intensity',
        'notes',
      ])

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions based on user role
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Create target behavior
      const targetBehavior = await TargetBehavior.create({
        goalId,
        name,
        description,
        baselinePercentage: baselinePercentage ? parseFloat(baselinePercentage) : null,
        intensity: intensity || 'moderate',
        notes,
        status: 'active',
        createdBy: user.id,
      })

      await targetBehavior.load('creator')

      return response.status(201).json({
        message: 'Target behavior created successfully',
        data: {
          id: targetBehavior.id,
          goalId: targetBehavior.goalId,
          name: targetBehavior.name,
          description: targetBehavior.description,
          baselinePercentage: targetBehavior.baselinePercentage,
          intensity: targetBehavior.intensity,
          notes: targetBehavior.notes,
          status: targetBehavior.status,
          currentPercentage: targetBehavior.currentPercentage,
          masteryDate: targetBehavior.masteryDate?.toISODate() || null,
          createdBy: targetBehavior.createdBy,
          creatorName: targetBehavior.creator?.name || null,
          createdAt: targetBehavior.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create target behavior',
        error: error.message,
      })
    }
  }

  /**
   * Bulk create target behaviors
   */
  async bulkStore({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { goalId, targetBehaviors } = request.only(['goalId', 'targetBehaviors'])

      if (!Array.isArray(targetBehaviors) || targetBehaviors.length === 0) {
        return response.status(400).json({
          message: 'Target behaviors array is required and must not be empty',
        })
      }

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      // Create all target behaviors
      const createdBehaviors = []
      for (const behaviorData of targetBehaviors) {
        const targetBehavior = await TargetBehavior.create({
          goalId,
          name: behaviorData.name,
          description: behaviorData.description,
          baselinePercentage: behaviorData.baselinePercentage ? parseFloat(behaviorData.baselinePercentage) : null,
          intensity: behaviorData.intensity || 'moderate',
          notes: behaviorData.notes,
          status: 'active',
          createdBy: user.id,
        })

        await targetBehavior.load('creator')
        createdBehaviors.push(targetBehavior)
      }

      return response.status(201).json({
        message: `${createdBehaviors.length} target behaviors created successfully`,
        data: createdBehaviors.map(behavior => ({
          id: behavior.id,
          goalId: behavior.goalId,
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
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to bulk create target behaviors',
        error: error.message,
      })
    }
  }

  /**
   * Update target behavior
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const behaviorId = params.id
      const updates = request.only([
        'name',
        'description',
        'baselinePercentage',
        'intensity',
        'notes',
        'status',
        'currentPercentage',
        'masteryDate',
      ])

      // Get target behavior and verify access
      const targetBehavior = await TargetBehavior.findOrFail(behaviorId)
      const goal = await TreatmentGoal.query()
        .where('id', targetBehavior.goalId)
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

      if (user.role === 'RBT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied',
          })
        }
      }

      // Update target behavior
      if (updates.baselinePercentage) updates.baselinePercentage = parseFloat(updates.baselinePercentage)
      if (updates.currentPercentage) updates.currentPercentage = parseFloat(updates.currentPercentage)
      if (updates.masteryDate) updates.masteryDate = DateTime.fromISO(updates.masteryDate)

      targetBehavior.merge(updates)
      await targetBehavior.save()

      await targetBehavior.load('creator')

      return response.json({
        message: 'Target behavior updated successfully',
        data: {
          id: targetBehavior.id,
          goalId: targetBehavior.goalId,
          name: targetBehavior.name,
          description: targetBehavior.description,
          baselinePercentage: targetBehavior.baselinePercentage,
          intensity: targetBehavior.intensity,
          notes: targetBehavior.notes,
          status: targetBehavior.status,
          currentPercentage: targetBehavior.currentPercentage,
          masteryDate: targetBehavior.masteryDate?.toISODate() || null,
          createdBy: targetBehavior.createdBy,
          creatorName: targetBehavior.creator?.name || null,
          updatedAt: targetBehavior.updatedAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update target behavior',
        error: error.message,
      })
    }
  }

  /**
   * Delete target behavior
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const behaviorId = params.id

      // Get target behavior and verify access
      const targetBehavior = await TargetBehavior.findOrFail(behaviorId)
      const goal = await TreatmentGoal.query()
        .where('id', targetBehavior.goalId)
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

      await targetBehavior.delete()

      return response.json({
        message: 'Target behavior deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to delete target behavior',
        error: error.message,
      })
    }
  }

  /**
   * Get target behavior statistics for a goal
   */
  async statistics({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = request.input('goalId')

      if (!goalId) {
        return response.status(400).json({
          message: 'Goal ID is required',
        })
      }

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions (same as index method)
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      if (user.role === 'PARENT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .where('parentId', user.id)
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Get target behaviors for statistics
      const targetBehaviors = await TargetBehavior.query()
        .where('goalId', goalId)

      if (targetBehaviors.length === 0) {
        return response.json({
          data: {
            total: 0,
            byIntensity: { low: 0, moderate: 0, high: 0, severe: 0 },
            byStatus: { active: 0, mastered: 0, discontinued: 0, on_hold: 0 },
            averageBaseline: null,
            averageCurrent: null,
          },
        })
      }

      // Calculate statistics
      const byIntensity = {
        low: targetBehaviors.filter(b => b.intensity === 'low').length,
        moderate: targetBehaviors.filter(b => b.intensity === 'moderate').length,
        high: targetBehaviors.filter(b => b.intensity === 'high').length,
        severe: targetBehaviors.filter(b => b.intensity === 'severe').length,
      }

      const byStatus = {
        active: targetBehaviors.filter(b => b.status === 'active').length,
        mastered: targetBehaviors.filter(b => b.status === 'mastered').length,
        discontinued: targetBehaviors.filter(b => b.status === 'discontinued').length,
        on_hold: targetBehaviors.filter(b => b.status === 'on_hold').length,
      }

      const behaviorsWithBaseline = targetBehaviors.filter(b => b.baselinePercentage !== null)
      const averageBaseline = behaviorsWithBaseline.length > 0
        ? behaviorsWithBaseline.reduce((sum, b) => sum + b.baselinePercentage!, 0) / behaviorsWithBaseline.length
        : null

      const behaviorsWithCurrent = targetBehaviors.filter(b => b.currentPercentage !== null)
      const averageCurrent = behaviorsWithCurrent.length > 0
        ? behaviorsWithCurrent.reduce((sum, b) => sum + b.currentPercentage!, 0) / behaviorsWithCurrent.length
        : null

      return response.json({
        data: {
          total: targetBehaviors.length,
          byIntensity,
          byStatus,
          averageBaseline: averageBaseline ? Math.round(averageBaseline * 100) / 100 : null,
          averageCurrent: averageCurrent ? Math.round(averageCurrent * 100) / 100 : null,
        },
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch target behavior statistics',
        error: error.message,
      })
    }
  }
}