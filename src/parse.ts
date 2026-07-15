import { load } from 'cheerio'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseActions } from './parsing/actions.js'
import { parseConditionKeys } from './parsing/conditionKeys.js'
import { parseResourceTypes } from './parsing/resourceTypes.js'
import { verifyHtmlFileAssumptions } from './parsing/verifyAssumptions.js'
import {
  htmlDownloadLocation,
  jsonDocsLocation,
  serviceReferenceDownloadLocation
} from './util/consts.js'
import { type ServiceDefinition } from './util/serviceDefinition.js'
import { type ServiceReference } from './util/serviceReference.js'

async function parseFile(filename: string): Promise<ServiceDefinition> {
  const fileContents = await readFile(join(htmlDownloadLocation, filename), 'utf-8')
  const rawServiceName = filename.substring(0, filename.length - 5)
  const doc = load(fileContents)
  const prefix = doc('p:contains("service prefix:")').find('.code').text()
  const serviceName = rawServiceName.endsWith(` (${prefix})`)
    ? rawServiceName.substring(0, rawServiceName.length - ` (${prefix})`.length)
    : rawServiceName

  const serviceReference = await readServiceReference(prefix)
  const actions = parseActions(doc, serviceReference)
  const resourceTypes = parseResourceTypes(doc)
  const conditionKeys = parseConditionKeys(doc)

  return {
    name: serviceName,
    prefix,
    actions,
    resourceTypes,
    conditionKeys
  }
}

async function readServiceReference(prefix: string): Promise<ServiceReference | undefined> {
  try {
    return JSON.parse(
      await readFile(
        join(serviceReferenceDownloadLocation, `${prefix.toLowerCase()}.json`),
        'utf-8'
      )
    ) as ServiceReference
  } catch {
    return undefined
  }
}

async function verifyAllFiles() {
  const files = await readdir(htmlDownloadLocation)
  for (const file of files) {
    if (file === 'index.html') continue
    await verifyHtmlFileAssumptions(file)
  }
}

async function parseAllFiles() {
  const files = await readdir(htmlDownloadLocation)
  for (const file of files) {
    if (file === 'index.html') continue
    const definition = await parseFile(file)
    await writeFile(
      join(jsonDocsLocation, definition.name + '.json'),
      JSON.stringify(definition, null, 2)
    )
  }
}

async function run() {
  await rm(jsonDocsLocation, { recursive: true, force: true })
  await mkdir(jsonDocsLocation, { recursive: true })
  await verifyAllFiles()
  await parseAllFiles()
}

run()
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
  .then(() => console.log('done'))
