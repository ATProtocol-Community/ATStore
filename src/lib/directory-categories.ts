export type DirectoryCategoryAccent = 'blue' | 'pink' | 'purple' | 'green'

export interface DirectoryCategoryTreeNode {
  id: string
  label: string
  description: string
  accent: DirectoryCategoryAccent
  count: number
  depth: number
  pathIds: string[]
  pathLabels: string[]
  children: DirectoryCategoryTreeNode[]
}

export interface DirectoryCategoryOption {
  id: string
  label: string
  description: string
  accent: DirectoryCategoryAccent
  depth: number
  pathIds: string[]
  pathLabels: string[]
  pathLabel: string
}

export interface StructuredDirectoryCategoryDraft {
  kind: string
  appName: string
  appCategory: string
  protocolCategory: string
}

export interface StructuredDirectoryCategorySuggestions {
  kindOptions: Array<{ id: 'apps' | 'protocol'; label: string }>
  appNameOptions: Array<{ id: string; label: string }>
  protocolCategoryOptions: Array<{ id: string; label: string }>
  appCategoryOptionsByAppName: Record<string, Array<{ id: string; label: string }>>
}

const ROOT_CATEGORY_IDS = ['apps', 'protocol'] as const

function normalizeCategorySegment(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatCategorySegmentLabel(segment: string) {
  if (segment === 'apps') return 'Apps'
  if (segment === 'protocol') return 'Protocol'
  if (segment === 'pds') return 'PDS'
  if (segment === 'appview') return 'AppView'

  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function getCategoryAccent(pathIds: string[]): DirectoryCategoryAccent {
  if (pathIds[0] === 'apps') {
    return pathIds.length >= 3 ? 'green' : 'blue'
  }

  if (pathIds[0] === 'protocol') {
    return pathIds.length >= 2 ? 'purple' : 'pink'
  }

  return 'blue'
}

function getCategoryDescription(pathLabels: string[]) {
  if (pathLabels.length === 1 && pathLabels[0] === 'Apps') {
    return 'User-facing apps and app ecosystems.'
  }

  if (pathLabels.length === 1 && pathLabels[0] === 'Protocol') {
    return 'Protocol infrastructure, services, and tooling.'
  }

  if (pathLabels[0] === 'Apps' && pathLabels.length === 2) {
    return `${pathLabels[1]} apps and ecosystem tools.`
  }

  if (pathLabels[0] === 'Apps' && pathLabels.length >= 3) {
    return `${pathLabels[pathLabels.length - 1]} tools within ${pathLabels[1]}.`
  }

  if (pathLabels[0] === 'Protocol' && pathLabels.length >= 2) {
    return `${pathLabels[pathLabels.length - 1]} protocol tooling and infrastructure.`
  }

  return `Browse listings in ${pathLabels.join(' / ')}.`
}

function sanitizePathIds(pathIds: string[]) {
  return pathIds
    .map(normalizeCategorySegment)
    .filter(Boolean)
}

function createOption(pathIds: string[]): DirectoryCategoryOption {
  const normalizedPathIds = sanitizePathIds(pathIds)
  const pathLabels = normalizedPathIds.map(formatCategorySegmentLabel)

  return {
    id: normalizedPathIds.join('/'),
    label: pathLabels[pathLabels.length - 1] || 'Unknown',
    description: getCategoryDescription(pathLabels),
    accent: getCategoryAccent(normalizedPathIds),
    depth: Math.max(0, normalizedPathIds.length - 1),
    pathIds: normalizedPathIds,
    pathLabels,
    pathLabel: pathLabels.join(' / '),
  }
}

export function getDirectoryCategoryOption(categoryId: string | null | undefined) {
  if (!categoryId) {
    return null
  }

  const normalizedPathIds = sanitizePathIds(categoryId.split('/'))
  if (normalizedPathIds.length === 0) {
    return null
  }

  return createOption(normalizedPathIds)
}

export function getDirectoryBrowsePath(categoryId: string | null | undefined) {
  const option = getDirectoryCategoryOption(categoryId)
  const rootCategoryId = option?.pathIds[0]

  if (rootCategoryId === 'apps') {
    return '/apps/all'
  }

  if (rootCategoryId === 'protocol') {
    return '/protocol/all'
  }

  return '/categories/all'
}


export function buildStructuredDirectoryCategorySlug(
  draft: StructuredDirectoryCategoryDraft,
) {
  const kind = normalizeCategorySegment(draft.kind)

  if (kind === 'apps') {
    const appName = normalizeCategorySegment(draft.appName)
    const appCategory = normalizeCategorySegment(draft.appCategory)

    if (!appName) {
      return null
    }

    return appCategory ? `apps/${appName}/${appCategory}` : `apps/${appName}`
  }

  if (kind === 'protocol') {
    const protocolCategory = normalizeCategorySegment(draft.protocolCategory)

    if (!protocolCategory) {
      return null
    }

    return `protocol/${protocolCategory}`
  }

  return null
}

export function parseStructuredDirectoryCategory(
  categorySlug: string | null | undefined,
): StructuredDirectoryCategoryDraft {
  const option = getDirectoryCategoryOption(categorySlug)

  if (!option) {
    return {
      kind: '',
      appName: '',
      appCategory: '',
      protocolCategory: '',
    }
  }

  if (option.pathIds[0] === 'apps') {
    return {
      kind: 'apps',
      appName: option.pathLabels[1] || '',
      appCategory: option.pathLabels[2] || '',
      protocolCategory: '',
    }
  }

  if (option.pathIds[0] === 'protocol') {
    return {
      kind: 'protocol',
      appName: '',
      appCategory: '',
      protocolCategory: option.pathLabels[1] || '',
    }
  }

  return {
    kind: '',
    appName: '',
    appCategory: '',
    protocolCategory: '',
  }
}

export function collectStructuredDirectoryCategorySuggestions(
  categorySlugs: Iterable<string | null | undefined>,
): StructuredDirectoryCategorySuggestions {
  const appNames = new Map<string, string>()
  const protocolCategories = new Map<string, string>()
  const appCategoriesByAppName = new Map<string, Map<string, string>>()

  for (const categorySlug of categorySlugs) {
    const option = getDirectoryCategoryOption(categorySlug)
    if (!option) {
      continue
    }

    if (option.pathIds[0] === 'apps') {
      const appNameId = option.pathIds[1]
      const appNameLabel = option.pathLabels[1]

      if (appNameId && appNameLabel) {
        appNames.set(appNameId, appNameLabel)
      }

      const appCategoryId = option.pathIds[2]
      const appCategoryLabel = option.pathLabels[2]
      if (appNameId && appCategoryId && appCategoryLabel) {
        if (!appCategoriesByAppName.has(appNameId)) {
          appCategoriesByAppName.set(appNameId, new Map())
        }

        appCategoriesByAppName.get(appNameId)?.set(appCategoryId, appCategoryLabel)
      }
    }

    if (option.pathIds[0] === 'protocol') {
      const protocolCategoryId = option.pathIds[1]
      const protocolCategoryLabel = option.pathLabels[1]

      if (protocolCategoryId && protocolCategoryLabel) {
        protocolCategories.set(protocolCategoryId, protocolCategoryLabel)
      }
    }
  }

  return {
    kindOptions: [
      { id: 'apps', label: 'Apps' },
      { id: 'protocol', label: 'Protocol' },
    ],
    appNameOptions: [...appNames.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, label]) => ({ id, label })),
    protocolCategoryOptions: [...protocolCategories.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, label]) => ({ id, label })),
    appCategoryOptionsByAppName: Object.fromEntries(
      [...appCategoriesByAppName.entries()].map(([appNameId, entries]) => [
        appNameId,
        [...entries.entries()]
          .sort((left, right) => left[1].localeCompare(right[1]))
          .map(([id, label]) => ({ id, label })),
      ]),
    ),
  }
}

