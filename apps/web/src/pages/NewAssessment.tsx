import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssessmentSelect } from "@/components/AssessmentSelect";
import type { Gender, Language, LanguageEntryDto, SpecialEducationalNeeds } from "@vaca/contracts";
import React, { useRef, useState } from "react";
import SimpleReactValidator from "simple-react-validator";
import useForceUpdate from "use-force-update";
import { useBrowserSupport } from "../providers/RecordingSessionProvider.tsx";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "../hooks/useTranslation";

function BrowserSupportCheck({ children }: { children: React.ReactNode }) {
  const browserSupport = useBrowserSupport();
  const { t } = useTranslation();

  if (!browserSupport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-4">
          {t("browser.unsupported.title")}
        </h1>
        <p className="text-base sm:text-lg mb-4 max-w-md">{t("browser.unsupported.body")}</p>
      </div>
    );
  }

  return children;
}

export default function NewAssessment() {
  const { t } = useTranslation();
  const [studentName, setStudentName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [specialEducationalNeeds, setSpecialEducationalNeeds] = useState<
    SpecialEducationalNeeds | ""
  >("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [motherTongue, setMotherTongue] = useState<LanguageEntryDto>({ language: "" as Language });
  const [motherTongueOther, setMotherTongueOther] = useState("");
  const [otherLanguages, setOtherLanguages] = useState<LanguageEntryDto[]>([]);

  const languageOptions: { value: Language; label: string }[] = [
    { value: "cantonese", label: t("newAssessment.lang.cantonese") },
    { value: "mandarin", label: t("newAssessment.lang.mandarin") },
    { value: "english", label: t("newAssessment.lang.english") },
    { value: "other", label: t("newAssessment.lang.other") },
  ];

  const forceUpdate = useForceUpdate();

  const validator = useRef<SimpleReactValidator>(
    new SimpleReactValidator({
      autoForceUpdate: { forceUpdate },
      element: (message: string) => <p className="mt-1 text-sm text-destructive">{message}</p>,
    }),
  );

  const [createAssessment] = useCallable("api/create-assessment");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validator.current.allValid() || !specialEducationalNeeds) {
      setShowValidationErrors(true);
      validator.current.showMessages();
      return;
    }

    try {
      setSubmitting(true);

      // Build mother tongue with otherSpecify if needed
      const finalMotherTongue: LanguageEntryDto = {
        language: motherTongue.language,
        ...(motherTongue.language === "other" && motherTongueOther
          ? { otherSpecify: motherTongueOther }
          : {}),
      };

      const response = await createAssessment({
        name: studentName,
        birthDate: `${birthYear}-${birthMonth.padStart(2, "0")}`,
        gender: gender as Gender,
        specialEducationalNeeds,
        grade,
        school,
        motherTongue: finalMotherTongue,
        otherLanguages,
      });

      const { id: assessmentId } = response.data;
      window.location.href = `/assessment/${assessmentId}/s/0/instruction`;
    } catch (err) {
      console.error("Failed to create assessment:", err);
      setSubmitError(toUserMessage(err, t("newAssessment.error")));
    } finally {
      setSubmitting(false);
    }
  };

  // Re-register only fields present in this render, including dynamic language rows.
  validator.current.purgeFields();
  const dropdownInvalid = (value: string) => showValidationErrors && !value;
  const textInvalid = (value: string, rules: string) =>
    showValidationErrors && !validator.current.check(value, rules);

  return (
    <BrowserSupportCheck>
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">{t("newAssessment.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("newAssessment.subtitle")}</p>
          </div>

          {submitError && (
            <div className="mb-4">
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </div>
          )}

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <form
              onSubmit={submitForm}
              noValidate
              className="p-4 sm:p-6 md:p-8 flex flex-col gap-4"
            >
              <h2 className="text-lg font-semibold">{t("newAssessment.participantDetails")}</h2>

              <div className="space-y-2">
                <label htmlFor="studentName" className="text-sm font-medium">
                  {t("newAssessment.studentName")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="studentName"
                  type="text"
                  required
                  aria-invalid={textInvalid(studentName, "required|min:2")}
                  aria-describedby={
                    textInvalid(studentName, "required|min:2") ? "studentName-error" : undefined
                  }
                  placeholder={t("newAssessment.studentName.placeholder")}
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                  }}
                  autoComplete="name"
                />
                <span id="studentName-error">
                  {validator.current.message("studentName", studentName, "required|min:2")}
                </span>
              </div>

              <div className="space-y-2">
                <label htmlFor="birthYear" className="text-sm font-medium">
                  {t("newAssessment.birth")} <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-4">
                  <div className="min-w-0 flex-1">
                    <AssessmentSelect
                      id="birthYear"
                      required
                      aria-invalid={dropdownInvalid(birthYear)}
                      aria-describedby={dropdownInvalid(birthYear) ? "birthYear-error" : undefined}
                      value={birthYear}
                      onValueChange={setBirthYear}
                      placeholder={t("newAssessment.year")}
                      options={Array.from({ length: 30 }, (_, i) => {
                        const year = String(new Date().getFullYear() - i);
                        return { value: year, label: year };
                      })}
                    />
                    <span id="birthYear-error">
                      {validator.current.message("birthYear", birthYear, "required")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <AssessmentSelect
                      id="birthMonth"
                      aria-label={t("newAssessment.month")}
                      required
                      aria-invalid={dropdownInvalid(birthMonth)}
                      aria-describedby={
                        dropdownInvalid(birthMonth) ? "birthMonth-error" : undefined
                      }
                      value={birthMonth}
                      onValueChange={setBirthMonth}
                      placeholder={t("newAssessment.month")}
                      options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: String(i + 1),
                      }))}
                    />
                    <span id="birthMonth-error">
                      {validator.current.message("birthMonth", birthMonth, "required")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("newAssessment.gender")} <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={gender === "male"}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span>{t("newAssessment.male")}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={gender === "female"}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span>{t("newAssessment.female")}</span>
                  </label>
                </div>
                <span>{validator.current.message("gender", gender, "required")}</span>
              </div>

              <div className="space-y-2">
                <label htmlFor="grade" className="text-sm font-medium">
                  {t("newAssessment.grade")} <span className="text-destructive">*</span>
                </label>
                <AssessmentSelect
                  id="grade"
                  required
                  aria-invalid={dropdownInvalid(grade)}
                  aria-describedby={dropdownInvalid(grade) ? "grade-error" : undefined}
                  value={grade}
                  onValueChange={setGrade}
                  placeholder={t("newAssessment.grade.select")}
                  options={["S1", "S2", "S3", "S4", "S5", "S6"].map((value) => ({
                    value,
                    label: value,
                  }))}
                />
                <span id="grade-error">
                  {validator.current.message("grade", grade, "required|min:1")}
                </span>
              </div>

              <div className="space-y-2">
                <label htmlFor="school" className="text-sm font-medium">
                  {t("newAssessment.school")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="school"
                  type="text"
                  required
                  aria-invalid={textInvalid(school, "required")}
                  aria-describedby={textInvalid(school, "required") ? "school-error" : undefined}
                  placeholder={t("newAssessment.school.placeholder")}
                  value={school}
                  onChange={(e) => {
                    setSchool(e.target.value);
                  }}
                />
                <span id="school-error">
                  {validator.current.message("school", school, "required")}
                </span>
              </div>

              {/* Mother Tongue */}
              <div className="space-y-2">
                <label htmlFor="motherTongue" className="text-sm font-medium">
                  {t("newAssessment.motherTongue")} <span className="text-destructive">*</span>
                </label>
                <div className="flex flex-col gap-2">
                  <AssessmentSelect<Language>
                    id="motherTongue"
                    required
                    aria-invalid={dropdownInvalid(motherTongue.language)}
                    aria-describedby={
                      dropdownInvalid(motherTongue.language) ? "motherTongue-error" : undefined
                    }
                    value={motherTongue.language}
                    onValueChange={(language) => {
                      setMotherTongue({ language: language as Language });
                      if (language !== "other") setMotherTongueOther("");
                    }}
                    placeholder={t("newAssessment.lang.select")}
                    options={languageOptions}
                  />
                  <span id="motherTongue-error">
                    {validator.current.message("motherTongue", motherTongue.language, "required")}
                  </span>
                  {motherTongue.language === "other" && (
                    <Input
                      type="text"
                      aria-label={t("newAssessment.lang.specifyMother")}
                      placeholder={t("newAssessment.lang.specifyMother")}
                      value={motherTongueOther}
                      onChange={(e) => setMotherTongueOther(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Other Capable Languages */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("newAssessment.otherLanguages")}</label>
                <div className="flex flex-col gap-2">
                  {otherLanguages.map((entry, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <AssessmentSelect<Language>
                          id={`otherLanguage-${index}`}
                          aria-label={t("newAssessment.otherLanguages")}
                          required
                          aria-invalid={dropdownInvalid(entry.language)}
                          aria-describedby={
                            dropdownInvalid(entry.language)
                              ? `otherLanguage-${index}-error`
                              : undefined
                          }
                          value={entry.language}
                          onValueChange={(language) => {
                            const updated = [...otherLanguages];
                            updated[index] = { language: language as Language };
                            setOtherLanguages(updated);
                          }}
                          placeholder={t("newAssessment.lang.select")}
                          options={languageOptions}
                        />
                        <span id={`otherLanguage-${index}-error`}>
                          {validator.current.message(
                            `otherLanguage-${index}`,
                            entry.language,
                            "required",
                          )}
                        </span>
                        {entry.language === "other" && (
                          <Input
                            type="text"
                            aria-label={t("newAssessment.lang.specifyOther")}
                            placeholder={t("newAssessment.lang.specifyOther")}
                            value={entry.otherSpecify ?? ""}
                            onChange={(e) => {
                              const updated = [...otherLanguages];
                              updated[index] = { ...entry, otherSpecify: e.target.value };
                              setOtherLanguages(updated);
                            }}
                          />
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="lg"
                        type="button"
                        onClick={() => {
                          setOtherLanguages(otherLanguages.filter((_, i) => i !== index));
                        }}
                      >
                        {t("common.remove")}
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      setOtherLanguages([...otherLanguages, { language: "" as Language }])
                    }
                    className="self-start"
                  >
                    {t("newAssessment.lang.addAnother")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="specialEducationalNeeds" className="text-sm font-medium">
                  {t("newAssessment.specialEducationalNeeds")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <AssessmentSelect<SpecialEducationalNeeds>
                  id="specialEducationalNeeds"
                  required
                  aria-invalid={dropdownInvalid(specialEducationalNeeds)}
                  aria-describedby={
                    dropdownInvalid(specialEducationalNeeds)
                      ? "specialEducationalNeeds-error"
                      : undefined
                  }
                  value={specialEducationalNeeds}
                  onValueChange={setSpecialEducationalNeeds}
                  placeholder={t("newAssessment.lang.select")}
                  options={(
                    ["none", "autism_spectrum_disorder", "developmental_language_disorder"] as const
                  ).map((value) => ({
                    value,
                    label: t(`newAssessment.specialEducationalNeeds.${value}`),
                  }))}
                />
                {dropdownInvalid(specialEducationalNeeds) && (
                  <p id="specialEducationalNeeds-error" className="mt-1 text-sm text-destructive">
                    {t("newAssessment.specialEducationalNeeds.required")}
                  </p>
                )}
              </div>

              <Button
                variant="default"
                size="lg"
                aria-busy={submitting}
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {!submitting ? t("newAssessment.start") : t("newAssessment.starting")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </BrowserSupportCheck>
  );
}
