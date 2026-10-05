export type CommercialMappingNode = Readonly<{ code: string; label: string }>;

export type CommercialMappingContent = Readonly<{
  demandGroups: readonly Readonly<CommercialMappingNode & { segments: readonly CommercialMappingNode[] }>[];
  distributionGroups: readonly Readonly<CommercialMappingNode & {
    sources: readonly Readonly<CommercialMappingNode & { channelCodes: readonly string[] }>[];
  }>[];
  companies: readonly Readonly<CommercialMappingNode & { partyId: string; parentCode: string | null }>[];
  roomClasses: readonly Readonly<CommercialMappingNode & { unitTypeIds: readonly string[] }>[];
  marketMappings: readonly Readonly<{ marketCode: string; segmentCode: string }>[];
}>;

export type CommercialMappingVersion = Readonly<{
  id: string;
  version: number;
  content: CommercialMappingContent;
}>;

export type CommercialMappingsSnapshot = Readonly<{
  active: CommercialMappingVersion | null;
  draft: CommercialMappingVersion | null;
  latestVersion: number;
  canWrite: boolean;
}>;

export type SaveCommercialMappingsInput = Readonly<{
  content: CommercialMappingContent;
  expectedVersion: number;
}>;

export type SavedCommercialMappings = Readonly<CommercialMappingVersion & { status: "draft" }>;
