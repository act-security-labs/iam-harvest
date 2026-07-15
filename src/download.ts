import { load } from 'cheerio'
import { mkdir, readFile } from 'fs/promises'
import { parseCategoryIndex } from './parsing/categories.js'
import {
  awsIamDocsRoot,
  awsOverviewDocsRoot,
  awsServiceReferenceRoot,
  htmlDownloadLocation,
  overviewMarkdownDownloadLocation,
  serviceReferenceDownloadLocation
} from './util/consts.js'
import { downloadUrlToFile, makeFullUrl } from './util/downloads.js'

/**
 * This script downloads the html files from the AWS IAM docs.
 */
interface Topic {
  name: string
  path: string
}

async function downloadIamServiceAuthorizationPages() {
  await mkdir(htmlDownloadLocation, { recursive: true })
  const indexFile = htmlDownloadLocation + '/index.html'
  await downloadUrlToFile(
    awsIamDocsRoot + 'reference_policies_actions-resources-contextkeys.html',
    indexFile
  )

  const indexFileContents = await readFile(indexFile, 'utf-8')
  const doc = load(indexFileContents)
  const topicsList = doc('div.highlights ul')

  const topics: Topic[] = topicsList
    .find('li a')
    .toArray()
    .map((el) => {
      const topicLink = doc(el)
      const name = topicLink.text()
      const path = topicLink.attr('href')
      if (!path) {
        throw new Error('No path found for topic: ' + name)
      }
      return { name, path }
    })

  // We purposely do this syncrhonously so we don't get rate limited. Amazon can be... "touchy"
  for (const topic of topics) {
    const fullUrl = makeFullUrl(awsIamDocsRoot, topic.path)
    await downloadUrlToFile(fullUrl, htmlDownloadLocation + '/' + topic.name + '.html')
  }
}

interface ServiceReferenceMappingEntry {
  service: string
  url: string
}

interface ServiceReferenceMapping {
  SDK: Record<string, Record<string, Record<string, ServiceReferenceMappingEntry>>>
}

async function downloadServiceReferenceJsonFiles() {
  await mkdir(serviceReferenceDownloadLocation, { recursive: true })
  const mappingFile = serviceReferenceDownloadLocation + '/mapping.json'
  await downloadUrlToFile(awsServiceReferenceRoot + 'mapping.json', mappingFile)

  const mapping = JSON.parse(await readFile(mappingFile, 'utf-8')) as ServiceReferenceMapping
  const referencesByService = new Map<string, string>()
  for (const sdk of Object.values(mapping.SDK)) {
    for (const packageMapping of Object.values(sdk)) {
      for (const entry of Object.values(packageMapping)) {
        referencesByService.set(entry.service, entry.url)
      }
    }
  }

  // Keep downloads sequential for the same rate-limit reasons as the IAM documentation pages.
  for (const [service, url] of [...referencesByService.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    await downloadUrlToFile(url, serviceReferenceDownloadLocation + '/' + service + '.json')
  }
}

async function downloadAwsOverviewCategoryPages() {
  await mkdir(overviewMarkdownDownloadLocation, { recursive: true })
  const indexFile = overviewMarkdownDownloadLocation + '/amazon-web-services-cloud-platform.md'
  await downloadUrlToFile(awsOverviewDocsRoot + 'amazon-web-services-cloud-platform.md', indexFile)

  const indexFileContents = await readFile(indexFile, 'utf-8')
  const categories = parseCategoryIndex(indexFileContents)

  // Keep downloads sequential for the same rate-limit reasons as the IAM documentation pages.
  for (const category of categories) {
    await downloadUrlToFile(
      awsOverviewDocsRoot + category.path,
      overviewMarkdownDownloadLocation + '/' + category.path
    )
  }
}

async function run() {
  await downloadIamServiceAuthorizationPages()
  await downloadServiceReferenceJsonFiles()
  await downloadAwsOverviewCategoryPages()
}

run()
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
  .then(() => console.log('done'))
