import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import TeamspacePage from '../../src/pages/TeamspacePage';
import * as teamspaceApi from '../../src/api/teamspace';
import * as authApi from '../../src/api/auth';

vi.mock('../../src/api/teamspace', () => ({
  getTeamspace: vi.fn(),
  getAllUsers: vi.fn(),
  getTeamMembers: vi.fn(),
  removeUserTeamspace: vi.fn(),
}));

vi.mock('../../src/api/auth', () => ({
  me: vi.fn(),
}));

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

const mockUser = {
  userId: 'user123',
  name: 'Test User',
  username: 'testuser',
  role: 'user',
  authenticated: true,
};

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </BrowserRouter>
  );
}

describe('TeamspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authApi.me).mockResolvedValue(mockUser);

    vi.mocked(teamspaceApi.getTeamspace).mockResolvedValue({
      success: true,
      teams: mockTeams,
    });

    vi.mocked(teamspaceApi.getAllUsers).mockResolvedValue({
      success: true,
      users: [],
    });
  });

  it('renders loading state initially', () => {
    renderWithProviders(<TeamspacePage />);
    expect(screen.getByText(/loading your teams/i)).toBeInTheDocument();
  });

  it('displays teams after loading', async () => {
    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
      expect(screen.getByText('Beta Team')).toBeInTheDocument();
    });
  });

  it('displays error message when teams fail to load', async () => {
    vi.mocked(teamspaceApi.getTeamspace).mockRejectedValue(
      new Error('Failed to load teams')
    );

    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load teams/i)).toBeInTheDocument();
    });
  });

  it('opens create team dialog when Create Team button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create team/i });
    await user.click(createButton);

    expect(screen.getByText(/create new teamspace/i)).toBeInTheDocument();
  });

  it('opens invite dialog when Invite Member button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    });

    const inviteButton = screen.getByRole('button', { name: /^invite member$/i });
    await user.click(inviteButton);

    expect(
      screen.getByRole('heading', { name: /invite member/i })
    ).toBeInTheDocument();
  });

  it('filters teams based on search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
      expect(screen.getByText('Beta Team')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search teams/i);
    await user.type(searchInput, 'Alpha');

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
      expect(screen.queryByText('Beta Team')).not.toBeInTheDocument();
    });
  });

  it('shows missing name dialog when user has no name', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      ...mockUser,
      name: '',
    });

    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText(/missing name/i)).toBeInTheDocument();
      expect(
        screen.getByText(/please insert your name and username/i)
      ).toBeInTheDocument();
    });
  });

  it('navigates to admin page when Management button is clicked', async () => {
    renderWithProviders(<TeamspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    });

    const managementButton = screen.getByRole('link', { name: /management/i });
    expect(managementButton).toHaveAttribute('href', '/admin');
  });
});