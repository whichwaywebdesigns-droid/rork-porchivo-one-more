import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary — catches render errors anywhere in the tree
 * and shows a friendly recovery screen instead of a blank page.
 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[Porchivo] Render error: ${message}`, info.componentStack ?? "");
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            backgroundColor: "#0B1530",
            color: "#E8EDF7",
            fontFamily: "system-ui, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px" }}>📦</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: "14px", color: "#8B97B5", maxWidth: "420px", margin: 0 }}>
            An unexpected error occurred while loading this page. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: "8px",
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#E85420",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
