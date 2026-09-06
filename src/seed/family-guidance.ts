/**
 * Plain-language guidance shown to families when an answer is flagged.
 *
 * Written to three rules:
 *   1. Explain the risk in everyday terms, without frightening anyone.
 *   2. Offer a practical first step, framed as what commonly helps — never
 *      as instruction or clinical advice. This is a self-check, not care.
 *   3. Keep it short. Two sentences each, at most.
 *
 * `weight` orders the report so the most fall-relevant items surface first,
 * rather than the accident of the order rooms were added.
 */

export interface Guidance {
  /** Why this matters, in everyday language. */
  readonly why: string;
  /** What commonly helps. Never phrased as a prescription. */
  readonly helps: string;
  /** 3 = most fall-relevant, 1 = worth noting. */
  readonly weight: 1 | 2 | 3;
}

export const FAMILY_GUIDANCE: Readonly<Record<string, Guidance>> = {
  // ── Front door ────────────────────────────────────────────
  e1: {
    why: "A raised lip at a doorway is one of the most common places people catch a toe, especially carrying something.",
    helps: "A small threshold ramp costs very little and removes the step entirely.",
    weight: 2,
  },
  e2: {
    why: "Coming home after dark to an unlit door means finding the lock and the step by feel.",
    helps: "A motion-sensor bulb in the existing fixture is usually a straight swap.",
    weight: 2,
  },
  e3: {
    why: "Smooth tile or stone by a door gets slick with rain or snow, right where someone is juggling keys and bags.",
    helps: "A rubber-backed outdoor mat, or non-slip strips, handles most of it.",
    weight: 2,
  },
  e4: {
    why: "Cracked or wobbly steps shift underfoot, and a step that isn't where the foot expects it is a common cause of falls.",
    helps: "Worth having someone look at the repair — this one usually needs a handyman rather than a quick fix.",
    weight: 3,
  },
  e5: {
    why: "Without a firm rail there is nothing to catch hold of if a foot slips on the way in or out.",
    helps: "A properly anchored handrail is one of the highest-value changes to any entrance.",
    weight: 3,
  },
  e6: {
    why: "Round knobs need a firm grip and a twist, which is hard with arthritis or wet hands.",
    helps: "Lever handles replace a knob in a few minutes and can be opened with a forearm.",
    weight: 1,
  },
  e7: {
    why: "If an ambulance is called, crews lose time hunting for the address in the dark.",
    helps: "Reflective or lit numbers, large and facing the street.",
    weight: 1,
  },

  // ── Living room ───────────────────────────────────────────
  l1: {
    why: "Loose rugs are the single most common trip hazard in the home. Edges curl and the whole rug slides on a hard floor.",
    helps: "Removing them is safest. If a rug is staying, double-sided rug tape or a non-slip pad underneath.",
    weight: 3,
  },
  l2: {
    why: "Turning sideways or shuffling past furniture puts someone off balance in the middle of a room.",
    helps: "Moving one or two pieces to open a straight path usually does it — no cost, just a rearrange.",
    weight: 2,
  },
  l3: {
    why: "Eyes take longer to adjust to dim light with age, and shadows hide the edges of things.",
    helps: "Brighter bulbs in existing lamps, and a lamp within reach of the chair.",
    weight: 2,
  },
  l4: {
    why: "A cord across a walkway is invisible from above and catches the foot mid-stride.",
    helps: "Rerouting behind furniture, or a cord cover taped along the baseboard.",
    weight: 2,
  },
  l5: {
    why: "A low, soft seat is hard to rise from. Rocking forward to build momentum is how a lot of falls start.",
    helps: "A firmer cushion, or risers under the legs to raise the seat height.",
    weight: 2,
  },
  l6: {
    why: "If someone falls and the phone is across the room, help can be a long time coming.",
    helps: "Keeping a phone on the side table, within arm's reach of where they usually sit.",
    weight: 2,
  },
  l7: {
    why: "A fall when nobody is home can mean hours on the floor before anyone knows.",
    helps: "Automatic fall detection — worth asking a professional what suits the situation.",
    weight: 2,
  },

  // ── Kitchen ───────────────────────────────────────────────
  k1: {
    why: "Kitchen spills happen constantly, and a smooth floor gives no grip at all when wet.",
    helps: "A non-slip mat at the sink, and wiping spills straight away rather than later.",
    weight: 2,
  },
  k2: {
    why: "Reaching high or bending low shifts the centre of balance, often while holding something heavy.",
    helps: "Moving daily items — plates, mugs, the kettle — to waist-height shelves. Free, and takes an afternoon.",
    weight: 2,
  },
  k3: {
    why: "With no clear counter there is nowhere to set a hot pan down, and nothing to steady against.",
    helps: "Clearing a stretch of counter beside the stove and keeping it clear.",
    weight: 1,
  },
  k4: {
    why: "Reaching over hot burners to reach the controls risks burns and sleeves catching fire.",
    helps: "Worth mentioning to a professional — options depend on the stove.",
    weight: 2,
  },
  k5: {
    why: "Smoke alarms are easy to forget about, and a dead battery gives no warning at all.",
    helps: "Test it this week. Ten-year sealed alarms remove the battery problem entirely.",
    weight: 3,
  },
  k6: {
    why: "Chopping and reading labels in poor light leads to cuts and mistakes with medication.",
    helps: "Stick-on LED strips under the cabinets are inexpensive and need no wiring.",
    weight: 2,
  },
  k7: {
    why: "Standing on a chair or box is one of the most dangerous things anyone does at home, and it is very common.",
    helps: "A proper step stool with a handle to hold — and moving high items down so it isn't needed.",
    weight: 3,
  },

  // ── Stairs ────────────────────────────────────────────────
  s1: {
    why: "A rail on only one side leaves nothing to grab if a foot slips on the other. Both sides matter going down.",
    helps: "Adding a second rail is a common, well-understood job for a handyman.",
    weight: 3,
  },
  s2: {
    why: "Worn or lifting carpet catches the toe on the way up and gives way underfoot on the way down.",
    helps: "Re-fixing loose carpet or replacing worn treads — worth doing properly.",
    weight: 3,
  },
  s3: {
    why: "When every step looks the same, it's easy to misjudge the last one. This is a very common fall.",
    helps: "Contrast tape along each step edge makes them read clearly, and costs very little.",
    weight: 2,
  },
  s4: {
    why: "Starting down a dark staircase because the switch is at the other end is a bad way to find the first step.",
    helps: "A second switch, or a plug-in motion light at the top and bottom.",
    weight: 2,
  },
  s5: {
    why: "Narrow stairs make it hard to hold the rail and pass safely, especially carrying anything.",
    helps: "Keeping the stairs clear helps. Structural width is one for a professional.",
    weight: 2,
  },
  s6: {
    why: "Anything left on a step is a hazard on a surface where a fall does the most damage.",
    helps: "A firm rule that nothing gets set down on the stairs, even briefly.",
    weight: 3,
  },
  s7: {
    why: "If stairs have become genuinely difficult, there are options beyond simply avoiding the upstairs.",
    helps: "An occupational therapist can advise whether a lift makes sense here.",
    weight: 1,
  },

  // ── Bathroom ──────────────────────────────────────────────
  b1: {
    why: "Getting up from a toilet takes real strength. Without a bar, people grab towel rails or sinks, which are not built to hold weight.",
    helps: "A properly anchored grab bar beside the toilet. It must go into studs, not just drywall.",
    weight: 3,
  },
  b2: {
    why: "Stepping over a tub wall on a wet surface is one of the highest-risk moves in the whole home.",
    helps: "Grab bars at the entry and inside. Suction-cup bars are not a substitute — they let go.",
    weight: 3,
  },
  b3: {
    why: "A wet, smooth tub floor offers almost no grip, and there is nowhere soft to land.",
    helps: "A rubber mat with suction, or non-slip strips applied to the base.",
    weight: 3,
  },
  b4: {
    why: "Standing through a whole shower is tiring, and fatigue is when balance goes.",
    helps: "A shower chair or fold-down bench. Inexpensive and makes a real difference.",
    weight: 2,
  },
  b5: {
    why: "A low toilet means pushing up hard from a seated position, often with wet hands and no support.",
    helps: "A raised seat, or a comfort-height toilet if it's being replaced anyway.",
    weight: 2,
  },
  b6: {
    why: "Night trips to the bathroom are when a large share of falls happen — half asleep, in the dark.",
    helps: "Plug-in night lights along the route. A few dollars each and one of the best changes you can make.",
    weight: 3,
  },
  b7: {
    why: "Stiff taps are hard with a weak grip, and struggling with them at a wet sink is awkward.",
    helps: "Lever-style taps, which can be turned with a wrist or forearm.",
    weight: 1,
  },
  b8: {
    why: "Stepping out onto a wet floor, mid-balance and with nothing to hold, is a very common fall.",
    helps: "An absorbent non-slip bath mat, and a bar within reach of the exit.",
    weight: 3,
  },

  // ── Bedroom ───────────────────────────────────────────────
  br1: {
    why: "A bed too high means dropping down to it; too low means a hard push to stand. Both are unsteady moments.",
    helps: "Adjusting the bed height so both feet rest flat with knees level.",
    weight: 2,
  },
  br2: {
    why: "This route gets walked in the dark, half asleep. Anything on the floor will eventually be found by a foot.",
    helps: "Keeping the route completely clear, and checking it before bed.",
    weight: 3,
  },
  br3: {
    why: "Crossing a dark room to reach a switch is exactly the situation where night falls happen.",
    helps: "A touch lamp or a switch within reach of the bed.",
    weight: 3,
  },
  br4: {
    why: "A fall at night with the phone out of reach can mean a long wait for help.",
    helps: "Keeping a phone on the nightstand, plugged in and within arm's reach.",
    weight: 2,
  },
  br5: {
    why: "Getting in and out of bed involves turning and shifting weight with nothing solid to hold.",
    helps: "A bed rail or bed cane gives something firm at the moment it's needed.",
    weight: 2,
  },
  br6: {
    why: "Tubing and cords near a bed are directly in the path taken at night, in the dark.",
    helps: "Routing equipment and cords away from the walking side of the bed.",
    weight: 3,
  },
  br7: {
    why: "Reaching high in a closet, often on tiptoe, is a balance risk for a routine daily task.",
    helps: "Moving everyday clothes to the middle rail and shelves.",
    weight: 1,
  },

  // ── Outside ───────────────────────────────────────────────
  ex1: {
    why: "Uneven paving is hard to see in low light, and a raised edge catches the toe mid-stride.",
    helps: "Grinding or repairing the raised sections. Worth getting quotes.",
    weight: 3,
  },
  ex2: {
    why: "The walk from the car to the door in the dark is done daily, often carrying things.",
    helps: "Solar path lights are cheap and need no wiring at all.",
    weight: 2,
  },
  ex3: {
    why: "Gravel, cracked concrete and slopes are unstable underfoot, especially with a cane or walker.",
    helps: "Levelling the worst sections, and a clear firm route from the car.",
    weight: 2,
  },
  ex4: {
    why: "Outdoor steps get wet, icy and mossy, and are often the steepest steps in the home.",
    helps: "A firm handrail on every outdoor step run.",
    weight: 3,
  },
  ex5: {
    why: "A daily trip over uneven ground, sometimes in bad weather, for something quite minor.",
    helps: "Relocating the mailbox closer, or having mail brought in.",
    weight: 1,
  },
  ex6: {
    why: "A ramp that is too steep or slick in the rain is more dangerous than the steps it replaced.",
    helps: "Non-slip surfacing, and a professional check on the slope.",
    weight: 3,
  },
};

export function guidanceFor(code: string): Guidance | undefined {
  return FAMILY_GUIDANCE[code];
}
