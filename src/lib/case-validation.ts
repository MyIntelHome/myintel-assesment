import { z } from "zod";
import {profileSchema} from "@/domain/home-profile";
import { ASSESSMENT_STATUSES } from "@/domain/status";
import { FAMILY_ANSWERS } from "@/domain/family";
import { SPACE_TYPES, ASSESSMENT_MODES, SEVERITIES, LIKELIHOODS, CONSEQUENCES,
  EVIDENCE_SOURCES, CONFIDENCE_LEVELS, RESIDENT_PRIORITIES, TIMEFRAMES,
  RECOMMENDATION_CATEGORIES, RESPONSIBLE_PARTIES, RECOMMENDATION_STATUSES } from "@/domain/types";
import { AGE_BANDS, HOUSING_TYPES, CLINICAL_CONCERNS } from "@/domain/case";

const text = z.string();
const space = z.object({id:text.min(1),type:z.enum(SPACE_TYPES),label:text,familyKind:z.literal("half_bath").optional(),level:z.number().int().min(1).max(4).optional()});
const intake = z.object({ageBand:z.enum(["",...AGE_BANDS]),housingType:z.enum(["",...HOUSING_TYPES]),
  floors:text,livesAlone:z.enum(["","alone","with_others"]),mobilityAids:text,
  fallsLast12Months:text,concerns:z.array(z.enum(CLINICAL_CONCERNS)),concernNotes:text});
const signoff = z.object({assessorName:text,credentials:text,licenseNumber:text,licenseState:text,
  licenseExpiry:text,organisation:text,signedAt:text.nullable(),partialAssessmentReason:text.optional()});
const detail = z.object({disposition:text,severity:z.enum(SEVERITIES),likelihood:z.enum(LIKELIHOODS),
  consequence:z.enum(CONSEQUENCES),evidenceSource:z.enum(EVIDENCE_SOURCES),confidence:z.enum(CONFIDENCE_LEVELS),
  residentPriority:z.enum(RESIDENT_PRIORITIES),timeframe:z.enum(TIMEFRAMES),notes:text}).partial();
const plan = z.object({id:text,title:text,rationale:text,category:z.enum(RECOMMENDATION_CATEGORIES),
  urgency:z.enum(["",...TIMEFRAMES]),costMin:text,costMax:text,costNotEstimated:z.boolean(),
  responsibleParty:z.enum(["",...RESPONSIBLE_PARTIES]),status:z.enum(RECOMMENDATION_STATUSES),
  targetDate:text,followUpDate:text,linkedFindings:z.array(text)});
const clinical = z.object({reference:text,intake,spaces:z.array(space),
  responses:z.record(text,z.record(text,z.object({status:z.enum(ASSESSMENT_STATUSES),reason:text.optional()}))),
  findings:z.record(text,detail),plan:z.array(plan),signoff});
const completeness = z.object({requiredTotal:z.number(),requiredAssessed:z.number(),optionalTotal:z.number(),
  optionalAssessed:z.number(),percent:z.number(),isComplete:z.boolean(),unableToAssessCount:z.number(),outstanding:z.array(text)});
const limitation = z.object({space,code:text,prompt:text,reason:text});
const view = z.object({perSpace:z.array(z.object({space,completeness})),completeness,
  risk:z.object({state:text,counts:z.object({critical:z.number(),concern:z.number(),total:z.number()}),
    canStateNoRisks:z.boolean(),assessmentIncomplete:z.boolean(),unableToAssessCount:z.number(),statement:text}),
  findings:z.array(z.object({key:text,space,code:text,prompt:text,hint:text,status:z.enum(["concern","critical"]),detail})),
  limitations:z.array(limitation),notApplicable:z.array(limitation)});
const version = z.object({id:text,revision:z.number().int().positive(),supersedesId:text.nullable(),
  attestationVersion:text,attestationText:text,templateVersions:z.record(text,z.number()),caseData:clinical,view});

/** Validate before any saved data reaches renderers. Preserve the original archive on failure. */
export const savedCaseSchema = clinical.extend({
  id:text, audience:z.enum(["unchosen","clinician","family"]),mode:z.enum(ASSESSMENT_MODES),
  intake:intake.partial(),signoff:signoff.partial(),reportVersions:z.array(version),
  familyAnswers:z.record(text,z.enum(FAMILY_ANSWERS)),updatedAt:text.nullable(),
  homeProfile:profileSchema.optional(),
  familyPosition:z.object({phase:z.enum(["welcome","routine","home","rooms","room","milestone","contact","report"]),roomIndex:z.number().int().nonnegative(),questionIndex:z.number().int().nonnegative().optional()}),
}).partial();
