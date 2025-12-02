import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TeamsGrid from '../../src/components/TeamspacePage/TeamsGrid';

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </BrowserRouter>
  );
}

const mockTeams = [
  {
    teamId: '1',
    GSI_NAME: 'Alpha Team',
    description: 'First team',
    percent: 75,
  },
  {
    teamId: '2',
    GSI_NAME: 'Beta Team',
    description: 'Second team',
    percent: 50,
  },
];

describe('TeamsGrid', () => {
  it('renders all teams', () => {
    const mockCallbacks = {
      onInvite: vi.fn(),
      onRemove: vi.fn(),
      onDelete: vi.fn(),
      onViewMembers: vi.fn(),
    };

    renderWithProviders(<TeamsGrid teams={mockTeams} {...mockCallbacks} />);

    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText('Beta Team')).toBeInTheDocument();
    expect(screen.getByText('First team')).toBeInTheDocument();
    expect(screen.getByText('Second team')).toBeInTheDocument();
  });

  it('renders empty grid when no teams provided', () => {
    const mockCallbacks = {
      onInvite: vi.fn(),
      onRemove: vi.fn(),
      onDelete: vi.fn(),
      onViewMembers: vi.fn(),
    };

    const { container } = renderWithProviders(
      <TeamsGrid teams={[]} {...mockCallbacks} />
    );

    const grid = container.querySelector('.MuiGrid-container');
    expect(grid?.children.length).toBe(0);
  });

  it('displays team percentages', () => {
    const mockCallbacks = {
      onInvite: vi.fn(),
      onRemove: vi.fn(),
      onDelete: vi.fn(),
      onViewMembers: vi.fn(),
    };

    renderWithProviders(<TeamsGrid teams={mockTeams} {...mockCallbacks} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('handles teams with missing descriptions', () => {
    const teamsWithoutDescription = [
      {
        teamId: '3',
        GSI_NAME: 'Gamma Team',
        percent: 100,
      },
    ];

    const mockCallbacks = {
      onInvite: vi.fn(),
      onRemove: vi.fn(),
      onDelete: vi.fn(),
      onViewMembers: vi.fn(),
    };

    renderWithProviders(
      <TeamsGrid teams={teamsWithoutDescription} {...mockCallbacks} />
    );

    expect(screen.getByText('Gamma Team')).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
  });
});