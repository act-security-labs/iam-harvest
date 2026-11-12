// Organizations uses the Lex runtime SDK name; IAM authorizes these actions under lex.
const rcpAliases = new Map([['lexv2-runtime', 'lex']])

/**
 * Normalize and validate RCP labels against the harvested IAM service prefixes.
 *
 * @param services RCP service labels
 * @param iamServices harvested IAM service prefixes
 * @returns validated RCP service prefixes
 */
export function validateRcpServices(services: string[], iamServices: string[]): string[] {
  const knownServices = new Set(iamServices)
  for (const [alias, target] of rcpAliases) {
    if (knownServices.has(alias)) {
      throw new Error(`RCP alias ${alias} is now an IAM service; review its mapping`)
    }
    if (services.includes(alias) && !knownServices.has(target)) {
      throw new Error(`RCP alias ${alias} references missing IAM service ${target}`)
    }
  }

  const normalized = [
    ...new Set(services.map((service) => rcpAliases.get(service) ?? service))
  ].sort()
  const unknownServices = normalized.filter((service) => !knownServices.has(service))
  if (unknownServices.length > 0) {
    throw new Error(
      `RCP supported services reference unknown IAM services: ${unknownServices.join(', ')}`
    )
  }
  return normalized
}
