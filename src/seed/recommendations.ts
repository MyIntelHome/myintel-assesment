/**
 * Starter recommendation library, version 1.
 *
 * Ported from the v1 prototype with one deliberate change: **all brand names
 * have been removed.** Vendor neutrality is a default of the product, not a
 * mode of it. Three legacy entries named specific products:
 *
 *   "MyIntel Motion Sensor (Bathroom)"  -> "Motion-Activated Monitoring Sensor"
 *   "MyIntel Motion Sensor (Bedroom)"   -> "Motion-Activated Monitoring Sensor"
 *   "Echo Show / Smart Display"         -> "Voice-Activated Smart Display"
 *
 * Named products belong in the verified catalog (v2), surfaced only when a
 * case is explicitly in MyIntel assessment mode, and always attached to a
 * recommendation whose clinical rationale stands without them.
 *
 * Selecting one of these creates a Recommendation that still requires
 * urgency, cost range, and responsible party before a report can be signed.
 */

import type { RecommendationTemplate } from "@/domain/types";

export const RECOMMENDATION_LIBRARY: readonly RecommendationTemplate[] = [
  // Entrance
  { code: "r_entry_mat", title: "Non-slip entry mat", category: "equipment", spaceTypes: ["entry"] },
  { code: "r_handrail_install", title: "Handrail installation", category: "home_modification", spaceTypes: ["entry", "exterior", "stairway"] },
  { code: "r_threshold_ramp", title: "Threshold ramp", category: "home_modification", spaceTypes: ["entry"] },
  { code: "r_motion_light", title: "Motion-sensor light", category: "technology", spaceTypes: ["entry", "exterior", "hallway"] },
  { code: "r_doorbell", title: "Video doorbell", category: "technology", spaceTypes: ["entry"] },
  { code: "r_lever_handle", title: "Lever door handle", category: "home_modification", spaceTypes: ["entry", "bathroom"] },
  { code: "r_house_numbers", title: "Illuminated house numbers", category: "home_modification", spaceTypes: ["entry", "exterior"] },

  // Living area
  { code: "r_remove_rugs", title: "Remove or secure throw rugs", category: "behavioural", spaceTypes: ["living", "bedroom", "hallway"] },
  { code: "r_furniture_rearrange", title: "Rearrange furniture for clear pathways", category: "behavioural", spaceTypes: ["living", "bedroom"] },
  { code: "r_chair_traction", title: "Traction pads for chair legs", category: "equipment", spaceTypes: ["living"] },
  { code: "r_smart_lighting", title: "Automated lighting", category: "technology", spaceTypes: ["living", "bedroom", "hallway"] },
  { code: "r_fall_detection", title: "Fall detection device", category: "technology", spaceTypes: ["living", "bedroom", "bathroom"] },
  { code: "r_smart_display", title: "Voice-activated smart display", category: "technology", spaceTypes: ["living", "kitchen"] },
  { code: "r_cord_covers", title: "Cord covers or rerouting", category: "home_modification", spaceTypes: ["living", "bedroom"] },
  { code: "r_chair_rail", title: "Chair lift assist rail", category: "equipment", spaceTypes: ["living"] },

  // Kitchen
  { code: "r_kitchen_mat", title: "Non-slip kitchen mat", category: "equipment", spaceTypes: ["kitchen"] },
  { code: "r_cabinet_reorg", title: "Reorganise cabinets to safe reach zones", category: "behavioural", spaceTypes: ["kitchen"] },
  { code: "r_stove_shutoff", title: "Automatic stove shut-off", category: "technology", spaceTypes: ["kitchen"] },
  { code: "r_cabinet_pulls", title: "D-shaped cabinet pull handles", category: "home_modification", spaceTypes: ["kitchen"] },
  { code: "r_under_cabinet_light", title: "Under-cabinet task lighting", category: "home_modification", spaceTypes: ["kitchen"] },
  { code: "r_smoke_detector", title: "Smoke and CO detector upgrade", category: "equipment", spaceTypes: ["kitchen"] },
  { code: "r_counter_grab_bar", title: "Grab bar at counter", category: "home_modification", spaceTypes: ["kitchen"] },
  { code: "r_step_stool", title: "Rated step stool with handle", category: "equipment", spaceTypes: ["kitchen"] },

  // Stairway
  { code: "r_stair_treads", title: "Non-slip stair treads", category: "home_modification", spaceTypes: ["stairway"] },
  { code: "r_edge_contrast", title: "Stair edge contrast tape", category: "home_modification", spaceTypes: ["stairway"] },
  { code: "r_handrail_extension", title: "Handrail extension", category: "home_modification", spaceTypes: ["stairway"] },
  { code: "r_stair_lighting", title: "Automatic stair lighting", category: "technology", spaceTypes: ["stairway"] },
  { code: "r_stair_lift_referral", title: "Stair lift assessment referral", category: "referral", spaceTypes: ["stairway"] },
  { code: "r_clear_stairs", title: "Clear items stored on stairs", category: "behavioural", spaceTypes: ["stairway"] },

  // Bathroom
  { code: "r_grab_bars", title: "Grab bar installation", category: "home_modification", spaceTypes: ["bathroom"] },
  { code: "r_shower_seat", title: "Fold-down shower seat", category: "equipment", spaceTypes: ["bathroom"] },
  { code: "r_raised_toilet", title: "Raised toilet seat", category: "equipment", spaceTypes: ["bathroom"] },
  { code: "r_bath_mat", title: "Non-slip bath mat", category: "equipment", spaceTypes: ["bathroom"] },
  { code: "r_night_light", title: "Automatic night light", category: "technology", spaceTypes: ["bathroom", "bedroom", "hallway"] },
  { code: "r_handheld_shower", title: "Handheld showerhead", category: "equipment", spaceTypes: ["bathroom"] },
  { code: "r_anti_scald", title: "Anti-scald valve", category: "home_modification", spaceTypes: ["bathroom"] },
  { code: "r_monitoring_sensor", title: "Motion-activated monitoring sensor", category: "technology", spaceTypes: ["bathroom", "bedroom"] },

  // Bedroom
  { code: "r_bed_rail", title: "Bed cane or transfer rail", category: "equipment", spaceTypes: ["bedroom"] },
  { code: "r_bedside_alert", title: "Bedside phone or alert device", category: "technology", spaceTypes: ["bedroom"] },
  { code: "r_o2_reposition", title: "Reposition oxygen equipment and tubing", category: "behavioural", spaceTypes: ["bedroom"] },
  { code: "r_closet_organise", title: "Closet reorganisation to safe reach", category: "behavioural", spaceTypes: ["bedroom"] },
  { code: "r_bed_height", title: "Bed height adjustment", category: "home_modification", spaceTypes: ["bedroom"] },

  // Exterior
  { code: "r_pathway_repair", title: "Pathway repair or resurfacing", category: "home_modification", spaceTypes: ["exterior"] },
  { code: "r_exterior_lights", title: "Motion-sensor exterior lighting", category: "technology", spaceTypes: ["exterior"] },
  { code: "r_exterior_handrail", title: "Exterior handrail", category: "home_modification", spaceTypes: ["exterior"] },
  { code: "r_entry_ramp", title: "Entry ramp", category: "home_modification", spaceTypes: ["exterior", "entry"] },
  { code: "r_mailbox", title: "Mailbox relocation", category: "home_modification", spaceTypes: ["exterior"] },
];

export function recommendationsFor(spaceType: string): readonly RecommendationTemplate[] {
  return RECOMMENDATION_LIBRARY.filter((r) =>
    (r.spaceTypes as readonly string[]).includes(spaceType),
  );
}
