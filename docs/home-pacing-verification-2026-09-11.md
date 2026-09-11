# Home-check pacing

Added reader-controlled introductions before daily life, used-space selection, each room and results. Questions are not mounted until the reader continues. Daily-life setup now displays one optional question at a time, with Back and an option to go directly to spaces. Room guidance is available in an expandable help panel. Short entrance transitions and a finite dot animation support section changes; the saving spinner runs only while work is opening or saving. Reduced-motion CSS disables these animations.

197 automated tests passed, including hidden-before-continue behavior, focus movement, and preserving a routine choice when navigating back. The internal browser walkthrough verified the first introduction, its reveal, one-question navigation and the pause before space selection. The introduction was visually inspected and its width was subsequently constrained to match the assessment cards. A final production build is required before publishing.

No additional browser delay is imposed for reading. Users choose when to proceed. Existing assessments, professional requests and clinical access are unchanged. Physical-device and assistive-technology testing remain outstanding; this release is a private review.
