import type { Cheerio, CheerioAPI } from 'cheerio'
import { Element } from 'domhandler'
import { type Action, type ActionResourceType, type Scenario } from '../util/serviceDefinition.js'
import { type ServiceReference } from '../util/serviceReference.js'
import { type ProblemRow } from './ProblemRow.js'
import { parseResourceTypes } from './resourceTypes.js'

interface ResourceTypeReference {
  name: string
  required: boolean
}

//[Action, Description, Access Level] --one or many--> Resource Types(required), Condition Keys, Dependent Actions
// Description may have Scenarios in it.

export function parseActions(doc: CheerioAPI, serviceReference?: ServiceReference): Action[] {
  const table = doc('th:contains("Actions")').parents('table')
  const actionRows = findActionRows(doc, table)
  const usesFiveColumnFormat = !table.text().includes('Dependent actions')
  const resourceTypeConditionKeys = usesFiveColumnFormat ? getResourceTypeConditionKeys(doc) : {}

  return actionRows
    .map((row) => getActionFromRow(doc, row))
    .map((action) =>
      usesFiveColumnFormat
        ? liftCommonConditionKeysToAction(action, resourceTypeConditionKeys)
        : action
    )
    .map((action) => applyServiceReferenceToAction(action, serviceReference))
}

function parseName(nameText: string): { name: string; isPermissionOnly?: boolean } {
  nameText = nameText.trim()
  const isPermissionOnly = nameText.endsWith('[permission only]') ? true : undefined
  return {
    name: nameText.trim().split(/\s/)[0],
    isPermissionOnly
  }
}

function getResourceTypeConditionKeys(doc: CheerioAPI): Record<string, Set<string>> {
  const resourceTypes = parseResourceTypes(doc) ?? []
  return resourceTypes.reduce(
    (acc, resourceType) => {
      acc[resourceType.key] = new Set(resourceType.conditionKeys ?? [])
      return acc
    },
    {} as Record<string, Set<string>>
  )
}

function liftCommonConditionKeysToAction(
  action: Action,
  resourceTypeConditionKeys: Record<string, Set<string>>
): Action {
  if (action.resourceTypes.length === 0) {
    return action
  }

  const conditionKeySets = action.resourceTypes.map(
    (resourceType) => new Set(resourceType.conditionKeys)
  )
  const commonConditionKeys = conditionKeySets.reduce((common, conditionKeys) => {
    return new Set([...common].filter((key) => conditionKeys.has(key)))
  })
  const actionConditionKeys = [...commonConditionKeys].filter((key) =>
    isLikelyActionLevelConditionKey(key, resourceTypeConditionKeys)
  )

  return {
    ...action,
    conditionKeys: [...new Set([...action.conditionKeys, ...actionConditionKeys])],
    resourceTypes: action.resourceTypes.map((resourceType) => ({
      ...resourceType,
      conditionKeys: resourceType.conditionKeys.filter((key) => !actionConditionKeys.includes(key))
    }))
  }
}

function isLikelyActionLevelConditionKey(
  conditionKey: string,
  resourceTypeConditionKeys: Record<string, Set<string>>
): boolean {
  if (/^(aws:RequestTag\/|aws:ResourceTag\/|aws:TagKeys$)/.test(conditionKey)) {
    return false
  }
  if (/:(ResourceTag|BucketTag|AccessPointTag)\//.test(conditionKey)) {
    return false
  }
  if (
    conditionKey.endsWith(':IsLaunchTemplateResource') ||
    conditionKey.endsWith(':LaunchTemplate')
  ) {
    return false
  }
  if (conditionKey.endsWith(':Region')) {
    return true
  }
  return !Object.values(resourceTypeConditionKeys).every((keys) => keys.has(conditionKey))
}

