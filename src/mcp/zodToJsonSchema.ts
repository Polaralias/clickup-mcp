import { z } from "zod"

const { ZodFirstPartyTypeKind } = z

type JsonSchema = Record<string, unknown>

type ConversionResult = {
  schema: JsonSchema
  required: boolean
}

type Unwrapped = {
  schema: z.ZodTypeAny
  optional: boolean
  defaultValue: unknown
}

function unwrapSchema(schema: z.ZodTypeAny): Unwrapped {
  let current: z.ZodTypeAny = schema
  let optional = false
  let defaultValue: unknown = undefined

  while (true) {
    const typeName = (current as any)._def.typeName as string
    switch (typeName) {
      case ZodFirstPartyTypeKind.ZodOptional: {
        optional = true
        current = (current as z.ZodOptional<any>)._def.innerType
        continue
      }
      case ZodFirstPartyTypeKind.ZodDefault: {
        optional = true
        const def = (current as z.ZodDefault<any>)._def.defaultValue()
        defaultValue = def
        current = (current as z.ZodDefault<any>)._def.innerType
        continue
      }
      case ZodFirstPartyTypeKind.ZodEffects: {
        current = (current as z.ZodEffects<any>)._def.schema
        continue
      }
      case ZodFirstPartyTypeKind.ZodBranded: {
        current = (current as z.ZodBranded<any, any>)._def.type
        continue
      }
      case ZodFirstPartyTypeKind.ZodPipeline: {
        current = (current as z.ZodPipeline<any, any>)._def.out
        continue
      }
      default:
        return { schema: current, optional, defaultValue }
    }
  }
}

function addDefault(target: JsonSchema, value: unknown) {
  if (value !== undefined) {
    target.default = value
  }
}

function withNullability(base: JsonSchema): JsonSchema {
  if (base.type) {
    if (Array.isArray(base.type)) {
      if (!base.type.includes("null")) {
        base.type = [...base.type, "null"]
      }
    } else if (base.type !== "null") {
      base.type = [base.type as string, "null"]
    }
    return base
  }

  if (base.anyOf) {
    base.anyOf = [...(base.anyOf as JsonSchema[]), { type: "null" }]
    return base
  }

  return {
    anyOf: [base, { type: "null" }]
  }
}

function fromString(schema: z.ZodString): JsonSchema {
  const result: JsonSchema = { type: "string" }
  for (const check of schema._def.checks) {
    switch (check.kind) {
      case "min":
        result.minLength = check.value
        break
      case "max":
        result.maxLength = check.value
        break
      case "regex":
        result.pattern = check.regex.source
        break
      case "email":
        result.format = "email"
        break
      case "url":
        result.format = "uri"
        break
      case "uuid":
        result.format = "uuid"
        break
      case "datetime":
        result.format = "date-time"
        break
      case "ip":
        result.format = "ip"
        break
      case "cuid":
      case "cuid2":
        result.format = "cuid"
        break
      case "startsWith":
      case "endsWith":
      case "includes":
        // These checks provide guidance but no compact schema equivalent
        break
      default:
        break
    }
  }
  return result
}

function fromNumber(schema: z.ZodNumber): JsonSchema {
  const result: JsonSchema = { type: "number" }
  let isInteger = false
  for (const check of schema._def.checks) {
    switch (check.kind) {
      case "min":
        result.minimum = check.value
        if (!check.inclusive) {
          result.exclusiveMinimum = check.value
        }
        break
      case "max":
        result.maximum = check.value
        if (!check.inclusive) {
          result.exclusiveMaximum = check.value
        }
        break
      case "int":
        isInteger = true
        break
      case "multipleOf":
        result.multipleOf = check.value
        break
      default:
        break
    }
  }
  if (isInteger) {
    result.type = "integer"
  }
  return result
}

function fromBoolean(): JsonSchema {
  return { type: "boolean" }
}

function fromArray(schema: z.ZodArray<any>): JsonSchema {
  const result: JsonSchema = {
    type: "array",
    items: convertSchema(schema._def.type).schema
  }
  if (schema._def.minLength !== null) {
    result.minItems = schema._def.minLength.value
  }
  if (schema._def.maxLength !== null) {
    result.maxItems = schema._def.maxLength.value
  }
  return result
}

function fromLiteral(schema: z.ZodLiteral<any>): JsonSchema {
  const value = schema._def.value
  const literalSchema: JsonSchema = { const: value }
  const valueType = typeof value
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    literalSchema.type = valueType
  }
  return literalSchema
}

function fromEnum(schema: z.ZodEnum<[string, ...string[]]> | z.ZodNativeEnum<any>): JsonSchema {
  const values = Array.isArray(schema._def.values)
    ? (schema._def.values as string[])
    : (Object.values(schema._def.values).filter((value) => typeof value === "string" || typeof value === "number") as (string | number)[])

  const types = new Set(values.map((value) => typeof value))
  let type: string | string[] | undefined
  if (types.size === 1) {
    type = types.values().next().value as string
    if (type === "number") {
      type = "number"
    }
  } else {
    type = Array.from(types) as string[]
  }

  const schemaResult: JsonSchema = { enum: values }
  if (type) {
    schemaResult.type = type
  }
  return schemaResult
}

