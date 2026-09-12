"use client";
import {signInHref,signOutHref,signInLabel,accountProviderLabel,accountNotice} from "@/lib/auth-navigation";

import {createUuid} from "@/lib/ids";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./help.css";
import {HomeReviewPhotos} from "./HomeReviewPhotos";

export type HelpService =
  | "professional_assessment"
  | "home_modifications"
  | "technology_support"
  | "care_navigation";

type ContactMethod = "email" | "phone";
type Relationship = "self" | "family" | "professional";
type FlowStep = "service" | "details" | "success";

type User = {
  id: string;
  email: string;
  name: string;
};

export type ProfessionalHelpProps = {
  user: User | null;
  initialService?: string;
  homeCaseId?:string;
  onBack: () => void;
  onRequests: () => void;
};

type RequestResult = {
  id: string;
  status: string;
  createdAt: string;
};

type FieldErrors = Partial<Record<"service" | "name" | "postalCode" | "phone" | "contactMethod" | "relationship" | "consent", string>>;

const SERVICES: Array<{
  value: HelpService;
  number: string;
  title: string;
  description: string;
}> = [
  {
    value: "professional_assessment",
    number: "01",
    title: "Professional assessment",
    description: "Talk with someone who can look at your needs and suggest next steps.",
  },
  {
    value: "home_modifications",
    number: "02",
    title: "Home modifications",
    description: "Explore changes that could make everyday movement at home easier.",
  },
  {
    value: "technology_support",
    number: "03",
    title: "Technology support",
    description: "Get help choosing or setting up useful technology for home.",
  },
  {
    value: "care_navigation",
    number: "04",
    title: "Care navigation",
    description: "Find a clear next step when you are coordinating care or support.",
  },
];

const SERVICE_VALUES = new Set<HelpService>(SERVICES.map((service) => service.value));

function isHelpService(value: string | undefined): value is HelpService {
  return Boolean(value && SERVICE_VALUES.has(value as HelpService));
}

