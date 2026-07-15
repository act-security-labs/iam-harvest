import { type AwsCategoryLink } from '../util/categoryDefinition.js'

const explicitCategoryKeys: Record<string, string> = {
  Analytics: 'analytics',
  'Application integration': 'application-integration',
  Blockchain: 'blockchain',
  'Business applications': 'business-applications',
  'Cloud Financial Management': 'cloud-financial-management',
  Compute: 'compute',
  'Customer enablement': 'customer-enablement',
  Containers: 'containers',
  Databases: 'databases',
  'Developer tools': 'developer-tools',
  'End user computing': 'end-user-computing',
  'Front-end web and mobile': 'front-end-web-and-mobile',
  'Game tech': 'game-tech',
  'Internet of Things (IoT)': 'internet-of-things',
  'Machine Learning (ML) and Artificial Intelligence (AI)': 'machine-learning-and-ai',
  'Management and governance': 'management-and-governance',
  Media: 'media',
  'Migration and transfer': 'migration-and-transfer',
  'Networking and content delivery': 'networking-and-content-delivery',
  'Quantum technologies': 'quantum-technologies',
  Satellite: 'satellite',
  'Security, identity, and compliance': 'security-identity-and-compliance',
  Storage: 'storage'
}

/**
 * Normalize an AWS Overview topic or IAM service display name for exact matching.
 *
 * @param value the display value to normalize
 * @returns a lowercase alphanumeric-only normalized key
 */
export function normalizeServiceCategoryTopic(value: string): string {
  return value
    .replace(/\([^)]*\)/g, '')
    .replace(/&/g, 'and')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Derive a stable category key for a category name.
 *
 * @param categoryName the AWS Overview category display name
 * @returns the stable category key
 */
export function categoryKeyForName(categoryName: string): string {
  return (
    explicitCategoryKeys[categoryName] ??
    categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * Parse AWS Overview category links from the markdown category index.
 *
 * @param markdown the AWS Overview category index markdown
 * @returns the categories linked from the index in document order
 */
export function parseCategoryIndex(markdown: string): AwsCategoryLink[] {
  const categories: AwsCategoryLink[] = []
  const seenPaths = new Set<string>()
  const linkRegex = /\[([^\]]+)]\(([^)]+\.md)\)/g
  for (const match of markdown.matchAll(linkRegex)) {
    const name = match[1]
    const path = match[2]
    if (path === 'accessing-aws-services.md' || seenPaths.has(path)) {
      continue
    }
    seenPaths.add(path)
    categories.push({ key: categoryKeyForName(name), name, path })
  }
  return categories
}

/**
 * Parse service/topic display names from an AWS Overview category markdown page.
 *
 * @param markdown the AWS Overview category page markdown
 * @returns service/topic display names in document order
 */
export function parseCategoryServiceTopics(markdown: string): string[] {
  const topics = parseTopicsList(markdown)
  if (topics.length > 0) {
    return topics
  }

  return [...markdown.matchAll(/^#### \[\s*([^\]]+?)\s*]/gm)].map((match) => match[1].trim())
}

function parseTopicsList(markdown: string): string[] {
  const topics: string[] = []
  let inTopics = false

  for (const line of markdown.split('\n')) {
    if (line.trim() === '**Topics**') {
      inTopics = true
      continue
    }

    if (!inTopics) {
      continue
    }

    if (line.startsWith('Return to ')) {
      break
    }

    const topicMatch = line.match(/^\+ \[([^\]]+)]\(#[^)]+\)/)
    if (topicMatch) {
      topics.push(topicMatch[1])
    }
  }

  return topics
}
