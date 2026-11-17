// This input is a PA presentation view for already approved public information.
// Raw canonical records do not currently carry an approved resource/version view.
export interface PublicResource {
  readonly label: string;
  readonly href: string;
}
export interface PublicVersion {
  readonly label: string;
  readonly date: string;
  readonly summary?: string;
}
export interface WorkProvenance {
  readonly resources: readonly PublicResource[];
  readonly versions: readonly PublicVersion[];
}

export function vettedResources(resources: readonly PublicResource[]): PublicResource[] {
  return resources.filter(({ label, href }) => {
    if (!label.trim() || !/^https:\/\//i.test(href) || /[\s\\]/.test(href)) return false;
    try {
      const target = new URL(href);
      return target.protocol === 'https:' && !!target.hostname && !target.username && !target.password;
    } catch {
      return false;
    }
  });
}
