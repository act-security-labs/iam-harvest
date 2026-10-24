import { describe, expect, it } from 'vitest'
import { getConditionKeyPattern, getConditionKeyVariants } from './conditionKeyPatterns.js'

describe('getConditionKeyPattern', () => {
  it('maps the exact Secrets Manager literal placeholder to its dynamic pattern', () => {
    //Given the literal placeholder documented by AWS Secrets Manager
    const conditionKey = 'secretsmanager:ResourceTag/tag-key'

    //When a condition-key pattern is resolved
    const result = getConditionKeyPattern(conditionKey)

    //Then the curated dynamic pattern and template are returned
    expect(result).toEqual({
      servicePrefix: 'secretsmanager',
      pattern: 'secretsmanager:ResourceTag/.+?',
      template: 'secretsmanager:ResourceTag/${TagKey}'
    })
  })

  it('maps the exact Glacier trailing-slash placeholder to its dynamic pattern', () => {
    //Given the literal placeholder documented by AWS Glacier
    const conditionKey = 'glacier:ResourceTag/'

    //When a condition-key pattern is resolved
    const result = getConditionKeyPattern(conditionKey)

    //Then the curated dynamic pattern and template are returned
    expect(result).toEqual({
      servicePrefix: 'glacier',
      pattern: 'glacier:ResourceTag/.+?',
      template: 'glacier:ResourceTag/${TagKey}'
    })
  })

  it('adds canonical metadata while retaining the documented literal', () => {
    //Given the literal Secrets Manager condition-key metadata
    const conditionKey = {
      key: 'secretsmanager:ResourceTag/tag-key',
      description: 'Filters access by a tag key and value pair',
      type: 'String'
    }

    //When canonical condition-key variants are generated
    const result = getConditionKeyVariants(conditionKey)

    //Then both the documented literal and dynamic canonical key are available
    expect(result).toEqual([
      conditionKey,
      {
        ...conditionKey,
        key: 'secretsmanager:ResourceTag/${TagKey}'
      }
    ])
  })

  it('does not duplicate already canonical dynamic metadata', () => {
    //Given a condition key that already uses documented dynamic syntax
    const conditionKey = {
      key: 'iam:ResourceTag/${TagKey}',
      description: 'Filters access by tag key-value pairs',
      type: 'String'
    }

    //When canonical condition-key variants are generated
    const result = getConditionKeyVariants(conditionKey)

    //Then the existing canonical metadata is returned once
    expect(result).toEqual([conditionKey])
  })

  it('preserves dynamic condition-key service-prefix casing', () => {
    //Given a documented dynamic key whose service prefix contains variables
    const conditionKey = 'agent.${Domain}.buildkite.dev:build_branch'

    //When a condition-key pattern is resolved
    const result = getConditionKeyPattern(conditionKey)

    //Then the generated index key preserves the documented service prefix
    expect(result).toEqual({
      servicePrefix: 'agent.${Domain}.buildkite.dev',
      pattern: 'agent..+?.buildkite.dev:build_branch',
      template: conditionKey
    })
  })

  it('does not infer dynamic patterns from similar static keys', () => {
    //Given condition keys that do not exactly match the curated literal
    const conditionKeys = [
      'glacier:ResourceTag',
      'secretsmanager:ResourceTag/tag-Key',
      'SecretsManager:ResourceTag/tag-key',
      'example:ResourceTag/tag-key'
    ]

    //When condition-key patterns are resolved
    const results = conditionKeys.map((conditionKey) => getConditionKeyPattern(conditionKey))

    //Then no heuristic dynamic patterns are created
    expect(results).toEqual([undefined, undefined, undefined, undefined])
  })

  it('preserves documented service-specific dynamic key syntaxes', () => {
    //Given documented dynamic condition keys
    const dollarSyntax = 'iam:ResourceTag/${TagKey}'
    const angleSyntax = 's3:ExistingObjectTag/<key>'

    //When condition-key patterns are resolved
    const dollarResult = getConditionKeyPattern(dollarSyntax)
    const angleResult = getConditionKeyPattern(angleSyntax)

    //Then their existing pattern behavior is preserved
    expect(dollarResult).toEqual({
      servicePrefix: 'iam',
      pattern: 'iam:ResourceTag/.+?',
      template: dollarSyntax
    })
    expect(angleResult).toEqual({
      servicePrefix: 's3',
      pattern: 's3:ExistingObjectTag/.+?',
      template: angleSyntax
    })
  })

  it('excludes AWS global dynamic condition keys', () => {
    //Given an AWS global dynamic condition key
    const conditionKey = 'aws:ResourceTag/${TagKey}'

    //When a condition-key pattern is resolved
    const result = getConditionKeyPattern(conditionKey)

    //Then it is excluded from the service-specific pattern index
    expect(result).toBeUndefined()
  })
})
