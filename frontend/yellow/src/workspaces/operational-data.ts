export type OperationalStay = Readonly<{
  reservationId: string;
  confirmationNo: string;
  primaryGuestDisplayName?: string;
  primaryPartyName?: string;
  operationalState?: string;
  sellableUnitLabel?: string;
  unitTypeLabel?: string;
  channelCode?: string;
  sourceCode?: string;
  stayFrom?: string;
  stayTo?: string;
}>;

export type OperationalRoom = Readonly<{
  spaceId: string;
  spaceLabel: string;
  condition: string;
  occupancyState?: string | null;
  task?: Readonly<{ taskId: string; state: string }> | null;
}>;

export type OperationalBlock = Readonly<{
  id?: string;
  blockId?: string;
  label?: string;
  title?: string;
  state?: string;
  reason?: string;
}>;

export type QueryState<T> = Readonly<{
  data?: T;
  isLoading: boolean;
  isError: boolean;
}>;
