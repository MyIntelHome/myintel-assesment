/**
 * Assessment templates, version 1.
 *
 * Ported item-for-item from the v1 prototype. Item codes are preserved
 * exactly so historical content remains traceable.
 *
 * Every item carries two phrasings:
 *   - `prompt` / `hint`  — the clinician's framing, unchanged from v1.
 *   - `promptPlain`      — one plain-language yes/no question for the family
 *                          flow, paired with `concernWhen` so the app knows
 *                          which answer suggests a problem. Polarity varies
 *                          per item and is never inferred.
 *
 * Templates are keyed by space type, not by room, so a home can contain any
 * number of bedrooms, bathrooms, entrances, or stairways.
 */

import type { AssessmentTemplate, SpaceType } from "@/domain/types";

const ENTRY: AssessmentTemplate = {
  spaceType: "entry",
  version: 1,
  items: [
    {
      code: "e1",
      prompt: "Door threshold",
      hint: "Raised vs flush — trip hazard present?",
      promptPlain: "Is there a raised edge or lip where the door opens?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "e2",
      prompt: "Entry lighting",
      hint: "Adequate brightness at night?",
      promptPlain: "Can you see clearly at this door after dark?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "e3",
      prompt: "Non-slip surface at entry",
      hint: "Mat secured, flush tile, or textured?",
      promptPlain: "Does the surface by this door get slippery when it is wet?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "e4",
      prompt: "Step / ramp condition",
      hint: "Stable, no cracks or frost heaving?",
      promptPlain: "Are the steps or ramp firm and even, with no cracks or wobble?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
    {
      code: "e5",
      prompt: "Handrails at steps",
      hint: "Present, graspable, anchored securely?",
      promptPlain: "Is there a handrail beside the steps that stays firm when you lean on it?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "e6",
      prompt: "Door hardware",
      hint: "Lever vs round knob — operable one-handed?",
      promptPlain: "Does this door have a round knob you have to grip and twist?",
      concernWhen: "yes",
      category: "access",
      required: true,
    },
    {
      code: "e7",
      prompt: "Visible house numbers",
      hint: "Emergency responders can locate quickly?",
      promptPlain: "Can the house number be read from the street at night?",
      concernWhen: "no",
      category: "emergency",
      required: true,
    },
  ],
};

const LIVING: AssessmentTemplate = {
  spaceType: "living",
  version: 1,
  items: [
    {
      code: "l1",
      prompt: "Throw rugs / loose mats",
      hint: "Unsecured rugs — trip hazard?",
      promptPlain: "Are there any rugs or mats that slide, curl up, or are not fixed down?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "l2",
      prompt: "Furniture pathway clearance",
      hint: 'Greater than 24" clear paths between pieces?',
      promptPlain: "Is there a clear path through the room without squeezing past furniture?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
    {
      code: "l3",
      prompt: "Lighting adequacy",
      hint: "Bright enough, switches accessible?",
      promptPlain: "Is this room bright enough to see everything clearly?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "l4",
      prompt: "Power cord management",
      hint: "Cords crossing walking paths?",
      promptPlain: "Do any cords or wires cross a place where someone walks?",
      concernWhen: "yes",
      category: "hazards",
      required: true,
    },
    {
      code: "l5",
      prompt: "Chair / sofa transfer height",
      hint: "Appropriate for safe sit-to-stand?",
      promptPlain: "Can they get out of the chair or sofa without help or a struggle?",
      concernWhen: "no",
      category: "transfers",
      required: true,
    },
    {
      code: "l6",
      prompt: "Emergency device accessible",
      hint: "Phone or alert within reach from seating?",
      promptPlain: "Can they reach a phone while sitting down, without getting up?",
      concernWhen: "no",
      category: "emergency",
      required: true,
    },
    {
      code: "l7",
      prompt: "Fall detection coverage",
      hint: "Sensor or wearable alert device present?",
      promptPlain: "Is there anything that would call for help automatically after a fall?",
      concernWhen: "no",
      category: "emergency",
      required: false,
    },
  ],
};

const KITCHEN: AssessmentTemplate = {
  spaceType: "kitchen",
  version: 1,
  items: [
    {
      code: "k1",
      prompt: "Flooring slip resistance",
      hint: "Wet floor risk — surface texture adequate?",
      promptPlain: "Does the kitchen floor get slippery when something spills?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "k2",
      prompt: "Cabinet / shelf reach zones",
      hint: "Frequently used items within safe reach?",
      promptPlain: "Are everyday items within easy reach, without stretching or bending?",
      concernWhen: "no",
      category: "reach",
      required: true,
    },
    {
      code: "k3",
      prompt: "Counter clearance",
      hint: "Workspace clear, stable for support if needed?",
      promptPlain: "Is there clear counter space to set things down?",
      concernWhen: "no",
      category: "surfaces",
      required: true,
    },
    {
      code: "k4",
      prompt: "Stove control placement",
      hint: "Front vs rear controls — burn or lean risk?",
      promptPlain: "Do they have to reach over the burners to turn the stove on?",
      concernWhen: "yes",
      category: "hazards",
      required: true,
    },
    {
      code: "k5",
      prompt: "Smoke / CO detectors",
      hint: "Present, functional, dated?",
      promptPlain: "Is there a working smoke alarm near the kitchen?",
      concernWhen: "no",
      category: "emergency",
      required: true,
    },
    {
      code: "k6",
      prompt: "Task lighting",
      hint: "Adequate lighting over work surfaces?",
      promptPlain: "Is there enough light on the counter to see while preparing food?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "k7",
      prompt: "Step stool use",
      hint: "Using a rated stool vs unsafe substitute?",
      promptPlain: "Do they ever stand on a chair or box to reach something high up?",
      concernWhen: "yes",
      category: "reach",
      required: true,
    },
  ],
};

const STAIRWAY: AssessmentTemplate = {
  spaceType: "stairway",
  version: 1,
  items: [
    {
      code: "s1",
      prompt: "Handrails — both sides",
      hint: "Continuous, graspable, anchored?",
      promptPlain: "Is there a firm handrail on both sides of these stairs?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "s2",
      prompt: "Stair tread condition",
      hint: "Worn, loose, or smooth surface risk?",
      promptPlain: "Are any steps worn smooth, loose, or covered in lifting carpet?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "s3",
      prompt: "Tread edge contrast",
      hint: "Visible contrast — adequate for low vision?",
      promptPlain: "Can you clearly see where each step ends?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "s4",
      prompt: "Lighting at top and bottom",
      hint: "Switch accessible from both landings?",
      promptPlain: "Can the stair light be switched on from both the top and the bottom?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "s5",
      prompt: "Clear stair width",
      hint: 'Minimum 36" for safe navigation?',
      promptPlain: "Is the stairway wide enough to walk down while holding the rail?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
    {
      code: "s6",
      prompt: "Clutter on stairs",
      hint: "Items stored on treads?",
      promptPlain: "Is anything stored or left sitting on the steps?",
      concernWhen: "yes",
      category: "hazards",
      required: true,
    },
    {
      code: "s7",
      prompt: "Stair lift evaluation",
      hint: "Clinically appropriate to assess?",
      promptPlain: "Would a stair lift be worth considering for this home?",
      concernWhen: "no",
      category: "access",
      required: false,
    },
  ],
};

const BATHROOM: AssessmentTemplate = {
  spaceType: "bathroom",
  version: 1,
  items: [
    {
      code: "b1",
      prompt: "Grab bars at toilet",
      hint: "Properly anchored, correct height?",
      promptPlain: "Is there a grab bar beside the toilet that holds firm?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "b2",
      prompt: "Grab bars in shower / tub",
      hint: "Entry, back wall, and side wall?",
      promptPlain: "Are there grab bars to hold when getting into the shower or bath?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "b3",
      prompt: "Non-slip in shower / tub",
      hint: "Mat secured or textured surface?",
      promptPlain: "Is the bottom of the shower or bath slippery underfoot?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
    {
      code: "b4",
      prompt: "Shower seat / bench",
      hint: "Present and rated for client weight?",
      promptPlain: "Is there somewhere safe to sit down while showering?",
      concernWhen: "no",
      category: "transfers",
      required: true,
    },
    {
      code: "b5",
      prompt: "Toilet height",
      hint: "Standard vs comfort height — transfer risk?",
      promptPlain: "Can they stand up from the toilet without straining or pulling on something?",
      concernWhen: "no",
      category: "transfers",
      required: true,
    },
    {
      code: "b6",
      prompt: "Night light path",
      hint: "Path lit from bedroom to toilet at night?",
      promptPlain: "Is the way from the bed to the toilet lit at night?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "b7",
      prompt: "Faucet controls",
      hint: "Lever vs knob, anti-scald protection?",
      promptPlain: "Are the taps hard to turn with a weak or painful grip?",
      concernWhen: "yes",
      category: "access",
      required: true,
    },
    {
      code: "b8",
      prompt: "Floor when wet",
      hint: "Slip hazard exiting shower onto floor?",
      promptPlain: "Does the floor get slippery when stepping out of the shower or bath?",
      concernWhen: "yes",
      category: "surfaces",
      required: true,
    },
  ],
};

const BEDROOM: AssessmentTemplate = {
  spaceType: "bedroom",
  version: 1,
  items: [
    {
      code: "br1",
      prompt: "Bed height for transfer",
      hint: "Appropriate height for safe sit-to-stand?",
      promptPlain: "Sitting on the edge of the bed, can they put both feet flat on the floor?",
      concernWhen: "no",
      category: "transfers",
      required: true,
    },
    {
      code: "br2",
      prompt: "Path to bathroom clear",
      hint: "Furniture-free nighttime route?",
      promptPlain: "Is the route from the bed to the bathroom clear of furniture and clutter?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
    {
      code: "br3",
      prompt: "Night lighting / switch reach",
      hint: "Light switch or sensor accessible from bed?",
      promptPlain: "Can they turn on a light from the bed, without crossing a dark room?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "br4",
      prompt: "Emergency device in reach",
      hint: "Phone or alert device reachable from bed?",
      promptPlain: "Can they reach a phone while lying in bed?",
      concernWhen: "no",
      category: "emergency",
      required: true,
    },
    {
      code: "br5",
      prompt: "Bed rail / assist device",
      hint: "Support for bed mobility and transfer?",
      promptPlain: "Is there something sturdy to hold when getting in or out of bed?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "br6",
      prompt: "Clutter / equipment management",
      hint: "Oxygen tanks, cords creating trip hazard?",
      promptPlain: "Is there equipment, tubing, or clutter near the bed that could be tripped over?",
      concernWhen: "yes",
      category: "hazards",
      required: true,
    },
    {
      code: "br7",
      prompt: "Closet accessibility",
      hint: "Safe reach — no step stool needed?",
      promptPlain: "Can they reach their clothes without stretching high or climbing?",
      concernWhen: "no",
      category: "reach",
      required: true,
    },
  ],
};

const EXTERIOR: AssessmentTemplate = {
  spaceType: "exterior",
  version: 1,
  items: [
    {
      code: "ex1",
      prompt: "Pathway condition",
      hint: "Cracks, uneven surfaces, frost heaving?",
      promptPlain: "Is the path to the door even, with no cracks or raised sections?",
      concernWhen: "no",
      category: "surfaces",
      required: true,
    },
    {
      code: "ex2",
      prompt: "Exterior lighting",
      hint: "Motion-activated, adequate coverage?",
      promptPlain: "Is the path to the door lit after dark?",
      concernWhen: "no",
      category: "lighting",
      required: true,
    },
    {
      code: "ex3",
      prompt: "Driveway / parking surface",
      hint: "Safe surface, fall risk?",
      promptPlain: "Is the driveway or parking area even and safe to walk across?",
      concernWhen: "no",
      category: "surfaces",
      required: true,
    },
    {
      code: "ex4",
      prompt: "Exterior handrails",
      hint: "All steps have sturdy rails?",
      promptPlain: "Does every set of outdoor steps have a firm handrail?",
      concernWhen: "no",
      category: "support",
      required: true,
    },
    {
      code: "ex5",
      prompt: "Mailbox accessibility",
      hint: "Safe path and reach to mailbox?",
      promptPlain: "Can they get to the mailbox safely?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
    {
      code: "ex6",
      prompt: "Entry ramp condition",
      hint: "Non-slip, stable, correct slope?",
      promptPlain: "If there is a ramp, is it stable and non-slip?",
      concernWhen: "no",
      category: "access",
      required: true,
    },
  ],
};

/**
 * Space types without a template yet. Adding items here is clinical content
 * authoring and needs practitioner input, not invention — a case may still
 * contain these spaces and record notes and findings against them.
 */
const EMPTY_TEMPLATE = (spaceType: SpaceType): AssessmentTemplate => ({
  spaceType,
  version: 1,
  items: [],
});

export const TEMPLATES: Readonly<Record<SpaceType, AssessmentTemplate>> = {
  entry: ENTRY,
  living: LIVING,
  kitchen: KITCHEN,
  stairway: STAIRWAY,
  bathroom: BATHROOM,
  bedroom: BEDROOM,
  exterior: EXTERIOR,
  hallway: EMPTY_TEMPLATE("hallway"),
  laundry: EMPTY_TEMPLATE("laundry"),
  garage: EMPTY_TEMPLATE("garage"),
  custom: EMPTY_TEMPLATE("custom"),
};

export function templateFor(spaceType: SpaceType): AssessmentTemplate {
  return TEMPLATES[spaceType];
}

export const ALL_TEMPLATES: readonly AssessmentTemplate[] = Object.values(TEMPLATES);