function applyServiceReferenceToAction(
  action: Action,
  serviceReference?: ServiceReference
): Action {
  if (!serviceReference) {
    return action
  }

  const referenceAction = serviceReference.Actions.find(
    (candidate) => candidate.Name.toLowerCase() === action.name.toLowerCase()
  )
  if (!referenceAction) {
    return action
  }

  const referenceResources = referenceAction.Resources ?? []
  // AWS's service reference JSON is the authoritative source for action/resource condition keys and
  // dependent actions. In that JSON, an omitted condition-key or dependent-action field means no
  // values are listed for that scope.
  return {
    ...action,
    conditionKeys: referenceAction.ActionConditionKeys ?? [],
    dependentActions: referenceAction.DependentActions ?? [],
    resourceTypes: action.resourceTypes.map((resourceType) => {
      const referenceResource = referenceResources.find(
        (candidate) => candidate.Name.toLowerCase() === resourceType.name.toLowerCase()
      )
      return {
        ...resourceType,
        conditionKeys: referenceResource?.ConditionKeys ?? []
      }
    })
  }
}

function getActionFromRow(doc: CheerioAPI, row: Cheerio<Element>): Action {
  const columns = row.find('td')
  const firstColumnRowspan = doc(columns.get(0)).attr('rowspan')
  const secondColumnRowspan = doc(columns.get(1)).attr('rowspan')!

  if (!firstColumnRowspan) {
    return parseSingleRowAction(doc, row)
  }

  if (firstColumnRowspan === secondColumnRowspan) {
    return parseSimpleMultiRowAction(doc, row, parseInt(firstColumnRowspan))
  }

  if (parseInt(firstColumnRowspan) > parseInt(secondColumnRowspan)) {
    return parseScenarioMultiRowAction(doc, row, parseInt(firstColumnRowspan))
  }

  console.log(row.html())
  throw new Error('No way to parse row')
}

function parseSingleRowAction(doc: CheerioAPI, row: Cheerio<Element>): Action {
  const columns = row.find('td')
  const hasDependentActionsColumn = columns.length === 6
  const accessLevelColumn = hasDependentActionsColumn ? 2 : 4
  const resourceTypeColumn = hasDependentActionsColumn ? 3 : 2
  const conditionKeysColumn = hasDependentActionsColumn ? 4 : 3
  const { name, isPermissionOnly } = parseName(doc(columns.get(0)).text())
  const description = doc(columns.get(1)).text().trim()
  const accessLevel = doc(columns.get(accessLevelColumn)).text().trim()
  const resourceType = parseResourceTypeRef(doc(columns.get(resourceTypeColumn)).text().trim())
  const conditionKeys = doc(columns.get(conditionKeysColumn))
    .find('a')
    .map((i, el) => doc(el).text().trim())
    .get()
  const dependentActions = hasDependentActionsColumn
    ? doc(columns.get(5))
        .find('p')
        .map((i, el) => doc(el).text().trim())
        .get()
    : []

  return {
    name,
    isPermissionOnly,
    description,
    accessLevel,
    resourceTypes: resourceType
      ? [{ ...resourceType, conditionKeys: [], dependentActions: [] }]
      : [],
    conditionKeys,
    dependentActions
  }
}

function parseSimpleMultiRowAction(
  doc: CheerioAPI,
  row: Cheerio<Element>,
  numberOfRows: number
): Action {
  const columns = row.find('td')
  const { name, isPermissionOnly } = parseName(doc(columns.get(0)).text())
  const description = doc(columns.get(1)).text().trim()
  const accessLevel = doc(columns.get(columns.length === 6 ? 2 : 4))
    .text()
    .trim()

  //Gather up all the rows, these will be the different resource types.
  const allRows = []
  for (let i = numberOfRows; i > 0; i--) {
    allRows.push(row)
    row = row.next()
  }

  //Now parse out the resource types.
  let conditionKeys: string[] = []
  let dependentActions: string[] = []
  const resourceTypes: ActionResourceType[] = []

  for (let row of allRows) {
    const resourceType = parseResourceTypeFromRow(doc, row)
    if (resourceType.name === undefined) {
      conditionKeys = resourceType.conditionKeys || []
      dependentActions = resourceType.dependentActions || []
    } else {
      resourceTypes.push(resourceType as ActionResourceType)
    }
  }

  return {
    name,
    isPermissionOnly,
    description,
    accessLevel,
    resourceTypes,
    conditionKeys,
    dependentActions
  }
}

