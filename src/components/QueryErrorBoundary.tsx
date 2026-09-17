import { Component, type ReactNode } from "react";

/**
 * Render-time safety net for reactive Convex queries.
 *
 * Convex's `useQuery` re-throws server errors during React render — which
 * means a `data ?? fallback` guard can never execute for a thrown query
 * (it only covers the undefined/loading case). The backend handlers are
 * zero-throw, so this boundary is the last line of defense against an
 * unforeseen query failure: instead of a blank page, the user gets a
 * graceful notice with a retry action while the rest of the app keeps
 * working.
 */
interface QueryErrorBoundaryProps {
  children: ReactNode;
  /** Rendered with a retry callback when a query throws during render. */
  fallback: (retry: () => void) => ReactNode;
}

interface QueryErrorBoundaryState {
  error: Error | null;
}

export class QueryErrorBoundary extends Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  state: QueryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[QueryErrorBoundary] Suppressed query render error:", error.message);
  }

  retry = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.retry) : this.props.children;
  }
}
