# Professional/client separation verification

Final automated verification: TypeScript passed; 210 tests passed across 20 test files.

New coverage includes:
- Ordinary clients and staff without professional approval cannot read or write clinical archives.
- Self-approved application payloads are rejected; pending, rejected and revoked accounts do not load clinical UI.
- Approval and revocation require staff access; stale reviews fail without adding audit events.
- Legacy mixed archives return only the selected audience, preserve hidden records and reject cross-scope IDs.
- Clinical content cannot be saved as a family assessment by changing its audience.
- Signed report amendments preserve immutable earlier versions under the new professional scope.
- Client imports exclude clinical drafts, including an all-clinical archive without damaging the current home draft.
- The professional dashboard uses scoped archive requests and separate navigation.

Browser review on the managed local preview: client overview and its home-check entry, reader-paced everyday-life transition, professional entry and sign-in destination. The local static preview has no authenticated API; authenticated dashboard and approval paths were exercised with component tests and a SQLite-backed Worker integration harness, not real credentials or live clinical records.

No organization tenancy, automatic credential verification, referral assignment, public authentication or live payments are claimed. No real professional account was approved during testing. Public Vercel is outside this private review deployment.
