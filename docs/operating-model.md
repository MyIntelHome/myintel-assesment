# Operating model — de-identified assessment

**Status:** for review by counsel
**Applies to:** MyIntel Assessment Platform v1
**Prepared:** Stage 0

---

## Summary

The MyIntel Assessment Platform v1 is a **clinical assessment instrument, not a
client record system**. It stores no direct identifiers. The occupational
therapist using it holds the link between a case reference and a person in the
records they already keep.

This is the basis on which the system operates without a Business Associate
Agreement. It is a design constraint enforced in code, not a policy statement.

---

## What is stored

| Category | Held | Example |
|---|---|---|
| Case reference | Yes | `2026-014`, assigned by the clinician |
| Age band | Yes, capped at 90+ | `75–79` |
| Housing profile | Yes | Single family, two floors, owner-occupied |
| Household composition | Yes | Lives alone |
| Mobility and devices | Yes | Uses a four-wheel walker |
| Fall history | Yes | One fall in the last six months, no injury |
| Assessment responses | Yes | Bathroom, grab bars at toilet: absent |
| Findings and action plan | Yes | Grab bar installation, within 30 days |
| Clinician account | Yes | The therapist's own name, email, and licence |

## What is never stored

- Client name
- Date of birth
- Street address or postcode
- Telephone number or email address
- Names of family members, carers, or emergency contacts
- Photographs of the home or its occupants
- Any free text containing the above

## The client's name

The client's name appears on the delivered report and nowhere else. The
clinician types it at the point of export; the document renders **in their
browser** and the name is never transmitted to or stored by MyIntel. The server
retains the immutable clinical content and its hash; identity is applied by the
clinician at delivery.

---

## Controls that enforce this

1. **No field asks for an identifier.** There is no name, date of birth, or
   address field anywhere in the interface.
2. **Case references are validated** against identity-derived patterns. A
   reference such as `MC-1943`, which encodes initials and a birth year, is
   rejected. `2026-014` is accepted.
3. **Free text is screened** for name- and address-shaped content before saving,
   with a warning and one-tap redaction.
4. **Age is banded**, never stored as a date, and capped at `90+`.
5. **An automated test asserts** that no identifier-shaped string is persisted
   across a full assessment run. It runs on every commit.
6. **Outbound AI requests are de-identified** and free text is scrubbed before
   transmission, verified by test.
7. **No identifier appears** in application logs, URLs, analytics, or error
   reports.

---

## Clinician account data

The therapist's own name, email address, professional credentials, and licence
number are stored. This is the account holder's business contact and
professional registration information, not health information about a patient.

---

## The family self-check — a different legal footing

The self-check is a **consumer tool**, not a clinical instrument. A daughter
answering questions about her mother's bathroom is not a patient of anyone, and
no covered-entity relationship exists at that moment. HIPAA does not attach to
what she enters.

It is nonetheless personal information, and it is treated as such.

### Contact details

The report is shown after the person gives a name, an email address, and
explicit consent. Phone is optional.

| Property | Behaviour |
|---|---|
| Where it is held | `localStorage` on the household's own device, under `myintel.family.contact.v1` |
| Transmitted to MyIntel by the app | **No.** The application makes no network request carrying it |
| How MyIntel could receive it | Only if the person presses a share button, which opens **their** mail client with a draft they read and send themselves |
| Consent | An unticked checkbox, required before the report renders. Wording states they may ask to be removed |
| Stored inside the case record | **No.** Split into a separate key so it is structurally absent from the payload Stage 1 will sync |
| On entering the clinician workspace | Cleared from memory and from storage, so a shared tablet cannot carry a household's details into a clinical case |

### What this means in practice

When someone emails their results to MyIntel, MyIntel then holds a name, an
email address, and that household's reported observations **in an ordinary
inbox**. That is consumer personal information governed by state privacy law and
by marketing and contact rules — not by HIPAA — and it needs the ordinary
consumer-privacy apparatus rather than a BAA:

- A published privacy notice covering what is collected and why
- A working deletion and opt-out route
- A retention limit on that inbox, applied in practice and not only in policy
- Consent evidence retained for any subsequent marketing contact
- Care with phone follow-up, which is separately regulated

### The line that must not be crossed

Family answers are evidence, never clinical ratings, and contact details never
join a clinical case. The moment a household's name is attached to assessment
content inside a clinician's case record, the de-identified model is broken and
everything under *What changes if this model is relaxed* applies. Both
separations are enforced in code and covered by tests.

---

## What changes if this model is relaxed

Storing client identifiers, adding photographs, or **joining the family
self-check to a named clinical case** would each make the system a repository of
protected health information. Any of those requires, before launch of that
feature:

- A Business Associate Agreement with each customer organisation
- Executed BAAs with every subcontractor touching the data — hosting, database,
  object storage, email, and the AI provider
- Encryption of identifiers at rest with audited access
- A documented risk analysis, workforce training, and breach notification
  procedure

The schema already separates identity from clinical content so that this
transition is a configuration change rather than a rebuild.

---

## Question for counsel

Does holding the data described above, with no direct identifiers and with the
re-identification key held solely by the treating clinician, place MyIntel
outside the definition of a Business Associate for the purposes of v1?

Secondary: if a more conservative position is preferred, the model can drop the
age band entirely and store no dates more precise than a year. Please advise
whether that is warranted.

Third: the family self-check collects a name and email on the household's own
device and transmits nothing, but a person may choose to email their results to
MyIntel. Please confirm that receiving those emails is consumer personal
information outside HIPAA, and advise on the privacy notice, retention period,
and consent record required before this is offered to the public.