function parseScenarioMultiRowAction(
  doc: CheerioAPI,
  row: Cheerio<Element>,
  numberOfRows: number
): Action {
  const columns = row.find('td')
  const secondColumnRowspan = doc(columns.get(1)).attr('rowspan')!
  const initialRow = row

  const allRows: Cheerio<Element>[] = []
  for (let i = numberOfRows; i > 0; i--) {
    allRows.push(row)
    row = row.next()
  }

  const theAction = parseSimpleMultiRowAction(doc, initialRow, parseInt(secondColumnRowspan))

  const scenarioRows = allRows.filter((row) =>
    row.find('td').first().text().trim().startsWith('SCENARIO:')
  )
  theAction.scenarios = scenarioRows.map((row) => parseScenarioRow(doc, row))

  return theAction
}

function parseScenarioRow(doc: CheerioAPI, row: Cheerio<Element>): Scenario {
  const columns = row.find('td')
  const nameCell = doc(columns.get(0)).text().trim()
  const resourceTypeColumn = columns.length === 5 ? 2 : 1
  const conditionKeysColumn = columns.length === 5 ? 3 : 2
  const dependentActionsColumn = columns.length === 5 ? 4 : 3
  //Chop off "SCENARIO:"
  const name = nameCell.substring(10, nameCell.length).trim()
  const resourceTypes = doc(columns.get(resourceTypeColumn))
    .find('a')
    .map((i, el) => doc(el).text().trim())
    .get()
    .map((s) => parseResourceTypeRef(s))
    .filter((r) => r !== undefined) as ActionResourceType[]

  const conditionKeys = doc(columns.get(conditionKeysColumn)).text().trim()
  if (conditionKeys !== '') {
    throw new Error('Found condition keys where unexpected in scenario row: ' + row.html())
  }
  const dependentActions = doc(columns.get(dependentActionsColumn)).text().trim()
  if (dependentActions !== '') {
    throw new Error('Found dependent actions where unexpected in scenario row: ' + row.html())
  }

  return {
    name,
    resourceTypes: resourceTypes
  }
}

function parseResourceTypeFromRow(
  doc: CheerioAPI,
  row: Cheerio<Element>
): Partial<ActionResourceType> {
  const columns = row.find('td')
  const startAt = columns.length === 6 ? 3 : columns.length === 5 ? 2 : 0

  //TODO: Add a check for multiple resource types in a single row.
  if (doc(columns.get(startAt)).find('a').length > 1) {
    throw new Error('Multiple resource types in a single row: ' + row.html())
  }
  const resourceTypeRef = parseResourceTypeRef(doc(columns.get(startAt)).text().trim())
  const conditionKeys = doc(columns.get(startAt + 1))
    .find('a')
    .map((i, el) => doc(el).text().trim())
    .get()
  const dependentActions =
    columns.length === 6
      ? doc(columns.get(startAt + 2))
          .find('p')
          .map((i, el) => doc(el).text().trim())
          .get()
      : []

  return {
    name: resourceTypeRef?.name,
    required: resourceTypeRef?.required,
    conditionKeys: conditionKeys,
    dependentActions: dependentActions
  }
}

function parseResourceTypeRef(cellContents: string): ResourceTypeReference | undefined {
  if (cellContents === '') {
    return undefined
  }

  let name = cellContents
  let required = false

  if (name.endsWith('*')) {
    ;((name = name.substring(0, cellContents.length - 1)), (required = true))
  }

  return {
    name,
    required
  }
}

