import { join, resolve } from 'path'

export const awsIamDocsRoot = 'https://docs.aws.amazon.com/service-authorization/latest/reference/'
export const awsOverviewDocsRoot = 'https://docs.aws.amazon.com/whitepapers/latest/aws-overview/'
export const awsOrganizationsDocsRoot =
  'https://docs.aws.amazon.com/organizations/latest/userguide/'
export const awsServiceReferenceRoot = 'https://servicereference.us-east-1.amazonaws.com/v1/'

export const filesLocation = resolve('./files')

export const operatorsLocation = join(filesLocation, 'operators')

export const operatorDetailsLocation = join(operatorsLocation, 'details')

export const htmlDownloadLocation = join(filesLocation, 'html')
export const overviewMarkdownDownloadLocation = join(filesLocation, 'awsOverviewMarkdown')
export const organizationsMarkdownDownloadLocation = join(filesLocation, 'awsOrganizationsMarkdown')
export const serviceReferenceDownloadLocation = join(filesLocation, 'serviceReference')

export const jsonDocsLocation = join(filesLocation, 'json')

export const serviceInfoLocation = join(filesLocation, 'serviceInfo')
export const categoriesLocation = join(serviceInfoLocation, 'categories')
export const actionsLocation = join(serviceInfoLocation, 'actions')
export const resourceTypesLocation = join(serviceInfoLocation, 'resourceTypes')
export const conditionKeysLocation = join(serviceInfoLocation, 'conditionKeys')
