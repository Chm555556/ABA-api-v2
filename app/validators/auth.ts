import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
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
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(1),
  })
)