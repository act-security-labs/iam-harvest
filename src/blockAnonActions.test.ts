import { describe, expect, it } from 'vitest'
import { actionBlocksAnonymousAccess, addBlockAnonMetadata } from './blockAnonActions.js'

describe('actionBlocksAnonymousAccess', () => {
  it('matches action names case insensitively', () => {
    //Given an IAM action that blocks anonymous access
    const servicePrefix = 'KMS'
    const actionName = 'Decrypt'

    //When its anonymous-access capability is checked
    const result = actionBlocksAnonymousAccess(servicePrefix, actionName)

    //Then it is marked as blocking anonymous access
    expect(result).toBe(true)
  })

  it('uses the IAM namespace for EFS actions', () => {
    //Given an EFS action under its IAM service prefix
    const servicePrefix = 'elasticfilesystem'
    const actionName = 'DescribeFileSystems'

    //When its anonymous-access capability is checked
    const result = actionBlocksAnonymousAccess(servicePrefix, actionName)

    //Then it is marked as blocking anonymous access
    expect(result).toBe(true)
  })

  it('marks both IAM permissions for the KMS ReEncrypt operation', () => {
    //Given the two IAM actions required by the KMS ReEncrypt API operation
    const actionNames = ['ReEncryptFrom', 'ReEncryptTo']

    //When their anonymous-access capabilities are checked
    const results = actionNames.map((actionName) => actionBlocksAnonymousAccess('kms', actionName))

    //Then both actions block anonymous access
    expect(results).toEqual([true, true])
  })

  it('retains the SNS PublishBatch entry pending AWS source data support', () => {
    //Given the IAM action corresponding to the supplied SNS operation
    const actionName = 'PublishBatch'

    //When its anonymous-access capability is checked
    const result = actionBlocksAnonymousAccess('sns', actionName)

    //Then it is marked for a future harvest that contains the action
    expect(result).toBe(true)
  })
})

describe('addBlockAnonMetadata', () => {
  it('adds blockAnon only to actions that block anonymous access', () => {
    //Given a marked IAM action definition
    const markedAction = { name: 'GetFederationToken', description: 'Gets a federation token' }

    //When sparse anonymous-access metadata is added
    const result = addBlockAnonMetadata('sts', markedAction)

    //Then the action has the compact true marker
    expect(result).toEqual({ ...markedAction, blockAnon: true })
  })

  it('does not add a false marker to actions absent from the data', () => {
    //Given an IAM action definition that is not in the block list
    const unmarkedAction = { name: 'GetCallerIdentity', description: 'Gets caller identity' }

    //When sparse anonymous-access metadata is added
    const result = addBlockAnonMetadata('sts', unmarkedAction)

    //Then the action is unchanged and has no blockAnon key
    expect(result).toEqual(unmarkedAction)
    expect(Object.hasOwn(result, 'blockAnon')).toBe(false)
  })
})
