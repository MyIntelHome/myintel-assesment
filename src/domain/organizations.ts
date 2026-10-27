export const ORGANIZATION_SHARING_VERSION = "organization-summary-2026-10-27";
export const ORGANIZATION_SHARING_TEXT = "I have authorization to share this limited case summary with this organization's current and future approved professional members until I withdraw it. This includes the assessor's name, assessment status, finding counts, concern score and the next follow-up date. It excludes client names, personal case references, answers, notes, reports and photos.";
export interface OrganizationSummary {
  id: string;
  name: string;
  role: "owner" | "member";
  revision: number;
  updatedAt: string;
}
export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  expiresAt: string;
}
export interface SharedCaseSummary {
  id: string;
  reference: string;
  assessorId: string;
  assessorName: string;
  own: boolean;
  signed: boolean;
  reportCount: number;
  areaCount: number;
  findings: number;
  critical: number;
  concernPercent: number | null;
  incomplete: boolean;
  followUpDate: string | null;
  sourceUpdatedAt: string | null;
  sharedAt: string;
}
export interface OrganizationDetail {
  organization: OrganizationSummary;
  canViewSummaries: boolean;
  members: { userId: string; name: string; email: string; role: "owner" | "member"; professionalStatus: string }[];
  invitations: OrganizationInvitation[];
  summaries: SharedCaseSummary[];
  events: { id: string; actorName: string; type: string; createdAt: string }[];
}
