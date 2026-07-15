import { readdirSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { serviceCategoryOverrides, topicAliases, topicSkips } from './categoryMappings.js'
import {
  normalizeServiceCategoryTopic,
  parseCategoryIndex,
  parseCategoryServiceTopics
} from './parsing/categories.js'
import {
  actionsLocation,
  categoriesLocation,
  conditionKeysLocation,
  jsonDocsLocation,
  overviewMarkdownDownloadLocation,
  resourceTypesLocation,
  serviceInfoLocation
} from './util/consts.js'
import { type CategoryDetails } from './util/categoryDefinition.js'

/**
 * Takes the parsed JSON files and sorts them into a structure to publish.
 */

const files = readdirSync(jsonDocsLocation)

type Actions = Record<string, any>
type ResourceTypes = Record<string, any>
type ConditionKeys = Record<string, any>
type InfoByService = Record<
  string,
  {
    name: string
    prefix: string
    actions: Actions
    resourceTypes: ResourceTypes
    conditionKeys: ConditionKeys
  }
>

type UnassociatedConditionKeys = Record<string, string[]>
type ConditionPatterns = Record<string, Record<string, string>>
type ServiceCategoryIndex = Record<string, string>

function getInformationByService(): [InfoByService, UnassociatedConditionKeys, ConditionPatterns] {
  const infoByService: InfoByService = {}
  const unassociatedConditionKeys: UnassociatedConditionKeys = {}
  const conditionPatterns: ConditionPatterns = {}

  for (const file of files) {
    const fileContents = require(join(jsonDocsLocation, file))

    if (!fileContents.prefix || !fileContents.actions || fileContents.actions.length === 0) {
      continue
    }

    const servicePrefix = fileContents.prefix.toLowerCase()

    // Remove the service prefix from unassociated condition keys
    delete unassociatedConditionKeys[servicePrefix]

    infoByService[servicePrefix] ||= {
      name: fileContents.name,
      prefix: fileContents.prefix,
      actions: {},
      resourceTypes: {},
      conditionKeys: {}
    }

    for (const action of fileContents.actions || []) {
      infoByService[fileContents.prefix].actions[action.name.toLowerCase()] = action
    }
    for (const resourceType of fileContents.resourceTypes || []) {
      infoByService[fileContents.prefix].resourceTypes[resourceType.key.toLowerCase()] =
        resourceType
    }
    for (const conditionKey of fileContents.conditionKeys || []) {
      infoByService[fileContents.prefix].conditionKeys[conditionKey.key.toLowerCase()] =
        conditionKey
      const conditionPrefix = conditionKey.key.split(':')[0]
      if (
        conditionPrefix !== 'aws' &&
        conditionPrefix !== servicePrefix &&
        !infoByService[conditionPrefix]
      ) {
        if (!unassociatedConditionKeys[conditionPrefix]) {
          unassociatedConditionKeys[conditionPrefix] = []
        }
        if (!unassociatedConditionKeys[conditionPrefix].includes(servicePrefix)) {
          unassociatedConditionKeys[conditionPrefix].push(servicePrefix)
        }
      }

      const hasDollarVar = conditionKey.key.includes('${')
      const hasAngleVar = conditionKey.key.includes('<')
      if ((hasDollarVar || hasAngleVar) && !conditionKey.key.startsWith('aws:')) {
        const parts = conditionKey.key.split('$')
        if (parts.length > 2) {
          throw new Error(`Unexpected format for key: ${conditionKey.key}`)
        }
        if (!conditionPatterns[conditionPrefix]) {
          conditionPatterns[conditionPrefix] = {}
        }
        const pattern = conditionKey.key.replace(/\$\{.*\}/, '.+?').replace(/<.*>/, '.+?')
        conditionPatterns[conditionPrefix][pattern] = conditionKey.key
      }
    }
  }
  return [infoByService, unassociatedConditionKeys, conditionPatterns]
}

/**
 * Build category details and service-to-category indexes from AWS Overview markdown.
 *
 * @param infoByService generated IAM service information keyed by IAM service prefix
 * @returns generated category details and service-to-category index
 */
async function getCategoryInformation(infoByService: InfoByService): Promise<{
  categories: CategoryDetails[]
  serviceCategories: ServiceCategoryIndex
}> {
  const indexMarkdown = await readFile(
    join(overviewMarkdownDownloadLocation, 'amazon-web-services-cloud-platform.md'),
    'utf8'
  )
  const categories = parseCategoryIndex(indexMarkdown)
  const categoryKeys = new Set(categories.map((category) => category.key))
  const servicesByNormalizedName = getServicesByNormalizedName(infoByService)
  const servicesByCategory = new Map<string, Set<string>>()
  const serviceCategories: ServiceCategoryIndex = {}

  for (const category of categories) {
    servicesByCategory.set(category.key, new Set<string>())
    const markdown = await readFile(join(overviewMarkdownDownloadLocation, category.path), 'utf8')
    const topics = parseCategoryServiceTopics(markdown)

    for (const topic of topics) {
      const normalizedTopic = normalizeServiceCategoryTopic(topic)
      if (topicSkips.has(normalizedTopic)) {
        continue
      }

      const services =
        topicAliases[normalizedTopic] ?? servicesByNormalizedName[normalizedTopic] ?? []
      for (const service of services) {
        if (serviceCategoryOverrides[service]) {
          continue
        }
        addServiceToCategory(
          service,
          category.key,
          infoByService,
          servicesByCategory,
          serviceCategories
        )
      }
    }
  }

  for (const [service, category] of Object.entries(serviceCategoryOverrides)) {
    if (!categoryKeys.has(category)) {
      throw new Error(
        `Service category override for ${service} references unknown category ${category}`
      )
    }
    addServiceToCategory(
      service,
      category,
      infoByService,
      servicesByCategory,
      serviceCategories,
      true
    )
  }

  const unmappedServices = Object.keys(infoByService).filter(
    (service) => !serviceCategories[service]
  )
  if (unmappedServices.length > 0) {
    throw new Error(`No category mapping found for services: ${unmappedServices.sort().join(', ')}`)
  }

  const categoryDetails = categories.map((category) => {
    const services = [...(servicesByCategory.get(category.key) ?? new Set<string>())].sort()
    if (services.length === 0) {
      throw new Error(`No IAM services mapped to category ${category.key}`)
    }
    return {
      key: category.key,
      name: category.name,
      services
    }
  })

  return { categories: categoryDetails, serviceCategories }
}

function getServicesByNormalizedName(infoByService: InfoByService): Record<string, string[]> {
  const servicesByNormalizedName: Record<string, string[]> = {}
  for (const [service, info] of Object.entries(infoByService)) {
    const normalizedName = normalizeServiceCategoryTopic(info.name)
    servicesByNormalizedName[normalizedName] ||= []
    servicesByNormalizedName[normalizedName].push(service)
  }
  return servicesByNormalizedName
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.keys(record)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = record[key]
        return acc
      },
      {} as Record<string, T>
    )
}

