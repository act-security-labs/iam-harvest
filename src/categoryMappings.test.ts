import { describe, expect, it } from 'vitest'
import { serviceCategoryOverrides } from './categoryMappings.js'

describe('serviceCategoryOverrides', () => {
  it('maps AWS service prefixes that are not listed in AWS Overview topics', () => {
    //Given new IAM service prefixes discovered by Service Authorization Reference
    const servicesMissingFromAwsOverview = ['account-access', 'agent-registry']

    //When the category overrides are checked
    const categoriesByService = servicesMissingFromAwsOverview.map((service) => ({
      service,
      category: serviceCategoryOverrides[service]
    }))

    //Then each service has an explicit category assignment
    expect(categoriesByService).toEqual([
      { service: 'account-access', category: 'security-identity-and-compliance' },
      { service: 'agent-registry', category: 'machine-learning-and-ai' }
    ])
  })
})
