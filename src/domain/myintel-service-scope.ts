/** Owner-confirmed October 27, 2026. This is delivery scope, not provider availability. */
export const MYINTEL_SERVICE_SCOPE = {
  direct: ["Fall detection", "Smart door locks", "Medication reminders"],
  referral: [
    "Other technology setup",
    "Security systems",
    "Home modifications and grab bars",
    "Ramps and stair lifts",
    "Bathroom remodeling",
    "Occupational therapy services",
  ],
} as const;
