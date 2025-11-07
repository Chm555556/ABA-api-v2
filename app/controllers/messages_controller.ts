import type { HttpContext } from '@adonisjs/core/http'
import Message from '#models/message'
import User from '#models/user'
import Client from '#models/client'

export default class MessagesController {
  /**
   * Get messages for current user
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const unreadOnly = request.input('unreadOnly', false)
      const urgent = request.input('urgent', false)

      let query = Message.query()
        .where((builder) => {
          builder
            .where('from_user_id', user.id)
            .orWhere('to_user_id', user.id)
        })
        .preload('fromUser')
        .preload('toUser')
        .preload('client')

      if (unreadOnly === 'true') {
        query = query.where('to_user_id', user.id).where('is_read', false)
      }

      if (urgent === 'true') {
        query = query.where('priority', 'high')
      }

      const messages = await query
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
   * Send a new message
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { toUserId, clientId, subject, content, priority } = request.only([
        'toUserId',
        'clientId',
        'subject',
        'content',
        'priority',
      ])

      // Verify recipient exists
      const recipient = await User.findOrFail(toUserId)

      const message = await Message.create({
        fromUserId: user.id,
        toUserId: recipient.id,
        clientId: clientId || null,
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
  async markAsRead({ auth, params, response }: HttpContext) {
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
   * Get unread message count
   */
  async unreadCount({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const count = await Message.query()
        .where('to_user_id', user.id)
        .where('is_read', false)
        .count('* as total')

      return response.json({
        count: count[0].$extras.total,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to get unread count',
        error: error.message,
      })
    }
  }
}