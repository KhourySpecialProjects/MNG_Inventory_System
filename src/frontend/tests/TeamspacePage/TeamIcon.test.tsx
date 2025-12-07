/**
 * Unit tests for TeamIcon component.
 * Tests team card rendering, progress display, menu interactions, and action callbacks.
 * Verifies context menu options (open, view members, invite, remove, delete).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import TeamIcon from '../../src/components/TeamspacePage/TeamIcon';

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </BrowserRouter>,
  );
}

describe('TeamIcon', () => {
  const defaultProps = {
    id: '1',
    name: 'Test Team',
    description: 'Test Description',
    percent: 75,
    onInvite: vi.fn(),
    onRemove: vi.fn(),
    onDelete: vi.fn(),
    onViewMembers: vi.fn(),
  };

  it('renders team name and description', () => {
    renderWithProviders(<TeamIcon {...defaultProps} />);

    expect(screen.getByText('Test Team')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('displays percentage', () => {
    renderWithProviders(<TeamIcon {...defaultProps} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows "No description" when description is missing', () => {
    renderWithProviders(<TeamIcon {...defaultProps} description={undefined} />);

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('opens menu when more button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TeamIcon {...defaultProps} />);

    const moreButton = screen.getByRole('button', { name: '' });
    await user.click(moreButton);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('View Members')).toBeInTheDocument();
    expect(screen.getByText('Invite Member')).toBeInTheDocument();
    expect(screen.getByText('Remove Member')).toBeInTheDocument();
    expect(screen.getByText('Delete Teamspace')).toBeInTheDocument();
  });

  it('calls onViewMembers when View Members is clicked', async () => {
    const user = userEvent.setup();
    const mockOnViewMembers = vi.fn();
    renderWithProviders(<TeamIcon {...defaultProps} onViewMembers={mockOnViewMembers} />);

    const moreButton = screen.getByRole('button', { name: '' });
    await user.click(moreButton);

    const viewMembersOption = screen.getByText('View Members');
    await user.click(viewMembersOption);

    expect(mockOnViewMembers).toHaveBeenCalledWith('1', 'Test Team');
  });

  it('truncates long team names with ellipsis', () => {
    const longName = 'Very Long Team Name That Should Be Truncated';
    renderWithProviders(<TeamIcon {...defaultProps} name={longName} />);

    const nameElement = screen.getByText(longName);
    const styles = window.getComputedStyle(nameElement);

    expect(styles.overflow).toBe('hidden');
    expect(styles.textOverflow).toBe('ellipsis');
    expect(styles.whiteSpace).toBe('nowrap');
  });
});