function findActionRows(doc: CheerioAPI, table: Cheerio<Element>) {
  const rows = table.find('tbody tr')
  const actionRows: Cheerio<Element>[] = []
  rows.each((i, el) => {
    const row = doc(el)
    const isActionStartRow = [5, 6].includes(row.find('td').length)
    if (isActionStartRow) {
      actionRows.push(row)
    }
  })

  return actionRows
}

/**
 * Verifies various assumptions made about the actions table before we parse it.  This will
 * return errors if any of those assumptions are no longer true.
 *
 * @param doc The cheerio document
 * @param table The actions table element
 * @returns Returns an array of errors found, or an empty array if no errors were found.
 */
export function verifyActionTableAssumptions(
  doc: CheerioAPI,
  table: Cheerio<Element>
): ProblemRow[] {
  return [...verifyRowspanAssumptions(doc, table), ...verifyColspanAssumptions(doc, table)]
}

/**
 * Verifies that now cells in the table have a colspan attribute
 * @param doc The cheerio document
 * @param table The table
 */
export function verifyColspanAssumptions(doc: CheerioAPI, table: Cheerio<Element>): ProblemRow[] {
  const rows = table.find('tr')
  const errorRows: ProblemRow[] = []
  rows.each((i, el) => {
    const row = doc(el)
    const hasColspans = row.find('td[colspan]').length > 0
    if (hasColspans) {
      errorRows.push({ problemDescription: 'found colspan', html: row.html()! })
    }
  })

  return errorRows
}

export function verifyRowspanAssumptions(doc: CheerioAPI, table: Cheerio<Element>): ProblemRow[] {
  const rows = table.find('tbody tr')
  const errorRows: ProblemRow[] = []
  rows.each((i, el) => {
    const row = doc(el)
    const hasRowspans = row.find('td[rowspan]').length > 0
    const columnCount = row.find('td').length
    const isActionStartRow = [5, 6].includes(columnCount)
    if (!hasRowspans) {
      return
    }

    if (!isActionStartRow) {
      errorRows.push({
        problemDescription: 'does not have action start columns',
        html: row.html()!
      })
      return
    }
    const columns = row.find('td')
    const hasDependentActionsColumn = columnCount === 6
    const accessLevelColumn = hasDependentActionsColumn ? 2 : 4
    const resourceTypeColumn = hasDependentActionsColumn ? 3 : 2
    const conditionKeysColumn = hasDependentActionsColumn ? 4 : 3
    const firstColumnRowspan = doc(columns.get(0)).attr('rowspan')
    const secondColumnRowspan = doc(columns.get(1)).attr('rowspan')
    const accessLevelRowspan = doc(columns.get(accessLevelColumn)).attr('rowspan')

    if (!firstColumnRowspan || !secondColumnRowspan || !accessLevelRowspan) {
      errorRows.push({
        problemDescription: 'missing rowspan in action, description, or access level columns',
        html: row.html()!
      })
      return
    }

    //is the first column rowspan less than the second column rowspan?
    if (parseInt(firstColumnRowspan) < parseInt(secondColumnRowspan)) {
      errorRows.push({
        problemDescription: 'first column rowspan should be the biggest',
        html: row.html()!
      })
      return
    }

    if (parseInt(secondColumnRowspan) != parseInt(accessLevelRowspan)) {
      errorRows.push({
        problemDescription: 'description and access level rowspans should be equal',
        html: row.html()!
      })
      return
    }

    //make sure resource, condition key, and dependent action columns have no rowspan
    const resourceTypeColumnRowspan = doc(columns.get(resourceTypeColumn)).attr('rowspan')
    const conditionKeysColumnRowspan = doc(columns.get(conditionKeysColumn)).attr('rowspan')
    const dependentActionsColumnRowspan = hasDependentActionsColumn
      ? doc(columns.get(5)).attr('rowspan')
      : undefined
    if (resourceTypeColumnRowspan || conditionKeysColumnRowspan || dependentActionsColumnRowspan) {
      errorRows.push({
        problemDescription: 'found rowspan in resource, condition key, or dependent action columns',
        html: row.html()!
      })
      return
    }
  })

  return errorRows
}
