/**
 * A category entry parsed from the AWS Overview category index.
 */
export interface AwsCategoryLink {
  /** Stable category key used in generated iam-data files. */
  key: string
  /** Properly capitalized category name from AWS Overview. */
  name: string
  /** Relative markdown path for the category page. */
  path: string
}

/**
 * Details for an IAM service category generated for iam-data.
 */
export interface CategoryDetails {
  /** Stable category key. */
  key: string
  /** Properly capitalized category name from AWS Overview. */
  name: string
  /** Sorted IAM service prefixes assigned to the category. */
  services: string[]
}