function getInitialService(value: string | undefined): HelpService | "" {
  return isHelpService(value) ? value : "";
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export default function ProfessionalHelp({
  user,
  initialService,
  homeCaseId,
  onBack,
  onRequests,
}: ProfessionalHelpProps) {
  const [step, setStep] = useState<FlowStep>("service");
  const [service, setService] = useState<HelpService | "">(getInitialService(initialService));
  const [name, setName] = useState(user?.name ?? "");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [relationship, setRelationship] = useState<Relationship>("self");
  const [shareAssessment,setShareAssessment]=useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<RequestResult | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverError) errorSummaryRef.current?.focus();
  }, [serverError]);
  useEffect(() => {document.getElementById("help-title")?.focus();}, [step]);

  if (!user) {
    return (
      <main className="help-flow">
        <div className="help-shell">
          <header className="help-header">
            <button type="button" className="help-back" onClick={onBack}>
              <span aria-hidden="true">←</span> Back
            </button>
            <span className="help-step-count">Getting started</span>
          </header>

          <section className="help-intro" aria-labelledby="help-title">
            <p className="help-kicker">Professional help</p>
            <h1 id="help-title">Find the right help for your home</h1>
            <p className="help-lede">
              Request a conversation about the kind of support you need at home. We will ask a few
              simple questions so we can understand where to start.
            </p>
            <p className="help-commitment">Request first. Review the scope and price before you commit.</p>
          </section>

          <section className="help-signin-card" aria-labelledby="help-signin-title">
            <div className="help-card-mark" aria-hidden="true">↗</div>
            <div>
              <h2 id="help-signin-title">Sign in to request help</h2>
              <p>Your request and any updates will be saved to your account.</p>
              <a
                className="help-button help-button-primary"
                href={signInHref("/?view=help")}
                target="_top"
              >
                {signInLabel}
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const serviceTitle = SERVICES.find((item) => item.value === service)?.title ?? "your request";

  function validateDetails(): FieldErrors {
    const nextErrors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedPostalCode = postalCode.trim();
    const trimmedPhone = phone.trim();

    if (!service) nextErrors.service = "Choose the kind of help you are looking for.";
    if (trimmedName.length<2) nextErrors.name = "Enter your name (at least two characters).";
    if (!/^\d{5}$/.test(trimmedPostalCode)) nextErrors.postalCode = "Enter a five-digit US ZIP code.";
    if (contactMethod === "phone" && !trimmedPhone) {
      nextErrors.phone = "Enter a phone number for a phone call.";
    } else if (trimmedPhone && (trimmedPhone.replace(/\D/g, "").length < 10 || trimmedPhone.length > 30)) {
      nextErrors.phone = "Check the phone number and try again.";
    }
    if (!relationship) nextErrors.relationship = "Choose who the request is for.";
    if (!consent) nextErrors.consent = "Please agree before sending your request.";
    return nextErrors;
  }

  function handleChooseService(nextService: HelpService) {
    setService(nextService);
    setErrors((current) => ({ ...current, service: undefined }));
  }

  function handleServiceContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) {
      setErrors({ service: "Choose the kind of help you are looking for." });
      return;
    }
    setErrors({});
    setStep("details");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDetails();
    setErrors(nextErrors);
    setServerError("");

    if (shareAssessment && !homeCaseId) {
      setServerError("Wait for your home check to finish saving before sharing it.");
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = Object.keys(nextErrors)[0];
      window.setTimeout(() => document.getElementById(`help-${firstInvalid}`)?.focus(), 0);
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createUuid();
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          service,
          name: name.trim(),
          postalCode: postalCode.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          contactMethod,
          relationship,
          consent: true,
          ...(shareAssessment && homeCaseId?{caseId:homeCaseId,shareAssessment:true}:{}),
        }),
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "We could not send your request. Please try again."));
      }

      const returnedRequest =
        typeof data === "object" && data !== null && "request" in data
          ? (data as { request?: Partial<RequestResult> }).request
          : undefined;
      if (
        !returnedRequest ||
        typeof returnedRequest.id !== "string" ||
        typeof returnedRequest.status !== "string" ||
        typeof returnedRequest.createdAt !== "string"
      ) {
        throw new Error("We could not confirm your request. Please try again.");
      }

      setRequest({
        id: returnedRequest.id,
        status: returnedRequest.status,
        createdAt: returnedRequest.createdAt,
      });
      setStep("success");
    } catch (error) {
      setServerError(
        error instanceof Error && error.message
          ? error.message
          : "We could not send your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="help-flow">
      <div className="help-shell">
        <header className="help-header">
          <button type="button" className="help-back" disabled={submitting} onClick={step !== "details" ? onBack : () => setStep("service")}>
            <span aria-hidden="true">←</span> {step !== "details" ? "Back" : "Change help type"}
          </button>
          {step !== "success" && <span className="help-step-count">{step === "service" ? "1 of 2" : "2 of 2"}</span>}
          {step === "success" && (
            <button type="button" className="help-requests-link" onClick={onRequests}>
              My requests <span aria-hidden="true">↗</span>
            </button>
          )}
        </header>

        <section className="help-intro" aria-labelledby="help-title">
          <p className="help-kicker">Professional help</p>
          <h1 id="help-title" tabIndex={-1}>Find the right help for your home</h1>
          {step === "service" && (
            <>
              <p className="help-lede">Choose the kind of support you need. MyIntel will check the available options with you.</p>
              <p className="help-commitment">Request first. Review the scope and price before you commit.</p>
            </>
          )}
          {step === "details" && (
            <p className="help-lede">Share a few details so we know how to follow up. You can review everything before sending.</p>
          )}
          {step === "success" && (
            <p className="help-lede">Your request is saved. We will use your contact preference to follow up with next steps.</p>
          )}
        </section>

        {step === "service" && (
          <form onSubmit={handleServiceContinue} noValidate>
            <fieldset className="help-fieldset" aria-describedby={errors.service ? "help-service-error" : undefined}>
              <legend className="help-section-title">What kind of help are you looking for?</legend>
              <div className="help-service-grid">
                {SERVICES.map((item) => {
                  const selected = service === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`help-service-card${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => handleChooseService(item.value)}
                    >
                      <span className="help-service-number" aria-hidden="true">{item.number}</span>
                      <span className="help-service-copy">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </span>
                      <span className="help-service-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
              {errors.service && <p id="help-service-error" className="help-field-error" role="alert">{errors.service}</p>}
            </fieldset>
            <div className="help-actions">
              <button type="submit" className="help-button help-button-primary" disabled={!service}>
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} noValidate>
            {serverError && (
              <div ref={errorSummaryRef} className="help-server-error" role="alert" aria-live="assertive" tabIndex={-1}>
                <strong>We could not send your request.</strong>
                <span>{serverError}</span>
              </div>
            )}

            <div className="help-selected-service" aria-label="Selected help type">
              <span className="help-selected-label">You selected</span>
              <strong>{serviceTitle}</strong>
              <button type="button" className="help-text-button" disabled={submitting} onClick={() => setStep("service")}>
                Change
              </button>
            </div>

            <fieldset className="help-fieldset" disabled={submitting}>
              <legend className="help-section-title">Your details</legend>
              <div className="help-form-grid">
                <div className="help-field help-field-wide">
                  <label htmlFor="help-name">Your name <span aria-hidden="true">*</span></label>
                  <input
                    id="help-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "help-name-error" : undefined}
                  />
                  {errors.name && <p id="help-name-error" className="help-field-error" role="alert">{errors.name}</p>}
                </div>

                <div className="help-field help-field-wide">
                  <label htmlFor="help-email">Verified email</label>
                  <div id="help-email" className="help-readonly-value" aria-label={`Verified email ${user.email}`}>
                    <span>{user.email}</span><span className="help-verified">Verified</span>
                  </div>
                </div>

                <div className="help-field">
                  <label htmlFor="help-postalCode">ZIP code <span aria-hidden="true">*</span></label>
                  <input
                    id="help-postalCode"
                    name="postalCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    required
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                    aria-invalid={Boolean(errors.postalCode)}
                    aria-describedby={errors.postalCode ? "help-postalCode-error" : undefined}
                  />
                  {errors.postalCode && <p id="help-postalCode-error" className="help-field-error" role="alert">{errors.postalCode}</p>}
                </div>

                <div className="help-field">
                  <label htmlFor="help-relationship">This request is for <span aria-hidden="true">*</span></label>
                  <select
                    id="help-relationship"
                    name="relationship"
                    required
                    value={relationship}
                    onChange={(event) => setRelationship(event.target.value as Relationship)}
                    aria-invalid={Boolean(errors.relationship)}
                    aria-describedby={errors.relationship ? "help-relationship-error" : undefined}
                  >
                    <option value="self">Me</option>
                    <option value="family">A family member</option>
                    <option value="professional">Someone I support professionally</option>
                  </select>
                  {errors.relationship && <p id="help-relationship-error" className="help-field-error" role="alert">{errors.relationship}</p>}
                </div>
              </div>

              <fieldset className="help-contact-group" aria-describedby={errors.contactMethod ? "help-contactMethod-error" : undefined}>
                <legend>How should we contact you?</legend>
                <div className="help-radio-grid">
                  <label className={`help-radio-card${contactMethod === "email" ? " is-selected" : ""}`}>
                    <input
                      id="help-contact-email"
                      type="radio"
                      name="contactMethod"
                      value="email"
                      checked={contactMethod === "email"}
                      onChange={() => setContactMethod("email")}
                    />
                    <span><strong>Email</strong><small>{user.email}</small></span>
                  </label>
                  <label className={`help-radio-card${contactMethod === "phone" ? " is-selected" : ""}`}>
                    <input
                      id="help-contact-phone"
                      type="radio"
                      name="contactMethod"
                      value="phone"
                      checked={contactMethod === "phone"}
                      onChange={() => setContactMethod("phone")}
                    />
                    <span><strong>Phone call</strong><small>Use the number below</small></span>
                  </label>
                </div>
                {errors.contactMethod && <p id="help-contactMethod-error" className="help-field-error" role="alert">{errors.contactMethod}</p>}
              </fieldset>

              <div className="help-field">
                <label htmlFor="help-phone">Phone number <span className="help-optional">Optional unless you choose a phone call</span></label>
                <input
                  id="help-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required={contactMethod === "phone"}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "help-phone-error" : undefined}
                />
                {errors.phone && <p id="help-phone-error" className="help-field-error" role="alert">{errors.phone}</p>}
              </div>

              {homeCaseId && <label className="help-consent"><input type="checkbox" checked={shareAssessment} onChange={e=>setShareAssessment(e.target.checked)}/><span>Include my saved home check, home layout and daily-life answers with this request. I agree to share them with MyIntel to coordinate professional review. I can add optional photos after sending.</span></label>}
              <label className={`help-consent${errors.consent ? " has-error" : ""}`}>
                <input
                  id="help-consent"
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? "help-consent-error" : undefined}
                />
                <span>I agree that MyIntel may use these details to contact me about this request.</span>
              </label>
              {errors.consent && <p id="help-consent-error" className="help-field-error help-consent-error" role="alert">{errors.consent}</p>}
            </fieldset>

            <div className="help-actions help-actions-form">
              <button type="submit" className="help-button help-button-primary" disabled={submitting}>
                {submitting ? "Sending request…" : "Send my request"}
              </button>
              <p className="help-action-note">You will review the scope and price before you commit.</p>
            </div>
          </form>
        )}

        {step === "success" && request && (
          <section className="help-success-card" aria-labelledby="help-success-title" aria-live="polite">
            <div className="help-success-icon" aria-hidden="true">✓</div>
            <p className="help-kicker">Request received</p>
            <h2 id="help-success-title">Your request is saved with MyIntel</h2>
            <p>We will follow up using your chosen contact method. You can review the scope and price before you commit.</p>
            <dl className="help-reference">
              <div><dt>Request reference</dt><dd>{request.id}</dd></div>
            </dl>
            {shareAssessment && <HomeReviewPhotos requestId={request.id}/>}
            <div className="help-success-actions">
              <button type="button" className="help-button help-button-primary" onClick={onRequests}>View my requests</button>
              <button type="button" className="help-button help-button-secondary" onClick={onBack}>Return home</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export { ProfessionalHelp };
