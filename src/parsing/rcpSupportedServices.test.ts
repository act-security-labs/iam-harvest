import { describe, expect, it } from 'vitest'
import { parseRcpSupportedServices } from './rcpSupportedServices.js'

describe('RCP supported services parsing', () => {
  it('parses bracketed IAM prefixes from the supported services section', () => {
    //Given an AWS Organizations RCP markdown snippet
    const markdown = `# Resource control policies

RCPs apply to actions for the following AWS services:
+ [Amazon S3](https://docs.aws.amazon.com/s3) \`[s3]\`
+ [AWS Key Management Service](https://docs.aws.amazon.com/kms) \`[kms]\`

## Testing effects of RCPs
`

    //When the RCP supported services are parsed
    const result = parseRcpSupportedServices(markdown)

    //Then IAM service prefixes are returned in sorted order
    expect(result).toEqual(['kms', 's3'])
  })

  it('stops parsing at the next markdown heading', () => {
    //Given an RCP markdown page with a later unrelated RCP bullet
    const markdown = `RCPs apply to actions for the following AWS services:
+ [Amazon SQS](https://docs.aws.amazon.com/sqs) \`[sqs]\`

## RCP effects on permissions
+ RCPs apply to resources for a subset of AWS services.
+ [Not a supported service](https://example.com) \`[not-a-service]\`
`

    //When the RCP supported services are parsed
    const result = parseRcpSupportedServices(markdown)

    //Then only the target section list is parsed
    expect(result).toEqual(['sqs'])
  })

  it('ignores service link text and uses bracketed IAM prefixes as authoritative', () => {
    //Given a supported services list item whose link text is a URL
    const markdown = `RCPs apply to actions for the following AWS services:
+ [https://docs.aws.amazon.com/polly](https://docs.aws.amazon.com/polly) \`[polly]\`
`

    //When the RCP supported services are parsed
    const result = parseRcpSupportedServices(markdown)

    //Then the service prefix is parsed from the bracketed backtick value
    expect(result).toEqual(['polly'])
  })

  it('de-duplicates duplicate supported service prefixes', () => {
    //Given duplicate service prefixes in the supported services list
    const markdown = `RCPs apply to actions for the following AWS services:
+ [Amazon S3](https://docs.aws.amazon.com/s3) \`[s3]\`
+ [Amazon S3 duplicate](https://docs.aws.amazon.com/s3) \`[s3]\`
`

    //When the RCP supported services are parsed
    const result = parseRcpSupportedServices(markdown)

    //Then the prefix appears only once
    expect(result).toEqual(['s3'])
  })

  it('throws when the supported services marker is absent', () => {
    //Given markdown without the expected supported services marker
    const markdown = `# Resource control policies\n`

    //When the RCP supported services are parsed
    const parse = () => parseRcpSupportedServices(markdown)

    //Then parsing fails loudly
    expect(parse).toThrow('Could not find RCP supported services section marker')
  })

  it('throws when a supported service list item has no backtick prefix', () => {
    //Given an RCP supported services list item without any prefix value
    const markdown = `RCPs apply to actions for the following AWS services:
+ Amazon S3
`

    //When the RCP supported services are parsed
    const parse = () => parseRcpSupportedServices(markdown)

    //Then parsing fails loudly instead of guessing from the service name
    expect(parse).toThrow('RCP supported service list item is missing a bracketed service prefix')
  })

  it('throws when a supported service list item is missing a bracketed prefix', () => {
    //Given an RCP supported services list item without the expected prefix format
    const markdown = `RCPs apply to actions for the following AWS services:
+ [Amazon S3](https://docs.aws.amazon.com/s3) \`s3\`
`

    //When the RCP supported services are parsed
    const parse = () => parseRcpSupportedServices(markdown)

    //Then parsing fails loudly instead of guessing from the service name
    expect(parse).toThrow('RCP supported service list item is missing a bracketed service prefix')
  })

  it('throws when no supported service prefixes are found', () => {
    //Given an empty RCP supported services section
    const markdown = `RCPs apply to actions for the following AWS services:\n\n## Testing effects of RCPs\n`

    //When the RCP supported services are parsed
    const parse = () => parseRcpSupportedServices(markdown)

    //Then parsing fails loudly
    expect(parse).toThrow('No RCP supported services found in RCP markdown')
  })
})
