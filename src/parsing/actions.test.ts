import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { parseActions, verifyActionTableAssumptions } from './actions.js'

function actionTable(rows: string): string {
  return `<table>
    <thead>
      <tr>
        <th>Actions</th>
        <th>Description</th>
        <th>Resource types (*required)</th>
        <th>Condition keys</th>
        <th>Access level</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function resourceTypesTable(rows: string): string {
  return `<table>
    <thead>
      <tr>
        <th>Resource types</th>
        <th>ARN</th>
        <th>Condition keys</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

describe('actions', () => {
  it('parses the five-column AWS action table format', () => {
    //Given an AWS action table with the current five-column format
    const doc = load(
      actionTable(`<tr>
        <td rowspan="1"><p><a>CloseAccount</a></p></td>
        <td rowspan="1"><p>Grants permission to close an account</p></td>
        <td><p><a href="#resource-account">account</a></p></td>
        <td></td>
        <td rowspan="1"><p>Write</p></td>
      </tr>`)
    )

    //When the actions are parsed
    const result = parseActions(doc)

    //Then the action is parsed with access level and no dependent actions
    expect(result).toEqual([
      {
        name: 'CloseAccount',
        isPermissionOnly: undefined,
        description: 'Grants permission to close an account',
        accessLevel: 'Write',
        resourceTypes: [
          {
            name: 'account',
            required: false,
            conditionKeys: [],
            dependentActions: []
          }
        ],
        conditionKeys: [],
        dependentActions: []
      }
    ])
  })

  it('uses service reference JSON for action and resource condition keys', () => {
    //Given a five-column action table with condition keys repeated for multiple resources
    const doc = load(
      actionTable(`<tr>
        <td rowspan="2"><p><a>GetObject</a></p></td>
        <td rowspan="2"><p>Grants permission to retrieve objects</p></td>
        <td><p><a href="#resource-accesspointobject">accesspointobject</a></p></td>
        <td>
          <p><a>aws:ResourceTag/$\{TagKey}</a></p>
          <p><a>s3:AccessGrantsInstanceArn</a></p>
          <p><a>s3:authType</a></p>
          <p><a>s3:AccessPointNetworkOrigin</a></p>
        </td>
        <td rowspan="2"><p>Read</p></td>
      </tr>
      <tr>
        <td><p><a href="#resource-object">object</a></p></td>
        <td>
          <p><a>aws:ResourceTag/$\{TagKey}</a></p>
          <p><a>s3:AccessGrantsInstanceArn</a></p>
          <p><a>s3:authType</a></p>
          <p><a>s3:BucketTag/$\{TagKey}</a></p>
        </td>
      </tr>`) +
        resourceTypesTable(`<tr>
          <td>accesspointobject</td>
          <td>arn</td>
          <td><p><a>aws:ResourceTag/$\{TagKey}</a></p><p><a>s3:AccessPointNetworkOrigin</a></p></td>
        </tr>
        <tr>
          <td>object</td>
          <td>arn</td>
          <td><p><a>aws:ResourceTag/$\{TagKey}</a></p><p><a>s3:BucketTag/$\{TagKey}</a></p></td>
        </tr>`)
    )

    const serviceReference = {
      Name: 's3',
      Actions: [
        {
          Name: 'GetObject',
          ActionConditionKeys: ['s3:AccessGrantsInstanceArn', 's3:authType'],
          DependentActions: ['kms:Decrypt'],
          Resources: [
            {
              Name: 'accesspointobject',
              ConditionKeys: ['aws:ResourceTag/${TagKey}', 's3:AccessPointNetworkOrigin']
            },
            {
              Name: 'object',
              ConditionKeys: ['aws:ResourceTag/${TagKey}', 's3:BucketTag/${TagKey}']
            }
          ]
        }
      ]
    }

    //When the actions are parsed
    const result = parseActions(doc, serviceReference)

    //Then action and resource condition keys come from service reference JSON
    expect(result[0].conditionKeys).toEqual(['s3:AccessGrantsInstanceArn', 's3:authType'])
    expect(result[0].dependentActions).toEqual(['kms:Decrypt'])
    expect(result[0].resourceTypes).toEqual([
      {
        name: 'accesspointobject',
        required: false,
        conditionKeys: ['aws:ResourceTag/${TagKey}', 's3:AccessPointNetworkOrigin'],
        dependentActions: []
      },
      {
        name: 'object',
        required: false,
        conditionKeys: ['aws:ResourceTag/${TagKey}', 's3:BucketTag/${TagKey}'],
        dependentActions: []
      }
    ])
  })

  it('treats omitted service reference condition key fields as empty', () => {
    //Given HTML-derived condition keys and service reference JSON without condition key fields
    const doc = load(
      actionTable(`<tr>
        <td rowspan="1"><p><a>GetObject</a></p></td>
        <td rowspan="1"><p>Grants permission to retrieve objects</p></td>
        <td><p><a href="#resource-object">object</a></p></td>
        <td><p><a>s3:authType</a></p></td>
        <td rowspan="1"><p>Read</p></td>
      </tr>`)
    )
    const serviceReference = {
      Name: 's3',
      Actions: [
        {
          Name: 'GetObject',
          Resources: [{ Name: 'object' }]
        }
      ]
    }

    //When the actions are parsed
    const result = parseActions(doc, serviceReference)

    //Then missing JSON condition key and dependent action fields are treated as empty authoritative values
    expect(result[0].conditionKeys).toEqual([])
    expect(result[0].dependentActions).toEqual([])
    expect(result[0].resourceTypes[0].conditionKeys).toEqual([])
  })

  it('parses scenarios from the five-column AWS action table format', () => {
    //Given a five-column action table with scenario rows
    const doc = load(
      actionTable(`<tr>
        <td rowspan="3"><p><a>ScheduleRun</a></p></td>
        <td rowspan="1"><p>Grants permission to schedule a run</p></td>
        <td><p><a href="#resource-devicepool">devicepool</a></p></td>
        <td><p><a href="#condition-tag">aws:ResourceTag/$\{TagKey}</a></p></td>
        <td rowspan="1"><p>Write</p></td>
      </tr>
      <tr>
        <td><p><b>SCENARIO: </b>Device Pool as filter</p></td>
        <td><p><a href="#resource-project">project*</a></p></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td><p><b>SCENARIO: </b>Upload as filter</p></td>
        <td><p><a href="#resource-upload">upload</a></p></td>
        <td></td>
        <td></td>
      </tr>`)
    )

    //When the actions are parsed
    const result = parseActions(doc)

    //Then scenarios are parsed from four-cell scenario rows
    expect(result).toEqual([
      expect.objectContaining({
        name: 'ScheduleRun',
        accessLevel: 'Write',
        resourceTypes: [
          {
            name: 'devicepool',
            required: false,
            conditionKeys: ['aws:ResourceTag/${TagKey}'],
            dependentActions: []
          }
        ],
        scenarios: [
          {
            name: 'Device Pool as filter',
            resourceTypes: [{ name: 'project', required: true }]
          },
          {
            name: 'Upload as filter',
            resourceTypes: [{ name: 'upload', required: false }]
          }
        ]
      })
    ])
  })

  it('accepts adjacent five-column rows with rowspan one', () => {
    //Given adjacent single-row actions with explicit rowspan attributes
    const doc = load(
      actionTable(`<tr>
        <td rowspan="1"><p><a>FirstAction</a></p></td>
        <td rowspan="1"><p>First description</p></td>
        <td></td>
        <td></td>
        <td rowspan="1"><p>List</p></td>
      </tr>
      <tr>
        <td rowspan="1"><p><a>SecondAction</a></p></td>
        <td rowspan="1"><p>Second description</p></td>
        <td></td>
        <td></td>
        <td rowspan="1"><p>Read</p></td>
      </tr>`)
    )
    const table = doc('th:contains("Actions")').parents('table')

    //When the action table assumptions are verified
    const result = verifyActionTableAssumptions(doc, table)

    //Then no assumption failures are reported
    expect(result).toEqual([])
  })
})
