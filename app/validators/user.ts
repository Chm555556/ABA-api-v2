import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(8).maxLength(100),
    role: vine.enum(['ADMIN', 'CLINIC', 'BCBA', 'RBT', 'PARENT']),
    clinicId: vine.number().optional(),
    supervisorId: vine.number().optional(),
    hourlyRate: vine.number().optional(),
    phone: vine.string().trim().optional(),
    address: vine.string().trim().optional(),
    permissions: vine.array(vine.string()).optional(),
    verified: vine.boolean().optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100).optional(),
    email: vine.string().trim().email().normalizeEmail().optional(),
    password: vine.string().minLength(8).maxLength(100).optional(),
    role: vine.enum(['ADMIN', 'CLINIC', 'BCBA', 'RBT', 'PARENT']).optional(),
    clinicId: vine.number().optional(),
    supervisorId: vine.number().optional(),
    hourlyRate: vine.number().optional(),
    phone: vine.string().trim().optional(),
    address: vine.string().trim().optional(),
    permissions: vine.array(vine.string()).optional(),
    verified: vine.boolean().optional(),
    isActive: vine.boolean().optional(),
  })
)