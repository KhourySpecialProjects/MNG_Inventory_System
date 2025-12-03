// src/frontend/tests/TeamspacesPage/EmptyState.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import EmptyState from '../../src/components/TeamspacePage/EmptyState';

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
}

describe('EmptyState', () => {
  it('displays loading state', () => {
    renderWithProviders(<EmptyState loading={true} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/loading your teams/i)).toBeInTheDocument();
  });

  it('displays error message', () => {
    renderWithProviders(<EmptyState error="Failed to load teams" />);

    expect(screen.getByText('Failed to load teams')).toBeInTheDocument();
  });

  it('displays empty state message', () => {
    renderWithProviders(<EmptyState isEmpty={true} />);

    expect(screen.getByText('No teams found')).toBeInTheDocument();
  });

  it('renders nothing when no state is active', () => {
    const { container } = renderWithProviders(<EmptyState />);

    expect(container.firstChild).toBeNull();
  });

  it('prioritizes loading over error', () => {
    renderWithProviders(<EmptyState loading={true} error="Some error" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Some error')).not.toBeInTheDocument();
  });

  it('prioritizes error over isEmpty', () => {
    renderWithProviders(<EmptyState error="Some error" isEmpty={true} />);

    expect(screen.getByText('Some error')).toBeInTheDocument();
    expect(screen.queryByText('No teams found')).not.toBeInTheDocument();
  });
});