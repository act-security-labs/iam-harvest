import type { ConditionKey } from '../util/serviceDefinition.js'

/**
 * Defines a curated dynamic condition-key representation for an AWS-documented literal key.
 */
interface DynamicConditionKeyOverride {
  pattern: string
  template: string
}

/**
 * Represents one service-specific dynamic condition-key pattern for generated data.
 */
export interface ConditionKeyPattern {
  servicePrefix: string
  pattern: string
  template: string
}

/**
 * Maps AWS-documented literal condition keys to their canonical dynamic representations.
 *
 * Entries intentionally use exact, case-sensitive source keys so a documentation inconsistency
 * never causes unrelated condition keys to be treated as dynamic.
 */
const dynamicConditionKeyOverrides: Record<string, DynamicConditionKeyOverride> = {
  'glacier:ResourceTag/': {
    pattern: 'glacier:ResourceTag/.+?',
    template: 'glacier:ResourceTag/${TagKey}'
  },
  'secretsmanager:ResourceTag/tag-key': {
    pattern: 'secretsmanager:ResourceTag/.+?',
    template: 'secretsmanager:ResourceTag/${TagKey}'
  }
}

/**
 * Converts a service-specific dynamic condition key into its generated pattern representation.
 *
 * @param conditionKey AWS-documented condition key
 * @returns the service prefix, pattern, and canonical template when the key is dynamic; otherwise undefined
 */
export function getConditionKeyPattern(conditionKey: string): ConditionKeyPattern | undefined {
  const override = dynamicConditionKeyOverrides[conditionKey]
  const template = override?.template ?? conditionKey
  const hasDollarVariable = template.includes('${')
  const hasAngleVariable = template.includes('<')

  if ((!hasDollarVariable && !hasAngleVariable) || template.startsWith('aws:')) {
    return undefined
  }

  if (override) {
    return {
      servicePrefix: conditionKey.split(':')[0],
      pattern: override.pattern,
      template: override.template
    }
  }

  const parts = template.split('$')
  if (parts.length > 2) {
    throw new Error(`Unexpected format for key: ${template}`)
  }

  return {
    servicePrefix: conditionKey.split(':')[0],
    pattern: template.replace(/\$\{.*\}/, '.+?').replace(/<.*>/, '.+?'),
    template
  }
}

/**
 * Returns the documented condition-key metadata and its canonical dynamic variant when curated.
 *
 * @param conditionKey AWS-documented condition-key metadata
 * @returns the documented condition key followed by any canonical dynamic variant
 */
export function getConditionKeyVariants(conditionKey: ConditionKey): ConditionKey[] {
  const pattern = getConditionKeyPattern(conditionKey.key)
  if (!pattern || pattern.template === conditionKey.key) {
    return [conditionKey]
  }

  return [conditionKey, { ...conditionKey, key: pattern.template }]
}
