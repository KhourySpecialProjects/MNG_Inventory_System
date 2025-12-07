/**
 * Unit tests for TeamspaceDialogs components.
 * Tests CreateTeam, Invite, RemoveMember, DeleteTeam, and MissingName dialogs.
 * Verifies form validation, API integration, user search, and error handling workflows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import {
  CreateTeamDialog,
  InviteDialog,
  RemoveMemberDialog,
  DeleteTeamDialog,
  MissingNameDialog,
} from '../../src/components/TeamspacePage/TeamspaceDialogs';
import * as teamspaceApi from '../../src/api/teamspace';
import * as authApi from '../../src/api/auth';

vi.mock('../../src/api/teamspace');
vi.mock('../../src/api/auth');

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
}

const mockTeams = [
  { teamId: '1', GSI_NAME: 'Team Alpha', description: 'First team', percent: 75 },
  { teamId: '2', GSI_NAME: 'Team Beta', description: 'Second team', percent: 50 },
];

const mockUser = {
  userId: 'user123',
  name: 'Test User',
  username: 'testuser',
  role: 'user',
  authenticated: true,
};

describe('CreateTeamDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnRefresh = vi.fn();
  const mockShowSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
  });

  it('renders all form fields', () => {
    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(screen.getByText('Create New Teamspace')).toBeInTheDocument();
    expect(screen.getByLabelText(/teamspace name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/uic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
  });

  it('disables Create button when fields are empty', () => {
    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).toBeDisabled();
  });

  it('enables Create button when all fields are filled', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await user.type(screen.getByLabelText(/teamspace name/i), 'New Team');
    await user.type(screen.getByLabelText(/uic/i), 'UIC123');
    await user.type(screen.getByLabelText(/fe/i), 'John Doe');
    await user.type(screen.getByLabelText(/location/i), 'New York');

    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).not.toBeDisabled();
  });

  it('creates teamspace successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.createTeamspace).mockResolvedValue({
      success: true,
    });

    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await user.type(screen.getByLabelText(/teamspace name/i), 'New Team');
    await user.type(screen.getByLabelText(/uic/i), 'UIC123');
    await user.type(screen.getByLabelText(/fe/i), 'John Doe');
    await user.type(screen.getByLabelText(/location/i), 'New York');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Teamspace created successfully!', 'success');
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it('shows error when creation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.createTeamspace).mockResolvedValue({
      success: false,
      error: 'Failed to create',
    });

    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await user.type(screen.getByLabelText(/teamspace name/i), 'New Team');
    await user.type(screen.getByLabelText(/uic/i), 'UIC123');
    await user.type(screen.getByLabelText(/fe/i), 'John Doe');
    await user.type(screen.getByLabelText(/location/i), 'New York');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Failed to create', 'error');
    });
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateTeamDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('InviteDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnRefresh = vi.fn();
  const mockShowSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    vi.mocked(teamspaceApi.getAllUsers).mockResolvedValue({
      users: [
        { userId: 'u1', username: 'user1', name: 'User One' },
        { userId: 'u2', username: 'user2', name: 'User Two' },
      ],
    });
  });

  it('renders with two tabs', () => {
    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(screen.getByText('Add to Teamspace')).toBeInTheDocument();
    expect(screen.getByText('Invite to Platform')).toBeInTheDocument();
  });

  it('shows teamspace selection in Add to Teamspace tab', async () => {
    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/select teamspace/i)).toBeInTheDocument();
    });
  });

  it('shows email field in Invite to Platform tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const platformTab = screen.getByText('Invite to Platform');
    await user.click(platformTab);

    expect(screen.getByLabelText(/user email/i)).toBeInTheDocument();
  });

  it('filters users when searching', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/search username/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search username/i);
    await user.type(searchInput, 'user1');

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.queryByText('user2')).not.toBeInTheDocument();
    });
  });

  it('adds user to teamspace successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.addUserTeamspace).mockResolvedValue({
      success: true,
    });

    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/select teamspace/i)).toBeInTheDocument();
    });

    // Select teamspace
    const teamspaceSelect = screen.getByLabelText(/select teamspace/i);
    await user.click(teamspaceSelect);
    await user.click(screen.getByText('Team Alpha'));

    // Enter username
    const searchInput = screen.getByLabelText(/search username/i);
    await user.type(searchInput, 'user1');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('User "user1" added to teamspace.', 'success');
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it('sends platform invite successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.inviteUser).mockResolvedValue({ success: true });

    renderWithProviders(
      <InviteDialog
        open={true}
        onClose={mockOnClose}
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const platformTab = screen.getByText('Invite to Platform');
    await user.click(platformTab);

    const emailInput = screen.getByLabelText(/user email/i);
    await user.type(emailInput, 'test@example.com');

    const inviteButton = screen.getByRole('button', { name: /invite/i });
    await user.click(inviteButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Invitation sent to test@example.com',
        'success',
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

describe('RemoveMemberDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnRefresh = vi.fn();
  const mockShowSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    vi.mocked(teamspaceApi.getAllUsers).mockResolvedValue({
      users: [
        {
          userId: 'u1',
          username: 'user1',
          name: 'User One',
          teams: [{ teamId: '1', role: 'member' }],
        },
        {
          userId: 'u2',
          username: 'user2',
          name: 'User Two',
          teams: [{ teamId: '1', role: 'member' }],
        },
      ],
    });
  });

  it('renders workspace name', () => {
    renderWithProviders(
      <RemoveMemberDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(screen.getByText(/workspace: team alpha/i)).toBeInTheDocument();
  });

  it('shows team members in dropdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RemoveMemberDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/search member/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search member/i);
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
    });
  });

  it('removes member successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.removeUserTeamspace).mockResolvedValue({
      success: true,
    });

    renderWithProviders(
      <RemoveMemberDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/search member/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search member/i);
    await user.type(searchInput, 'user1');

    const removeButton = screen.getByRole('button', { name: /remove/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Member removed successfully.', 'success');
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it('shows error when removal fails', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.removeUserTeamspace).mockResolvedValue({
      success: false,
      error: 'Failed to remove',
    });

    renderWithProviders(
      <RemoveMemberDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/search member/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search member/i);
    await user.type(searchInput, 'user1');

    const removeButton = screen.getByRole('button', { name: /remove/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Failed to remove', 'error');
    });
  });
});

describe('DeleteTeamDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnRefresh = vi.fn();
  const mockShowSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
  });

  it('renders warning message', () => {
    renderWithProviders(
      <DeleteTeamDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace: team alpha/i)).toBeInTheDocument();
  });

  it('deletes teamspace successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.deleteTeamspace).mockResolvedValue({
      success: true,
    });

    renderWithProviders(
      <DeleteTeamDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Teamspace deleted successfully.', 'success');
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it('shows error when deletion fails', async () => {
    const user = userEvent.setup();
    vi.mocked(teamspaceApi.deleteTeamspace).mockResolvedValue({
      success: false,
      error: 'Failed to delete',
    });

    renderWithProviders(
      <DeleteTeamDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('Failed to delete', 'error');
    });
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteTeamDialog
        open={true}
        onClose={mockOnClose}
        workspaceId="1"
        workspaceName="Team Alpha"
        teams={mockTeams}
        onRefresh={mockOnRefresh}
        showSnackbar={mockShowSnackbar}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('MissingNameDialog', () => {
  const mockOnOpenProfile = vi.fn();

  it('renders warning message', () => {
    renderWithProviders(<MissingNameDialog open={true} onOpenProfile={mockOnOpenProfile} />);

    expect(screen.getByText(/missing name/i)).toBeInTheDocument();
    expect(screen.getByText(/please insert your name and username/i)).toBeInTheDocument();
  });

  it('calls onOpenProfile when Got It is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MissingNameDialog open={true} onOpenProfile={mockOnOpenProfile} />);

    const gotItButton = screen.getByRole('button', { name: /got it/i });
    await user.click(gotItButton);

    expect(mockOnOpenProfile).toHaveBeenCalled();
  });

  it('cannot be closed by clicking outside', () => {
    const { container } = renderWithProviders(
      <MissingNameDialog open={true} onOpenProfile={mockOnOpenProfile} />,
    );

    // Try to click on the backdrop
    const backdrop = container.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    // Dialog should still be visible
    expect(screen.getByText(/missing name/i)).toBeInTheDocument();
  });
});
