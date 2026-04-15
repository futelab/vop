import type { VOPCapabilityDescriptor } from "./capability-model";
import type { VOPActionDescriptor } from "./action-descriptors";
import type { VOPObservationDescriptor } from "./observation-descriptors";
export interface VOPPageManifest {
    pageId: string;
    title: string;
    route: string;
    capabilities: VOPCapabilityDescriptor[];
    actions: VOPActionDescriptor[];
    observations: VOPObservationDescriptor[];
}
//# sourceMappingURL=page-manifest.d.ts.map