function fromUnion(schema: z.ZodUnion<any>): JsonSchema {
  return {
    anyOf: schema._def.options.map((option: z.ZodTypeAny) => convertSchema(option).schema)
  }
}

function fromIntersection(schema: z.ZodIntersection<any, any>): JsonSchema {
  return {
    allOf: [convertSchema(schema._def.left).schema, convertSchema(schema._def.right).schema]
  }
}

function fromRecord(schema: z.ZodRecord<any, any>): JsonSchema {
  return {
    type: "object",
    additionalProperties: convertSchema(schema._def.valueType).schema
  }
}

function fromObject(schema: z.ZodObject<any, any, any, any>): JsonSchema {
  const shape = schema._def.shape()
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [key, valueSchema] of Object.entries(shape)) {
    const converted = convertSchema(valueSchema as z.ZodTypeAny)
    properties[key] = converted.schema
    if (converted.required) {
      required.push(key)
    }
  }

  const objectSchema: JsonSchema = {
    type: "object",
    properties
  }

  if (required.length > 0) {
    objectSchema.required = required
  }

  const catchall = schema._def.catchall
  if (catchall && (catchall as any)._def.typeName !== ZodFirstPartyTypeKind.ZodNever) {
    objectSchema.additionalProperties = convertSchema(catchall).schema
  } else if (schema._def.unknownKeys === "passthrough") {
    objectSchema.additionalProperties = true
  } else if (schema._def.unknownKeys === "strict") {
    objectSchema.additionalProperties = false
  }

  return objectSchema
}

function convertSchema(schema: z.ZodTypeAny): ConversionResult {
  const { schema: unwrapped, optional, defaultValue } = unwrapSchema(schema)
  const typeName = (unwrapped as any)._def.typeName as string
  let jsonSchema: JsonSchema

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      jsonSchema = fromString(unwrapped as z.ZodString)
      break
    case ZodFirstPartyTypeKind.ZodNumber:
      jsonSchema = fromNumber(unwrapped as z.ZodNumber)
      break
    case ZodFirstPartyTypeKind.ZodArray:
      jsonSchema = fromArray(unwrapped as z.ZodArray<any>)
      break
    case ZodFirstPartyTypeKind.ZodLiteral:
      jsonSchema = fromLiteral(unwrapped as z.ZodLiteral<any>)
      break
    case ZodFirstPartyTypeKind.ZodEnum:
    case ZodFirstPartyTypeKind.ZodNativeEnum:
      jsonSchema = fromEnum(unwrapped as any)
      break
    case ZodFirstPartyTypeKind.ZodUnion:
      jsonSchema = fromUnion(unwrapped as z.ZodUnion<any>)
      break
    case ZodFirstPartyTypeKind.ZodIntersection:
      jsonSchema = fromIntersection(unwrapped as z.ZodIntersection<any, any>)
      break
    case ZodFirstPartyTypeKind.ZodObject:
      jsonSchema = fromObject(unwrapped as z.ZodObject<any>)
      break
    case ZodFirstPartyTypeKind.ZodRecord:
      jsonSchema = fromRecord(unwrapped as z.ZodRecord<any, any>)
      break
    case ZodFirstPartyTypeKind.ZodDate:
      jsonSchema = { type: "string", format: "date-time" }
      break
    case ZodFirstPartyTypeKind.ZodBigInt:
      jsonSchema = { type: "integer" }
      break
    case ZodFirstPartyTypeKind.ZodBoolean:
      jsonSchema = fromBoolean()
      break
    case ZodFirstPartyTypeKind.ZodNull:
      jsonSchema = { type: "null" }
      break
    case ZodFirstPartyTypeKind.ZodAny:
    case ZodFirstPartyTypeKind.ZodUnknown:
      jsonSchema = {}
      break
    case ZodFirstPartyTypeKind.ZodNever:
      jsonSchema = { not: {} }
      break
    case ZodFirstPartyTypeKind.ZodMap:
      jsonSchema = { type: "object" }
      break
    case ZodFirstPartyTypeKind.ZodSet:
      jsonSchema = {
        type: "array",
        items: convertSchema((unwrapped as z.ZodSet<any>)._def.valueType).schema,
        uniqueItems: true
      }
      break
    case ZodFirstPartyTypeKind.ZodTuple:
      jsonSchema = {
        type: "array",
        items: (unwrapped as z.ZodTuple<any>)._def.items.map((item: z.ZodTypeAny) => convertSchema(item).schema),
        minItems: (unwrapped as z.ZodTuple<any>)._def.items.length,
        maxItems: (unwrapped as z.ZodTuple<any>)._def.items.length
      }
      break
    case ZodFirstPartyTypeKind.ZodNullable: {
      const inner = convertSchema((unwrapped as z.ZodNullable<any>)._def.innerType)
      jsonSchema = withNullability(inner.schema)
      addDefault(jsonSchema, defaultValue)
      return {
        schema: jsonSchema,
        required: inner.required && !optional
      }
    }
    default:
      jsonSchema = {}
      break
  }

  addDefault(jsonSchema, defaultValue)

  return {
    schema: jsonSchema,
    required: !optional
  }
}

export function zodToJsonSchemaCompact(schema: z.ZodTypeAny | null): JsonSchema | undefined {
  if (!schema) {
    return undefined
  }

  const { schema: converted } = convertSchema(schema)

  return converted
}
