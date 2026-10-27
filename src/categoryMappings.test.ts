import { describe, expect, it } from 'vitest'
import { serviceCategoryOverrides } from './categoryMappings.js'

describe('serviceCategoryOverrides', () => {
  it('does not map the retired CodeStar service while retaining its distinct services', () => {
    //Given the current IAM service prefixes no longer include codestar
    //When checking the related category overrides
    //Then only the distinct CodeStar services remain mapped
    expect(serviceCategoryOverrides).not.toHaveProperty('codestar')
    expect(serviceCategoryOverrides['codestar-connections']).toBe('developer-tools')
    expect(serviceCategoryOverrides['codestar-notifications']).toBe('management-and-governance')
  })

  it('maps AWS service prefixes that are not listed in AWS Overview topics', () => {
    //Given new IAM service prefixes discovered by Service Authorization Reference
    const servicesMissingFromAwsOverview = [
      'account-access',
      'agent-registry',
      'assurance',
      'continuum',
      'end-user-messaging',
      'network-security-manager',
      'startups'
    ]

    //When the category overrides are checked
    const categoriesByService = servicesMissingFromAwsOverview.map((service) => ({
      service,
      category: serviceCategoryOverrides[service]
    }))

    //Then each service has an explicit category assignment
    expect(categoriesByService).toEqual([
      { service: 'account-access', category: 'security-identity-and-compliance' },
      { service: 'agent-registry', category: 'machine-learning-and-ai' },
      { service: 'assurance', category: 'security-identity-and-compliance' },
      { service: 'continuum', category: 'developer-tools' },
      { service: 'end-user-messaging', category: 'business-applications' },
      { service: 'network-security-manager', category: 'security-identity-and-compliance' },
      { service: 'startups', category: 'management-and-governance' }
    ])
  })
})
