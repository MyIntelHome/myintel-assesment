"use client";
import type { CaseApi } from "@/lib/case-store";
import type {
  ProfessionalDocumentation,
  ProfessionalTest,
} from "@/domain/professional-documentation";
import { createUuid } from "@/lib/ids";
import { buildCaseView } from "@/lib/selectors";

const fields = [
  [
    "clientSummary",
    "Client summary",
    "Reason for the visit, the person’s priorities and the everyday situation.",
  ],
  [
    "goals",
    "Goals agreed with the client",
    "What the person wants to keep doing or work toward.",
  ],
  [
    "dailyActivities",
    "Daily activities and participation",
    "ADL/IADL observations, mobility and transfers, meal routines, hobbies and social activity. Distinguish observed performance from reported information.",
  ],
  [
    "medicalContext",
    "Relevant history and reported medication issues",
    "Record the source and functional relevance. Do not infer a diagnosis or medication change.",
  ],
  [
    "equipment",
    "Current equipment and use",
    "Equipment already used, fit, access and any observed difficulties.",
  ],
  [
    "support",
    "Support and routines",
    "Who helps, when help is available and what remains uncertain.",
  ],
  [
    "followUpPlan",
    "Follow-up and review plan",
    "Who will review the plan, when, and how use of changes or equipment will be checked. This does not book care.",
  ],
] as const;
export function ProfessionalNotes({ api }: { api: CaseApi }) {
  const doc = api.state.documentation ?? {},
    tests = doc.tests ?? [],
    findings = buildCaseView(api.state).findings;
  const patchTest = (id: string, patch: Partial<ProfessionalTest>) =>
    api.patchDocumentation({
      tests: tests.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const addTest = (name = "") => api.patchDocumentation({
    tests: [...tests, { id: createUuid(), name, date: "", result: "", interpretation: "", limitations: "", linkedFindings: [] }],
  });
  const textField = ([key, label, hint]: (typeof fields)[number]) => (
    <label className="stack" key={key}>
      <span>{label}</span>
      <textarea
        rows={key === "clientSummary" ? 4 : 3}
        maxLength={5000}
        value={String(doc[key] ?? "")}
        onChange={(e) =>
          api.patchDocumentation({
            [key]: e.target.value,
          } as Partial<ProfessionalDocumentation>)
        }
        placeholder={hint}
      />
    </label>
  );
  return (
    <section className="panel professional-notes">
      <h2>Client notes and visit narrative</h2>
      <p>
        Brief notes for the professional record and report. Keep names,
        addresses and contact details in your own records; the client name can
        be added at export.
      </p>
      <label className="stack">
        <span>Visit date</span>
        <input
          type="date"
          value={doc.visitDate ?? ""}
          onChange={(e) =>
            api.patchDocumentation({ visitDate: e.target.value })
          }
        />
      </label>
      {fields.slice(0, 2).map(textField)}
      <details>
        <summary>Activities, history, equipment and support</summary>
        {fields.slice(2, 6).map(textField)}
      </details>
      {textField(fields[6])}
      <details className="professional-tests">
        <summary>
          Assessments performed by the professional ({tests.length})
        </summary>
        <p>
          Record results from a test you actually performed using its authorized
          method. These are clinician-entered results. HomeCheck does not
          administer, score, validate or convert proprietary tests such as AMPS.
        </p>
        <p className="hint">For AMPS, an appropriately trained and authorized OT uses the publisher’s administration method and scoring system. Enter only results and interpretations you are permitted to include here, then link them to the relevant home findings.</p>
        {tests.map((test, index) => (
          <fieldset className="panel" key={test.id}>
            <legend>Assessment result {index + 1}</legend>
            <div className="fieldgrid">
              <label>
                <span>Assessment name and version</span>
                <input
                  maxLength={200}
                  value={test.name}
                  onChange={(e) => patchTest(test.id, { name: e.target.value })}
                />
              </label>
              <label>
                <span>Date performed</span>
                <input
                  type="date"
                  value={test.date}
                  onChange={(e) => patchTest(test.id, { date: e.target.value })}
                />
              </label>
            </div>
            <label className="stack">
              <span>Result and units</span>
              <textarea
                maxLength={1000}
                value={test.result}
                onChange={(e) => patchTest(test.id, { result: e.target.value })}
                placeholder="Use the instrument's own result and units. No conversion to a HomeCheck safety percentage."
              />
            </label>
            <label className="stack">
              <span>Professional interpretation</span>
              <textarea
                maxLength={5000}
                value={test.interpretation}
                onChange={(e) =>
                  patchTest(test.id, { interpretation: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span>Conditions and limitations</span>
              <textarea
                maxLength={5000}
                value={test.limitations}
                onChange={(e) =>
                  patchTest(test.id, { limitations: e.target.value })
                }
              />
            </label>
            {test.linkedFindings?.some(
              (key) => !findings.some((f) => f.key === key),
            ) && (
              <p className="warn" role="alert">
                A linked finding changed or was removed. Review this result before signing.{" "}
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => patchTest(test.id, {
                    linkedFindings: test.linkedFindings?.filter(
                      (key) => findings.some((f) => f.key === key),
                    ),
                  })}
                >
                  Remove outdated links
                </button>
              </p>
            )}
            {findings.length > 0 && (
              <fieldset>
                <legend>Related home findings</legend>
                <p className="hint">
                  Link only where the result informs your professional
                  reasoning. Linking does not recalculate either assessment.
                </p>
                {findings.map((f) => (
                  <label className="test-finding-link" key={f.key}>
                    <input
                      type="checkbox"
                      checked={test.linkedFindings?.includes(f.key) ?? false}
                      onChange={(e) =>
                        patchTest(test.id, {
                          linkedFindings: e.target.checked
                            ? [...(test.linkedFindings ?? []), f.key]
                            : (test.linkedFindings ?? []).filter(
                                (key) => key !== f.key,
                              ),
                        })
                      }
                    />
                    {f.space.label}: {f.prompt}
                  </label>
                ))}
              </fieldset>
            )}
            <button
              className="btn-sm"
              type="button"
              onClick={() =>
                api.patchDocumentation({
                  tests: tests.filter((t) => t.id !== test.id),
                })
              }
            >
              Remove this draft result
            </button>
          </fieldset>
        ))}
        <button
          className="btn-sm"
          type="button"
          disabled={tests.length >= 20}
          onClick={() => addTest()}
        >
          Add performed assessment result
        </button>
        {" "}<button className="btn-sm" type="button" disabled={tests.length >= 20} onClick={()=>addTest("Assessment of Motor and Process Skills (AMPS)")}>Add AMPS results</button>
      </details>
    </section>
  );
}
