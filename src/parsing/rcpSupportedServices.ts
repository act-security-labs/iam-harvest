const rcpSupportedServicesMarker = 'RCPs apply to actions for the following AWS services:'

/**
 * Parse IAM service prefixes for services that support AWS Organizations RCPs.
 *
 * @param markdown the AWS Organizations RCP markdown page contents
 * @returns sorted IAM service prefixes that support RCPs
 */
export function parseRcpSupportedServices(markdown: string): string[] {
  const markerIndex = markdown.indexOf(rcpSupportedServicesMarker)
  if (markerIndex === -1) {
    throw new Error(`Could not find RCP supported services section marker`)
  }

  const section = markdown.substring(markerIndex + rcpSupportedServicesMarker.length)
  const prefixes = new Set<string>()
  let sawListItem = false

  for (const line of section.split('\n')) {
    if (line.startsWith('## ')) {
      break
    }

    if (!line.startsWith('+ ')) {
      continue
    }

    sawListItem = true
    const prefixMatch = line.match(/`\[([a-z0-9-]+)]`/)
    if (!prefixMatch) {
      throw new Error(
        `RCP supported service list item is missing a bracketed service prefix: ${line}`
      )
    }
    prefixes.add(prefixMatch[1])
  }

  if (!sawListItem || prefixes.size === 0) {
    throw new Error('No RCP supported services found in RCP markdown')
  }

  return [...prefixes].sort()
}
