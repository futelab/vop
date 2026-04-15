export interface VOPPageRef {
    pageId: string;
    title: string;
    route: string;
}
export interface VOPNavigationRule {
    fromPageId?: string;
    toPageId: string;
    kind: "direct";
}
export interface VOPAppManifest {
    appId: string;
    version: string;
    entryPageId?: string;
    pages: VOPPageRef[];
    navigation: VOPNavigationRule[];
}
//# sourceMappingURL=app-manifest.d.ts.map