export function buildDirectoryCategoryTree(
  assignedCategoryIds: Iterable<string | null | undefined>,
) {
  type MutableNode = {
    id: string
    count: number
    children: Map<string, MutableNode>
  }

  const root = new Map<string, MutableNode>()

  for (const rootCategoryId of ROOT_CATEGORY_IDS) {
    root.set(rootCategoryId, {
      id: rootCategoryId,
      count: 0,
      children: new Map(),
    })
  }

  for (const categoryId of assignedCategoryIds) {
    const option = getDirectoryCategoryOption(categoryId)
    if (!option) {
      continue
    }

    let level = root

    for (const pathId of option.pathIds) {
      const currentNode = level.get(pathId)
      if (!currentNode) {
        const nextNode: MutableNode = {
          id: pathId,
          count: 0,
          children: new Map(),
        }

        level.set(pathId, nextNode)
      }

      const node = level.get(pathId)
      if (!node) {
        continue
      }

      node.count += 1
      level = node.children
    }
  }

  function toTreeNode(
    node: MutableNode,
    parentPathIds: string[] = [],
  ): DirectoryCategoryTreeNode {
    const pathIds = [...parentPathIds, node.id]
    const option = createOption(pathIds)
    const children = [...node.children.values()]
      .sort((left, right) => {
        const leftOption = createOption([...pathIds, left.id])
        const rightOption = createOption([...pathIds, right.id])

        if (right.count !== left.count) {
          return right.count - left.count
        }

        return leftOption.label.localeCompare(rightOption.label)
      })
      .map((child) => toTreeNode(child, pathIds))

    return {
      id: option.id,
      label: option.label,
      description: option.description,
      accent: option.accent,
      count: node.count,
      depth: option.depth,
      pathIds: option.pathIds,
      pathLabels: option.pathLabels,
      children,
    }
  }

  return [...root.values()].map((node) => toTreeNode(node))
}

export function flattenDirectoryCategoryTree(nodes: DirectoryCategoryTreeNode[]) {
  const flattened: DirectoryCategoryTreeNode[] = []

  const walk = (node: DirectoryCategoryTreeNode) => {
    flattened.push(node)

    for (const child of node.children) {
      walk(child)
    }
  }

  for (const node of nodes) {
    walk(node)
  }

  return flattened
}

export function findDirectoryCategoryNode(
  nodes: DirectoryCategoryTreeNode[],
  categoryId: string,
): DirectoryCategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node
    }

    const match = findDirectoryCategoryNode(node.children, categoryId)
    if (match) {
      return match
    }
  }

  return null
}

export function getDirectoryCategoryDescendantIds(
  nodes: DirectoryCategoryTreeNode[],
  categoryId: string,
) {
  const match = findDirectoryCategoryNode(nodes, categoryId)
  if (!match) {
    return []
  }

  return flattenDirectoryCategoryTree([match]).map((node) => node.id)
}