function addServiceToCategory(
  service: string,
  category: string,
  infoByService: InfoByService,
  servicesByCategory: Map<string, Set<string>>,
  serviceCategories: ServiceCategoryIndex,
  override = false
) {
  if (!infoByService[service]) {
    throw new Error(`Category mapping references unknown IAM service ${service}`)
  }

  const existingCategory = serviceCategories[service]
  if (existingCategory && existingCategory !== category) {
    if (!override) {
      throw new Error(
        `IAM service ${service} mapped to multiple categories: ${existingCategory}, ${category}`
      )
    }
    servicesByCategory.get(existingCategory)?.delete(service)
  }

  serviceCategories[service] = category
  servicesByCategory.get(category)?.add(service)
}

async function run() {
  await mkdir(jsonDocsLocation, { recursive: true })
  await rm(serviceInfoLocation, { recursive: true, force: true })
  await mkdir(serviceInfoLocation, { recursive: true })
  await mkdir(categoriesLocation, { recursive: true })
  await mkdir(actionsLocation, { recursive: true })
  await mkdir(resourceTypesLocation, { recursive: true })
  await mkdir(conditionKeysLocation, { recursive: true })

  const [infoByService, unassociatedConditionKeys, conditionPatterns] = getInformationByService()
  const { categories, serviceCategories } = await getCategoryInformation(infoByService)
  const serviceKeys = Object.keys(infoByService).sort()
  const serviceNames = serviceKeys.reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = infoByService[key].name
      return acc
    },
    {} as Record<string, string>
  )

  const categoryKeys = categories.map((category) => category.key).sort()
  const categoryNames = categories.reduce(
    (acc, category) => {
      acc[category.key] = category.name
      return acc
    },
    {} as Record<string, string>
  )

  await writeFile(join(serviceInfoLocation, 'services.json'), JSON.stringify(serviceKeys, null, 2))
  await writeFile(
    join(serviceInfoLocation, 'serviceNames.json'),
    JSON.stringify(serviceNames, null, 2)
  )
  await writeFile(
    join(serviceInfoLocation, 'categories.json'),
    JSON.stringify(categoryKeys, null, 2)
  )
  await writeFile(
    join(serviceInfoLocation, 'categoryNames.json'),
    JSON.stringify(categoryNames, null, 2)
  )
  await writeFile(
    join(serviceInfoLocation, 'serviceCategories.json'),
    JSON.stringify(sortRecord(serviceCategories), null, 2)
  )
  for (const category of categories) {
    await writeFile(
      join(categoriesLocation, category.key + '.json'),
      JSON.stringify(category, null, 2)
    )
  }
  for (const service in infoByService) {
    await writeFile(
      join(actionsLocation, service + '.json'),
      JSON.stringify(infoByService[service].actions, null, 2)
    )
    await writeFile(
      join(resourceTypesLocation, service + '.json'),
      JSON.stringify(infoByService[service].resourceTypes, null, 2)
    )
    await writeFile(
      join(conditionKeysLocation, service + '.json'),
      JSON.stringify(infoByService[service].conditionKeys, null, 2)
    )
  }

  await writeFile(
    join(serviceInfoLocation, 'unassociatedConditions.json'),
    JSON.stringify(unassociatedConditionKeys, null, 2)
  )

  await writeFile(
    join(serviceInfoLocation, 'conditionPatterns.json'),
    JSON.stringify(conditionPatterns, null, 2)
  )
}

run()
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
  .then(() => console.log('done'))
