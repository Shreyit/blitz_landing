"use client";
import { sportName } from "@/lib/sport-rules";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Crop,
  HeartHandshake,
  Mail,
  Upload,
  Users,
} from "lucide-react";
import { Mascot } from "./mascot";
import { VectorGuide } from "./vector-guide";
import { SPORTS } from "@/lib/event";
import { DEPARTMENT_DESCRIPTIONS, GENDERS, VOLUNTEER_DEPARTMENTS, genderLabel } from "@/lib/registration-options";
import { RegionPicker } from "./region-picker";
import { PhotoCropper } from "./photo-cropper";
import { INITIAL_PHOTO_CROP, type PhotoCrop } from "@/lib/photo-crop";
import { EMAIL_DOMAINS, emailInput, registrationEmail, type EmailDomain } from "@/lib/registration-email";
import { DEFAULT_WHATSAPP_COUNTRY, WHATSAPP_COUNTRIES, formatWhatsapp, whatsappFromParts } from "@/lib/whatsapp";
import { reactMascot, registrationReaction } from "@/lib/mascot-behavior";
export function Registration() {
  const params = useSearchParams();
  const [role, setRole] = useState(
    params.get("role") === "volunteer" ? "volunteer" : "player",
  );
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({
    name: "",
    whatsapp: "",
    programme: "BSASS",
    year: "1",
    age: "",
    gender: "",
    region: "",
    played_before: "",
  });
  const [department, setDepartment] = useState("");
  const [rationale, setRationale] = useState("");
  const [emailUsername, setEmailUsername] = useState("");
  const [emailDomain, setEmailDomain] = useState<EmailDomain>(EMAIL_DOMAINS[0]);
  const email = registrationEmail(emailUsername, emailDomain);
  const [whatsappCountry, setWhatsappCountry] = useState(DEFAULT_WHATSAPP_COUNTRY);
  const whatsapp = whatsappFromParts(whatsappCountry, details.whatsapp);
  const [sports, setSports] = useState<string[]>(
    SPORTS.some((sport) => sport === params.get("sport"))
      ? [params.get("sport")!]
      : [],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [originalPhoto, setOriginalPhoto] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [photoCrop, setPhotoCrop] = useState<PhotoCrop>(INITIAL_PHOTO_CROP);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    reactMascot(
      {
        ...registrationReaction({
          step,
          role,
          busy,
          success,
          error,
          sports: role === "player" ? sports.length : 0,
        }),
        sport: role === "player" ? sports.at(-1) : undefined,
      },
      success ? 6000 : busy ? 30000 : 4000,
      true,
    );
  }, [step, role, busy, success, error, sports]);
  useEffect(() => {
    if (photo)
      reactMascot(
        {
          action: "celebrate",
          message: "Photo selected. Ready for your team card.",
        },
        1800,
      );
  }, [photo]);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function go(next: number) {
    setStep(next);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function next(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (step === 0) {
      if (!details.name.trim() || !details.age || !details.gender || !details.region || !details.played_before) {
        setError("Complete your details and tell us whether you’ve played Bachelor’s BLITZ before.");
        return;
      }
      if (
        !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(stud\.tiss\.ac\.in|stud\.tiss\.edu)$/i.test(
          email,
        )
      ) {
        setError("Enter only your email username, the part before @, and choose your TISS domain.");
        return;
      }
      if (!whatsapp) {
        setError("Enter a valid WhatsApp number and check its country code.");
        return;
      }
      go(1);
    } else if (step === 1) {
      if (role === "player" && !sports.length) {
        setError("Select at least one sport.");
        return;
      }
      if (role === "volunteer" && (!department || !rationale.trim())) {
        setError("Choose one volunteer department and explain why you’re suitable and how you can contribute.");
        return;
      }
      if (!photo) {
        setError("Upload a photo so your team can recognise you.");
        return;
      }
      go(2);
    } else submit();
  }
  function submit() {
    if (!consent || !photo || busy) return;
    setBusy(true);
    setProgress(0);
    setError("");
    const body = new FormData();
    Object.entries(details).forEach(([key, value]) =>
      body.append(key, value.trim()),
    );
    body.append("email", email);
    body.set("whatsapp", whatsapp ?? "");
    body.append("role", role);
    body.append("sports", JSON.stringify(role === "player" ? sports : []));
    if (role === "volunteer") {
      body.append("volunteer_department", department);
      body.append("volunteer_rationale", rationale.trim());
    }
    body.append("photo", photo);
    body.append("consent", "true");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/registrations");
    xhr.timeout = 30000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      let response;
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        setError(
          "The event server is unavailable. Your registration has not been confirmed. Please try again.",
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) setSuccess(true);
      else
        setError(
          typeof response.detail === "string"
            ? response.detail
            : "Please check your registration details and try again.",
        );
    };
    xhr.onerror = xhr.ontimeout = () => {
      setBusy(false);
      setError(
        "We could not confirm your registration. Check your connection and try again.",
      );
    };
    xhr.send(body);
  }
  const guide =
    step === 0
      ? [
          "First, a proper introduction.",
          "Enter your email username and choose its domain. Your confirmation and team news will arrive in that inbox.",
        ]
      : step === 1
        ? [
            role === "player" ? "Show us your sporting side." : "Find your place in the crew.",
            role === "player"
              ? "Pick all the sports you want to play. Choose a clear photo where your face is easy to recognise."
              : "Choose one department, then tell us why you’re a good fit and how you’ll help. Volunteers keep BLITZ running.",
          ]
        : [
            "Looking good. One last check.",
            "Check your details before you submit. We’ll email a confirmation with everything you signed up for.",
          ];
  return (
    <>
      <div className="page-intro" data-entrance>
        <span className="section-kicker">Make your first move</span>
        <h1>{success ? "You’re on the list." : "A place for your game."}</h1>
        <p>
          {success
            ? "Your registration is complete. Welcome to Bachelor’s BLITZ."
            : "Players bring the competition. Volunteers bring it all together. Choose your role and join BLITZ."}
        </p>
      </div>
      <div className="registration-layout">
        <aside className="registration-guide">
          <Mascot />
          <h3>{success ? "Check your inbox, teammate." : guide[0]}</h3>
          <p>
            {success
              ? "You’re registered. A confirmation with your submitted details is on its way."
              : guide[1]}
          </p>
        </aside>
        {success ? (
          <div className="success-panel" role="status">
            <CheckCircle2 size={45} />
            <h2>Your registration is complete.</h2>
            <p>
              We saved your {role} registration. A confirmation with your submitted
              details will be sent to <strong>{email}</strong>. Delivery
              may take a few minutes; check spam too.
            </p>
            <div className="notice">
              <Mail size={18} />
              <span>
                {role === "player"
                  ? "You’re in the player pool. We’ll email your team and final price after your auction assignment."
                  : "You’re joining the volunteer crew. Volunteer registrations stay outside the auction."}
              </span>
            </div>
            <Link href="/teams" className="button">
              Meet the eight teams <ArrowUpRight size={17} />
            </Link>
            <button type="button" className="secondary-link register-other-role" onClick={() => {
              setRole(role === "player" ? "volunteer" : "player");
              setSuccess(false);
              setConsent(false);
              go(1);
            }}>Also register as a {role === "player" ? "volunteer" : "player"} <ArrowUpRight size={15}/></button>
          </div>
        ) : (
          <form className="form-card" onSubmit={next}>
            <div className="role-selector" aria-label="Registration role">
              {[
                { value: "player", label: "Player", icon: Users },
                {
                  value: "volunteer",
                  label: "Volunteer",
                  icon: HeartHandshake,
                },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={role === option.value ? "active" : ""}
                  aria-pressed={role === option.value}
                  disabled={busy}
                  onClick={() => {
                    if (role === option.value) return;
                    setRole(option.value);
                    setConsent(false);
                    go(step === 2 ? 1 : step);
                  }}
                >
                  <option.icon size={16} />
                  {option.label}
                </button>
              ))}
            </div>
            <p className="registration-role-note">You can register as both a player and a volunteer. Submit a separate registration for each role.</p>
            <div className="stepper" aria-label={`Step ${step + 1} of 3`}>
              {["Your details", role === "player" ? "Your sports & photo" : "Your department & photo", "Review & register"].map(
                (label, i) => (
                  <span key={label} className={i <= step ? "active" : ""}>
                    {i + 1}. {label}
                  </span>
                ),
              )}
            </div>
            <h2 className="form-heading" tabIndex={-1} ref={heading}>
              {
                [
                  "Let’s get to know you.",
                  role === "player" ? "Bring your game face." : "How will you make a difference?",
                  "All set? Take a look.",
                ][step]
              }
            </h2>
            <p className="form-subtitle">
              {
                [
                  "Your institutional details keep this a campus affair.",
                  role === "player"
                    ? "One sport or a few. There’s room for both."
                    : "Choose one department and tell us what you’ll bring to the crew.",
                  "This is how your information will be registered.",
                ][step]
              }
            </p>
            {step === 0 && (
              <div className="field-grid">
                <label className="field full">
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={100}
                    placeholder="Your name, as your teammates know it"
                    value={details.name}
                    required
                    onChange={(e) =>
                      setDetails({ ...details, name: e.target.value })
                    }
                  />
                </label>
                <div className="field full">
                  <label htmlFor="registration-email">TISS email username</label>
                  <div className="institutional-email">
                    <input
                      id="registration-email"
                      name="email"
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={184}
                      placeholder="m2024bsass027"
                      aria-describedby="registration-email-help"
                      value={emailUsername}
                      required
                      onChange={(event) => {
                        const next = emailInput(event.target.value, emailDomain);
                        setEmailUsername(next.username);
                        setEmailDomain(next.domain);
                      }}
                    />
                    <select name="emailDomain" aria-label="TISS email domain" value={emailDomain}
                      onChange={(event) => setEmailDomain(event.target.value as EmailDomain)}>
                      {EMAIL_DOMAINS.map((domain) => <option key={domain} value={domain}>@{domain}</option>)}
                    </select>
                  </div>
                  <small id="registration-email-help">
                    Enter the part before @, then choose your email domain.
                  </small>
                  {email && <small className="registration-email-preview">Registration email: <strong>{email}</strong></small>}
                </div>
                <div className="field full">
                  <label htmlFor="registration-whatsapp">WhatsApp number</label>
                  <div className="whatsapp-input">
                    <select
                      name="whatsappCountry"
                      aria-label="WhatsApp country code"
                      value={whatsappCountry}
                      onChange={(e) => setWhatsappCountry(e.target.value)}
                    >
                      {WHATSAPP_COUNTRIES.map((country) => (
                        <option key={country.name} value={country.name} aria-label={`${country.name} +${country.code}`}>
                          {country.flag} +{country.code}
                        </option>
                      ))}
                    </select>
                    <input
                    id="registration-whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="98765 43210"
                    aria-describedby="registration-whatsapp-help"
                    value={details.whatsapp}
                    required
                    onChange={(e) =>
                      setDetails({ ...details, whatsapp: e.target.value })
                    }
                  />
                  </div>
                  <small id="registration-whatsapp-help">
                    Number from abroad? Change the country code. Only the organising team sees this number.
                  </small>
                </div>
                <label className="field">
                  Programme
                  <select
                    name="programme"
                    value={details.programme}
                    onChange={(e) =>
                      setDetails({ ...details, programme: e.target.value })
                    }
                  >
                    <option>BSASS</option>
                    <option>BSW</option>
                  </select>
                </label>
                <label className="field">
                  Year
                  <select
                    name="year"
                    value={details.year}
                    onChange={(e) =>
                      setDetails({ ...details, year: e.target.value })
                    }
                  >
                    {["1st", "2nd", "3rd", "4th"].map((year, i) => (
                      <option key={year} value={i + 1}>
                        {year} year
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">Age
                  <input name="age" type="number" inputMode="numeric" min={1} max={120} step={1} required placeholder="Your age in years" value={details.age}
                    onChange={(event) => setDetails({ ...details, age: event.target.value })}/>
                </label>
                <label className="field">Gender
                  <select name="gender" required value={details.gender} onChange={(event) => setDetails({ ...details, gender: event.target.value })}>
                    <option value="" disabled>Select your gender</option>
                    {GENDERS.map((gender) => <option key={gender} value={gender}>{genderLabel(gender)}</option>)}
                  </select>
                </label>
                <RegionPicker value={details.region} onChange={(region) => setDetails({ ...details, region })}/>
                <fieldset className="played-before-question field full">
                  <legend>Have you played Bachelor’s BLITZ before?</legend>
                  <div className="played-before-options">
                    {[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }].map((option) => <label key={option.value} className={details.played_before === option.value ? "selected" : ""}>
                      <input type="radio" name="played_before" required value={option.value} checked={details.played_before === option.value}
                        onChange={() => setDetails({ ...details, played_before: option.value })}/>{option.label}
                    </label>)}
                  </div>
                </fieldset>
              </div>
            )}
            {step === 1 && (
              <div className="field-grid">
                {role === "player" ? <div className="field full">
                  <span>
                    Sports you want to play
                  </span>
                  <details className="sport-picker" open>
                    <summary>
                      {sports.length
                        ? `${sports.length} sport${sports.length === 1 ? "" : "s"} selected`
                        : "Select your sports"}
                      <ChevronDown size={16} />
                    </summary>
                    <div className="sport-options">
                      {SPORTS.map((sport) => (
                        <label key={sport} data-mascot-sport={sport}>
                          <input
                            type="checkbox"
                            checked={sports.includes(sport)}
                            onChange={(e) =>
                              setSports(
                                e.target.checked
                                  ? [...sports, sport]
                                  : sports.filter((s) => s !== sport),
                              )
                            }
                          />
                          {sportName(sport)}
                        </label>
                      ))}
                    </div>
                  </details>
                  {sports.length > 0 && (
                    <div className="tags">
                      {sports.map((sport) => (
                        <span className="tag" key={sportName(sport)}>
                          <Check size={11} />
                          {sportName(sport)}
                        </span>
                      ))}
                    </div>
                  )}
                </div> : <>
                  <fieldset className="volunteer-departments field full">
                    <legend>Volunteer department <span>Choose one</span></legend>
                    <div className="volunteer-department-options">
                      {VOLUNTEER_DEPARTMENTS.map((option) => <label key={option} className={department === option ? "selected" : ""}>
                        <input type="radio" name="volunteer_department" value={option} required checked={department === option} onChange={() => setDepartment(option)}/>
                        <span><strong>{option}</strong><small>{DEPARTMENT_DESCRIPTIONS[option]}</small></span>
                      </label>)}
                    </div>
                  </fieldset>
                  <label className="field full">Why are you suitable, and how can you contribute?
                    <textarea name="volunteer_rationale" required maxLength={2000} rows={5} value={rationale}
                      placeholder="Tell us about your relevant skills or experience, and how you’d help your chosen department."
                      aria-describedby="volunteer-rationale-help" onChange={(event) => setRationale(event.target.value)}/>
                    <small id="volunteer-rationale-help">Explain both why you’re a good fit and what you can contribute. {rationale.length}/2000 characters.</small>
                  </label>
                </>}
                <div className="field full">
                  <span>Your photo</span>
                  <label className="upload-box">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Your selected registration photo"
                      />
                    ) : (
                      <Upload size={26} />
                    )}
                    <span>
                      {preview
                        ? "Choose a different photo"
                        : "Click to upload your game face"}
                    </span>
                    <small>
                      JPEG, PNG or WebP · up to 5 MB · clear face photo
                    </small>
                    <input
                      aria-label="Upload your photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError("Please choose a photo smaller than 5 MB.");
                          e.target.value = "";
                          return;
                        }
                        if (
                          !["image/jpeg", "image/png", "image/webp"].includes(
                            file.type,
                          )
                        ) {
                          setError("Choose a JPEG, PNG or WebP image.");
                          e.target.value = "";
                          return;
                        }
                        setCropSource(file);
                        setError("");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <small>
                    Crop your photo to a 1:1 square before uploading it. Only the cropped photo is submitted.
                  </small>
                  {photo && originalPhoto && <button type="button" className="secondary-link photo-recrop" onClick={() => setCropSource(originalPhoto)}><Crop size={14}/>Adjust photo crop</button>}
                </div>
              </div>
            )}
            {step === 2 && (
              <>
                <div className="review-profile">
                  {preview && (
                    <img src={preview} alt="Your registration photo" />
                  )}
                  <div>
                    <h3>{details.name}</h3>
                    <p>
                      {role === "player" ? "Player" : "Volunteer"} ·{" "}
                      {details.programme} · Year {details.year}
                    </p>
                  </div>
                </div>
                <dl className="review-fields">
                  <div>
                    <dt>Institutional email</dt>
                    <dd>{email}</dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{formatWhatsapp(whatsapp)}</dd>
                  </div>
                  <div>
                    <dt>Age</dt><dd>{details.age}</dd>
                  </div>
                  <div>
                    <dt>Gender</dt><dd>{genderLabel(details.gender)}</dd>
                  </div>
                  <div>
                    <dt>Region</dt><dd>{details.region}</dd>
                  </div>
                  <div><dt>Played Bachelor’s BLITZ before?</dt><dd>{details.played_before === "yes" ? "Yes" : "No"}</dd></div>
                  <div>
                    <dt>
                      {role === "player"
                        ? "Selected sports"
                        : "Volunteer department"}
                    </dt>
                    <dd>{role === "player" ? sports.map(sportName).join(", ") : department}</dd>
                  </div>
                  {role === "volunteer" && <div><dt>Suitability & contribution</dt><dd className="review-rationale">{rationale.trim()}</dd></div>}
                </dl>
                <label className="consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I agree to receive BLITZ registration and team emails.{" "}
                    {role === "player"
                      ? "My name, photo, programme, year and sports may appear in the auction and team rosters. My email stays private."
                      : "My information is shared with the organising team; my photo and email are not displayed publicly."}{" "}
                    My WhatsApp number, age, gender, region, and previous participation answer are shared only with the organising team.
                  </span>
                </label>
              </>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="secondary-link"
                  style={{ border: 0, background: "transparent" }}
                  disabled={busy}
                  onClick={() => go(step - 1)}
                >
                  <ArrowLeft size={15} /> Back
                </button>
              ) : (
                <span>
                  <VectorGuide step={step} /> A little help from Bolt.
                </span>
              )}
              <button type="submit" className="button" disabled={busy}>
                {busy
                  ? `Uploading ${progress}%`
                  : step === 2
                    ? "Register for BLITZ"
                    : "Continue"}
                <ArrowUpRight size={17} />
              </button>
            </div>
          </form>
        )}
      </div>
      {cropSource && <PhotoCropper file={cropSource} initialCrop={cropSource === originalPhoto ? photoCrop : INITIAL_PHOTO_CROP}
        onCancel={() => setCropSource(null)} onApply={(cropped, crop) => {
          setPhoto(cropped);
          setOriginalPhoto(cropSource);
          setPhotoCrop(crop);
          setCropSource(null);
          setError("");
        }}/>}
    </>
  );
}
