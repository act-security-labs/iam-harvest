import { describe, expect, it } from 'vitest'
import {
  categoryKeyForName,
  normalizeServiceCategoryTopic,
  parseCategoryIndex,
  parseCategoryServiceTopics
} from './categories.js'

describe('categories parsing', () => {
  describe('parseCategoryIndex', () => {
    it('parses AWS Overview category links and skips non-category links', () => {
      //Given an AWS Overview markdown index snippet
      const markdown = `| ![icon](analytics-icon.jpg)[Analytics](analytics.md) | ![icon](iot-icon.jpg)[Internet of Things (IoT)](internet-of-things-services.md) |
To access the services, use the [AWS Management Console](accessing-aws-services.md#aws-management-console).
`

      //When the category index is parsed
      const result = parseCategoryIndex(markdown)

      //Then category links are returned with stable keys
      expect(result).toEqual([
        { key: 'analytics', name: 'Analytics', path: 'analytics.md' },
        {
          key: 'internet-of-things',
          name: 'Internet of Things (IoT)',
          path: 'internet-of-things-services.md'
        }
      ])
    })
  })

  describe('parseCategoryServiceTopics', () => {
    it('parses service entries from a topics list', () => {
      //Given a category page with a topics section
      const markdown = `**Topics**
+ [Amazon Athena](#amazon-athena)
+ [AWS Glue](#aws-glue)

Return to [AWS services](amazon-web-services-cloud-platform.md).

## Amazon Athena
`

      //When the category service topics are parsed
      const result = parseCategoryServiceTopics(markdown)

      //Then topics are returned in document order
      expect(result).toEqual(['Amazon Athena', 'AWS Glue'])
    })

    it('falls back to service heading links when no topics list exists', () => {
      //Given an older category page without a topics section
      const markdown = `# Blockchain

------
#### [ Amazon Managed Blockchain ]

Text.

------
#### [ AWS Ground Station ]
`

      //When the category service topics are parsed
      const result = parseCategoryServiceTopics(markdown)

      //Then heading link names are returned
      expect(result).toEqual(['Amazon Managed Blockchain', 'AWS Ground Station'])
    })
  })

  describe('categoryKeyForName', () => {
    it('uses curated stable keys for verbose category names', () => {
      //Given verbose AWS Overview category names
      //When category keys are derived
      const iotKey = categoryKeyForName('Internet of Things (IoT)')
      const mlKey = categoryKeyForName('Machine Learning (ML) and Artificial Intelligence (AI)')

      //Then curated ergonomic keys are returned
      expect(iotKey).toBe('internet-of-things')
      expect(mlKey).toBe('machine-learning-and-ai')
    })

    it('falls back to kebab-case keys for future category names', () => {
      //Given a future category name
      //When the category key is derived
      const result = categoryKeyForName('New & Future Category!')

      //Then the key is lowercase kebab-case
      expect(result).toBe('new-future-category')
      expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    })
  })

  describe('normalizeServiceCategoryTopic', () => {
    it('normalizes aliases and display names for exact matching', () => {
      //Given equivalent topic display variants
      //When they are normalized
      const first = normalizeServiceCategoryTopic(
        'Amazon Managed Streaming for Apache Kafka (Amazon MSK)'
      )
      const second = normalizeServiceCategoryTopic('Amazon Managed Streaming for Apache Kafka')

      //Then parenthetical suffixes are ignored
      expect(first).toBe(second)
    })
  })
})
