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

## What changes if this model is relaxed

Storing client identifiers, adding photographs, or introducing the family
capture flow would each make the system a repository of protected health
information. Any of those requires, before launch of that feature:

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
