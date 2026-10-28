import { Component } from 'react';
import { C } from '../tokens';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 20,
            color: C.onNegative,
            background: C.errorSurface,
            border: '1px solid #7f1d1d',
            borderRadius: 8,
          }}
        >
          <strong>Something went wrong:</strong> {this.state.error?.message}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginLeft: 12,
              padding: '4px 10px',
              background: C.errorBorder,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
