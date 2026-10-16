export const planningViews = ['schedule', 'route', 'transfers'] as const
export const preparationViews = [
  'overview',
  'reservations',
  'checklist',
  'files',
] as const
export function workspaceGroup(workspace: string) {
  if ((planningViews as readonly string[]).includes(workspace))
    return 'schedule'
  if ((preparationViews as readonly string[]).includes(workspace))
    return 'overview'
  return workspace === 'field' ? 'field' : 'expenses'
}
