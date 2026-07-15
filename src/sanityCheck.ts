/**
 * This script does a sanity check on downloaded and parsed resources before
 * any updates are made.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  actionsLocation,
  categoriesLocation,
  conditionKeysLocation,
  resourceTypesLocation,
  serviceInfoLocation
} from './util/consts.js'

// Get all services
const services = JSON.parse(readFileSync(join(serviceInfoLocation, 'services.json'), 'utf8'))
const serviceNames = JSON.parse(
  readFileSync(join(serviceInfoLocation, 'serviceNames.json'), 'utf8')
)
const categories = JSON.parse(readFileSync(join(serviceInfoLocation, 'categories.json'), 'utf8'))
const categoryNames = JSON.parse(
  readFileSync(join(serviceInfoLocation, 'categoryNames.json'), 'utf8')
)
const serviceCategories = JSON.parse(
  readFileSync(join(serviceInfoLocation, 'serviceCategories.json'), 'utf8')
)

const tests: (() => boolean)[] = [
  () => {
    if (services.length < 300) {
      console.log(`Only found ${services.length} services, expected at least 300`)
      return false
    }
    return true
  },
  () => {
    for (const service of services) {
      if (!serviceNames[service]) {
        console.log(`Service ${service} is missing from serviceNames.json`)
        return false
      }
    }
    return true
  },
  () => {
    const serviceSet = new Set(services)
    const smoketestServices = [
      'iam',
      'sts',
      's3',
      'ec2',
      'sqs',
      'sns',
      'lambda',
      'dynamodb',
      'cloudwatch',
      'cloudformation',
      'cloudfront',
      'cloudtrail',
      'logs',
      'cognito-identity',
      'cognito-sync',
      'cognito-idp',
      'config',
      'datapipeline',
      'directconnect',
      'dms',
      'ds',
      'ecr',
      'ecs',
      'elasticache',
      'elasticbeanstalk',
      'elasticfilesystem',
      'elasticloadbalancing',
      'elasticmapreduce',
      'elastictranscoder',
      'es',
      'events',
      'firehose',
      'gamelift',
      'glacier',
      'glue',
      'greengrass',
      'guardduty',
      'health',
      'iam',
      'importexport',
      'inspector',
      'iot',
      'kinesis',
      'kinesisanalytics',
      'kms',
      'lambda',
      'lex',
      'lightsail',
      'machinelearning',
      'marketplacecommerceanalytics',
      'mediaconvert',
      'medialive',
      'mediapackage',
      'mediastore',
      'organizations',
      'rds',
      'redshift',
      'rekognition',
      'route53',
      's3',
      'sdb',
      'servicecatalog',
      'ses',
      'shield',
      'sms',
      'snowball',
      'sns',
      'sqs',
      'ssm',
      'states',
      'storagegateway',
      'sts',
      'support',
      'swf',
      'waf',
      'waf-regional',
      'workdocs',
      'workspaces',
      'xray'
    ]
    for (const service of smoketestServices) {
      if (!serviceSet.has(service)) {
        console.log(`Service ${service} is missing from services.json`)
        return false
      }
    }
    return true
  },
  () => {
    for (const service of services) {
      const actionsFile = join(actionsLocation, `${service}.json`)
      const conditionsFile = join(conditionKeysLocation, `${service}.json`)
      const resourcesFile = join(resourceTypesLocation, `${service}.json`)
      for (const fileName of [actionsFile, conditionsFile, resourcesFile]) {
        if (!existsSync(fileName)) {
          console.log(`Service ${service} is missing from ${fileName}`)
          return false
        }
        try {
          JSON.parse(readFileSync(fileName, 'utf8'))
        } catch (e) {
          console.log(`Service ${service} has invalid JSON in ${fileName}`)
          return false
        }
      }
    }
    return true
  },
  () => {
    const serviceSet = new Set(services)
    const categorySet = new Set(categories)
    for (const category of categories) {
      if (!categoryNames[category]) {
        console.log(`Category ${category} is missing from categoryNames.json`)
        return false
      }
      const categoryFile = join(categoriesLocation, `${category}.json`)
      if (!existsSync(categoryFile)) {
        console.log(`Category ${category} is missing from ${categoryFile}`)
        return false
      }
      const categoryDetails = JSON.parse(readFileSync(categoryFile, 'utf8'))
      if (categoryDetails.key !== category) {
        console.log(`Category file ${categoryFile} has mismatched key ${categoryDetails.key}`)
        return false
      }
      if (categoryDetails.name !== categoryNames[category]) {
        console.log(`Category ${category} has mismatched name`)
        return false
      }
      for (const service of categoryDetails.services) {
        if (!serviceSet.has(service)) {
          console.log(`Category ${category} references unknown service ${service}`)
          return false
        }
      }
    }
    for (const service of services) {
      const category = serviceCategories[service]
      if (!category) {
        console.log(`Service ${service} is missing from serviceCategories.json`)
        return false
      }
      if (!categorySet.has(category)) {
        console.log(`Service ${service} references unknown category ${category}`)
        return false
      }
    }
    return true
  },
  () => {
    const expectedActions = ['s3:GetObject', 'ec2:DescribeInstances', 'sqs:SendMessage']
    for (const action of expectedActions) {
      const [service, actionName] = action.split(':')
      const actions = JSON.parse(readFileSync(join(actionsLocation, `${service}.json`), 'utf8'))
      if (!actions[actionName.toLowerCase()]) {
        console.log(`Action ${action} is missing from ${service}.json`)
        return false
      }
    }
    return true
  },
  () => {
    const expectedResources = ['s3:bucket', 'ec2:instance', 'sqs:queue']
    for (const resource of expectedResources) {
      const [service, resourceType] = resource.split(':')
      const resources = JSON.parse(
        readFileSync(join(resourceTypesLocation, `${service}.json`), 'utf8')
      )
      if (!resources[resourceType.toLowerCase()]) {
        console.log(`Resource ${resource} is missing from ${service}.json`)
        return false
      }
    }
    return true
  },
  () => {
    const expectedConditions = [
      's3:ExistingObjectTag/<key>',
      'ec2:InstanceType',
      'kms:CallerAccount'
    ]
    for (const condition of expectedConditions) {
      const [service] = condition.split(':')
      const conditions = JSON.parse(
        readFileSync(join(conditionKeysLocation, `${service}.json`), 'utf8')
      )
      if (!conditions[condition.toLowerCase()]) {
        console.log(`Condition ${condition} is missing from ${service}.json`)
        return false
      }
    }
    return true
  }
]

for (const test of tests) {
  if (!test()) {
    process.exit(1)
  }
}

process.exit(0)
