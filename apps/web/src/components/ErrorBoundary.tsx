import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { useTranslation } from "../hooks/useTranslation";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t("common.somethingWentWrong")}</h1>
        <Alert kind="error">{error.message || t("common.unexpectedError")}</Alert>
        <div className="flex gap-3">
          <Button variant="primary" onClick={reset}>
            {t("common.tryAgain")}
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/")}>
            {t("common.goHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return <DefaultFallback error={error} reset={this.reset} />;
  }
}
