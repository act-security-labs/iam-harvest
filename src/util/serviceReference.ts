/**
 * Service reference action resource metadata from AWS's programmatic service reference JSON.
 */
export interface ServiceReferenceActionResource {
  /** The resource type name. */
  Name: string
  /** Condition keys that apply to this action/resource-type pair. */
  ConditionKeys?: string[]
}

/**
 * Service reference action metadata from AWS's programmatic service reference JSON.
 */
export interface ServiceReferenceAction {
  /** The IAM action name. */
  Name: string
  /** Condition keys that apply to the action independently of resource type. */
  ActionConditionKeys?: string[]
  /** Dependent actions required by this action, if AWS includes them in the JSON. */
  DependentActions?: string[]
  /** Resource type references for the action. */
  Resources?: ServiceReferenceActionResource[]
}

/**
 * AWS's programmatic service reference JSON for one IAM service prefix.
 */
export interface ServiceReference {
  /** The IAM service prefix. */
  Name: string
  /** Action metadata for the service. */
  Actions: ServiceReferenceAction[]
}
