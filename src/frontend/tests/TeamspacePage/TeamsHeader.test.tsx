/**
 * Unit tests for TeamsHeader component.
 * Tests header rendering, button callbacks, and admin navigation link.
 * Verifies Create Team and Invite Member action triggers.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import TeamsHeader from '../../src/components/TeamspacePage/TeamsHeader';

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </BrowserRouter>,
  );
}

describe('TeamsHeader', () => {
  it('renders all buttons', () => {
    const mockOnCreateTeam = vi.fn();
    const mockOnInviteMember = vi.fn();

    renderWithProviders(
      <TeamsHeader onCreateTeam={mockOnCreateTeam} onInviteMember={mockOnInviteMember} />,
    );

    expect(screen.getByText('Teamspaces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /management/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument();
  });

  it('calls onCreateTeam when Create Team button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCreateTeam = vi.fn();
    const mockOnInviteMember = vi.fn();

    renderWithProviders(
      <TeamsHeader onCreateTeam={mockOnCreateTeam} onInviteMember={mockOnInviteMember} />,
    );

    const createButton = screen.getByRole('button', { name: /create team/i });
    await user.click(createButton);

    expect(mockOnCreateTeam).toHaveBeenCalledTimes(1);
  });

  it('calls onInviteMember when Invite Member button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCreateTeam = vi.fn();
    const mockOnInviteMember = vi.fn();

    renderWithProviders(
      <TeamsHeader onCreateTeam={mockOnCreateTeam} onInviteMember={mockOnInviteMember} />,
    );

    const inviteButton = screen.getByRole('button', { name: /invite member/i });
    await user.click(inviteButton);

    expect(mockOnInviteMember).toHaveBeenCalledTimes(1);
  });

  it('has correct link for Management button', () => {
    const mockOnCreateTeam = vi.fn();
    const mockOnInviteMember = vi.fn();

    renderWithProviders(
      <TeamsHeader onCreateTeam={mockOnCreateTeam} onInviteMember={mockOnInviteMember} />,
    );

    const managementLink = screen.getByRole('link', { name: /management/i });
    expect(managementLink).toHaveAttribute('href', '/admin');
  });
});
