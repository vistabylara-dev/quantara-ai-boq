"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: ReactNode; children: ReactNode };
type State = { hasError: boolean };

/**
 * TAYQAN-2A — catches a WebGL context-creation failure, a corrupt/failed
 * GLB fetch, or a decoder error surfaced during render, so the rest of
 * Quantara (navigation, forms, BOQ controls) is never taken down by the
 * robot. React error boundaries must be class components; there is no hook
 * equivalent in React 18.
 */
export class TayqanRobotErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: unknown): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[tayqan-robot] render failed, showing fallback", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
