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
      'abuse',
      'bcm-data-hub',
      'apiportal',
      'osm',
      'agent-registry',
      'agent-discovery',
      'apex',
      'workload-telemetry',
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
      { service: 'abuse', category: 'security-identity-and-compliance' },
      { service: 'bcm-data-hub', category: 'cloud-financial-management' },
      { service: 'apiportal', category: 'networking-and-content-delivery' },
      { service: 'osm', category: 'analytics' },
      { service: 'agent-registry', category: 'machine-learning-and-ai' },
      { service: 'agent-discovery', category: 'machine-learning-and-ai' },
      { service: 'apex', category: 'security-identity-and-compliance' },
      { service: 'workload-telemetry', category: 'security-identity-and-compliance' },
      { service: 'assurance', category: 'security-identity-and-compliance' },
      { service: 'continuum', category: 'developer-tools' },
      { service: 'end-user-messaging', category: 'business-applications' },
      { service: 'network-security-manager', category: 'security-identity-and-compliance' },
      { service: 'startups', category: 'management-and-governance' }
    ])
  })
})
