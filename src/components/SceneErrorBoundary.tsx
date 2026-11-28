import { Component } from 'react';
import type { ReactNode } from 'react';

interface State {
  failed: boolean;
}

/**
 * Keeps the page usable if a 3D view fails (no WebGL, a lost graphics context, a shader error):
 * the panels and navigation stay, and a short message replaces the black canvas.
 */
export class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D view failed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, lineHeight: 1.5 }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>This 3D view couldn't start on this device.</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
            Your browser may not support WebGL 2, or its graphics drivers need updating. The facts are still available.
          </div>
        </div>
      </div>
    );
  }
}
