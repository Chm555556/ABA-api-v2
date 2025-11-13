import vine from '@vinejs/vine'

// --- Normalizer helper ------------------------------------------------------
function normalizeKeys(data: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const k in data) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = data[k]
  }
  return out
}

// --- Validators --------------------------------------------------------------
export const createClientValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(2).maxLength(100),
    lastName: vine.string().trim().minLength(2).maxLength(100),
    dateOfBirth: vine.date({ formats: ['YYYY-MM-DD'] }),
    phone: vine.string().optional(),
    email: vine.string().email().optional(),
    insuranceType: vine.enum(['insurance', 'private', 'regional']),
    insuranceId: vine.string().optional(),
    assignedBcba: vine.number().optional(),
    diagnosis: vine.array(vine.string()).optional(),
    // Make address fields optional for now
    street: vine.string().optional(),
    city: vine.string().optional(),
    state: vine.string().optional(),
    zipCode: vine.string().optional(),
    emergencyContactName: vine.string().optional(),
    emergencyContactRelationship: vine.string().optional(),
    emergencyContactPhone: vine.string().optional(),
    insurancePolicyNumber: vine.string().optional(),
  })
)

export const createScheduleValidator = vine.compile(
  vine.object({
    clientId: vine.number(),
    rbtId: vine.number(),
    bcbaId: vine.number(),
    date: vine.string(), // Accept as string, we'll parse it in the controller
    startTime: vine.string(),
    endTime: vine.string(),
    location: vine.string().optional(),
    notes: vine.string().optional(),
  })
)

// --- Wrapper used by controller ---------------------------------------------
export async function validateWithNormalizer(request: any, validator: any) {
  const normalized = normalizeKeys(request.all())
  return await request.validateUsing(validator, { data: normalized })
}
