/* eslint-disable @typescript-eslint/no-explicit-any */
// src/frontend/tests/TeamspacesPage/ViewMembersDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import ViewMembersDialog from '../../src/components/TeamspacePage/ViewMembersDialog';
import * as teamspaceApi from '../../src/api/teamspace';
import * as authApi from '../../src/api/auth';

vi.mock('../../src/api/teamspace', () => ({
  getTeamMembers: vi.fn(),
  removeUserTeamspace: vi.fn(),
}));

vi.mock('../../src/api/auth', () => ({
  me: vi.fn(),
}));

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
}

const mockUser = {
  userId: 'user123',
  name: 'Test User',
  username: 'testuser',
  role: 'admin',
  authenticated: true,
};

const mockMembers = [
  {
    userId: 'u1',
    username: 'john',
    name: 'John Doe',
    roleName: 'Admin',
    permissions: ['read', 'write', 'delete'],
  },
  {
    userId: 'u2',
    username: 'jane',
    name: 'Jane Smith',
    roleName: 'Member',
    permissions: ['read'],
  },
];

describe('ViewMembersDialog', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockShowSnackbar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnClose = vi.fn();
    mockShowSnackbar = vi.fn();
    (authApi.me as any).mockResolvedValue(mockUser);
    (teamspaceApi.getTeamMembers as any).mockResolvedValue({
      success: true,
      members: mockMembers,
    });
  });

  it('renders loading state initially', () => {
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays team name in title', async () => {
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/members – team alpha/i)).toBeInTheDocument();
    });
  });

  it('displays all members after loading', async () => {
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('@jane')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('displays role names', async () => {
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('filters members by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
      expect(screen.getByText('@jane')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name, username, or role/i);
    await user.type(searchInput, 'john');

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
      expect(screen.queryByText('@jane')).not.toBeInTheDocument();
    });
  });

  it('filters members by role', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
      expect(screen.getByText('@jane')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name, username, or role/i);
    await user.type(searchInput, 'Admin');

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
      expect(screen.queryByText('@jane')).not.toBeInTheDocument();
    });
  });

  it('removes member successfully', async () => {
    const user = userEvent.setup();
    (teamspaceApi.removeUserTeamspace as any).mockResolvedValue({
      success: true,
    });

    (teamspaceApi.getTeamMembers as any)
      .mockResolvedValueOnce({
        success: true,
        members: mockMembers,
      })
      .mockResolvedValueOnce({
        success: true,
        members: [mockMembers[1]], // Only Jane remains
      });

    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
    });

    // Find delete button for john
    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteButtons[0]); // First delete button (john's)

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Member removed', 'success');
    });
  });

  it('shows error when member removal fails', async () => {
    const user = userEvent.setup();
    (teamspaceApi.removeUserTeamspace as any).mockRejectedValue(new Error('Failed to remove'));

    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Failed to remove member', 'error');
    });
  });

  it('closes dialog when Close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes dialog when X button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@john')).toBeInTheDocument();
    });

    const xButton = screen.getByTestId('CloseIcon').closest('button');
    if (xButton) {
      await user.click(xButton);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows error snackbar when loading members fails', async () => {
    (teamspaceApi.getTeamMembers as any).mockRejectedValue(new Error('Failed to load'));

    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Failed to load members', 'error');
    });
  });

  it('sorts members by permissions (most to least)', async () => {
    const unsortedMembers = [
      {
        userId: 'u2',
        username: 'jane',
        name: 'Jane Smith',
        roleName: 'Member',
        permissions: ['read'],
      },
      {
        userId: 'u1',
        username: 'john',
        name: 'John Doe',
        roleName: 'Admin',
        permissions: ['read', 'write', 'delete'],
      },
    ];

    (teamspaceApi.getTeamMembers as any).mockResolvedValue({
      success: true,
      members: unsortedMembers,
    });

    renderWithProviders(
      <ViewMembersDialog
        open={true}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      const members = screen.getAllByText(/@\w+/);
      // John (admin with 3 permissions) should be first
      expect(members[0]).toHaveTextContent('@john');
      // Jane (member with 1 permission) should be second
      expect(members[1]).toHaveTextContent('@jane');
    });
  });

  it('does not load members when dialog is closed', () => {
    renderWithProviders(
      <ViewMembersDialog
        open={false}
        onClose={mockOnClose}
        teamId="1"
        teamName="Team Alpha"
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(teamspaceApi.getTeamMembers).not.toHaveBeenCalled();
  });
});
