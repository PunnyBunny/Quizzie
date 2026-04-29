import React, { useEffect, useRef, useState } from "react";
import { auth, signInWithEmailAndPassword } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import SimpleReactValidator from "simple-react-validator";
import { useAuthState } from "../lib/firebase-hooks";
import useForceUpdate from "use-force-update";
import { toUserMessage } from "../lib/errors";
import { Alert } from "../components/Alert";
import { useTranslation } from "../i18n/LanguageProvider";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const forceUpdate = useForceUpdate();

  const validator = useRef<SimpleReactValidator>(
    new SimpleReactValidator({
      autoForceUpdate: { forceUpdate },
      element: (message: string) => <p className="mt-1 text-xs text-red-600">{message}</p>,
    }),
  );

  const [user, loading] = useAuthState(auth);
  const authenticated = user != null;
  useEffect(() => {
    if (!loading && authenticated) {
      navigate("/", { replace: true });
    }
  }, [loading, authenticated, navigate]);

  if (loading) return <div>{t("common.loadingDots")}</div>;

  const formValid = validator.current.allValid();

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValid) {
      validator.current.showMessages();
      return;
    }

    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err, t("login.error")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white shadow rounded-xl p-6">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-sm text-gray-600 mb-6">{t("login.subtitle")}</p>
      <form onSubmit={submitForm} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t("login.email")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className={`w-full rounded-md border px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 ${
              !validator.current.fieldValid("email") ? "border-red-300" : "border-gray-300"
            }`}
            placeholder={t("login.emailPlaceholder")}
            autoComplete="email"
          />
          <span id="email-error">{validator.current.message("email", email, "required")}</span>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t("login.password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            className={`w-full rounded-md border px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 ${
              !validator.current.fieldValid("password") ? "border-red-300" : "border-gray-300"
            }`}
            placeholder={t("login.passwordPlaceholder")}
            autoComplete="current-password"
          />
          <span id="password-error">
            {validator.current.message("password", password, "required")}
          </span>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <button
          type="submit"
          disabled={submitting}
          className="relative inline-flex items-center justify-center gap-2 w-full rounded-md bg-indigo-600 text-white py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{!submitting ? t("login.submit") : t("login.submitting")}</span>
        </button>
      </form>
    </div>
  );
}
