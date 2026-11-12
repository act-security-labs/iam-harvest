import { describe, expect, it } from 'vitest'
import { validateRcpServices } from './validateRcpServices.js'

describe('RCP service validation', () => {
  it('maps the Lex runtime label to the IAM prefix and sorts and deduplicates', () => {
    //Given RCP labels including both the runtime name and IAM prefix
    const services = ['s3', 'lexv2-runtime', 'lex']

    //When the labels are validated against IAM services
    const result = validateRcpServices(services, ['lex', 's3'])

    //Then the result contains only unique IAM prefixes
    expect(result).toEqual(['lex', 's3'])
  })

  it('maps the runtime label even when lex is not separately listed', () => {
    //Given an RCP list with the runtime label only
    const services = ['lexv2-runtime']

    //When the labels are validated
    const result = validateRcpServices(services, ['lex'])

    //Then the IAM prefix is included
    expect(result).toEqual(['lex'])
  })

  it('passes through known IAM prefixes', () => {
    //Given ordinary known RCP labels
    const services = ['s3', 'lex']

    //When the labels are validated
    const result = validateRcpServices(services, ['s3', 'lex'])

    //Then the prefixes are sorted
    expect(result).toEqual(['lex', 's3'])
  })

  it('rejects an alias that becomes a real IAM prefix even if it is not listed by RCPs', () => {
    //Given a newly harvested IAM service colliding with the configured alias
    const services = ['s3']

    //When validation runs
    const validate = () => validateRcpServices(services, ['lex', 'lexv2-runtime', 's3'])

    //Then it fails rather than hiding a new service
    expect(validate).toThrow(/lexv2-runtime.*IAM service/)
  })

  it('rejects unknown RCP services', () => {
    //Given an unknown label
    const services = ['unknown']

    //When validation runs
    const validate = () => validateRcpServices(services, ['lex'])

    //Then the unknown label is reported
    expect(validate).toThrow('RCP supported services reference unknown IAM services: unknown')
  })

  it('rejects an alias whose IAM target is missing', () => {
    //Given a runtime label without its IAM target
    const services = ['lexv2-runtime']

    //When validation runs
    const validate = () => validateRcpServices(services, ['s3'])

    //Then the missing IAM target is reported
    expect(validate).toThrow('RCP alias lexv2-runtime references missing IAM service lex')
  })
})
