// Resolve legacy bundled paths at display time; personal guides/backups keep identity.
export function bundledImage(source: string): string {
  return typeof __JIDO_IMAGE_MAP__ !== 'undefined'
    ? __JIDO_IMAGE_MAP__[source] || source
    : source
}
