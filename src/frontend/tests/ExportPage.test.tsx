import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExportPage from '../src/pages/ExportPage'; // Assuming this path
import { BrowserRouter } from 'react-router-dom';

// --- MOCK SETUP ---

// 1. Mock the API call to control the data and loading state
const mockItems = [
  { itemId: 1, name: 'Tool A', status: 'Completed', createdAt: 1678886400000 },
  { itemId: 2, name: 'Tool B', status: 'To Review', createdAt: 1678886400000 },
  { itemId: 3, name: 'Tool C', status: 'Damaged', createdAt: 1678886400000 },
  { itemId: 4, name: 'Tool D', status: 'Shortages', createdAt: 1678886400000 },
  { itemId: 5, name: 'Tool E', status: 'Found', createdAt: 1678886400000 }, // another completed status
];
const getItems = jest.fn(() => Promise.resolve({ items: mockItems }));
jest.mock("../api/items", () => ({ getItems }));

// 2. Mock external components to isolate ExportPage
jest.mock("../components/TopBar", () => ({
  __esModule: true,
  // FIX: Provide a default value during destructuring to avoid implicit 'any' error
  default: function({ isLoggedIn = false }) {
    return <div data-testid="TopBar">TopBar (Logged: {isLoggedIn ? 'Yes' : 'No'})</div>;
  },
}));

jest.mock("../components/NavBar", () => ({
  __esModule: true,
  default: () => <div data-testid="NavBar">NavBar</div>,
}));

jest.mock("../components/ExportPageContent", () => ({
  __esModule: true,
  // FIX: Provide a default value during destructuring to avoid implicit 'any' error
  default: function({ activeCategory = 'completed' }) {
    return (
      <div data-testid="ExportPageContent">
        Export Content for category: {activeCategory}
      </div>
    );
  },
}));

// 3. Mock router hooks (useParams)
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ teamId: 'test-team-123' }),
}));

// 4. Mock the internal setTimeout used for generation simulation
// This is critical to make the generation flow fast and deterministic.
jest.useFakeTimers();

const setup = () => render(<ExportPage />, { wrapper: BrowserRouter });


// --- TESTS ---

describe('ExportPage', () => {

  // Test 1: Initial Loading State
  it('shows a loading spinner before data is fetched', () => {
    // Prevent the mock promise from resolving immediately
    getItems.mockImplementationOnce(() => new Promise(() => {}));
    setup();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/create inventory documents/i)).not.toBeInTheDocument();
  });

  // Test 2: Data Loaded State
  it('transitions from loading to displaying content after data fetching is complete', async () => {
    setup();

    // Wait for the API call to resolve and the UI to update
    await waitFor(() => {
      expect(getItems).toHaveBeenCalledWith('test-team-123');
    });

    // Check for calculated progress (4 reviewed items / 5 total items = 80%)
    expect(screen.getByText('Inventory Completion: 80%')).toBeInTheDocument();

    // Check for initial category buttons and default active state
    const completedButton = screen.getByRole('button', { name: /completed inventory/i });
    const brokenButton = screen.getByRole('button', { name: /broken items/i });

    expect(completedButton).toHaveAttribute('aria-current', 'true'); // Or check for 'contained' variant styles if possible
    expect(brokenButton).toHaveAttribute('aria-current', 'false');

    // Check for the main action button
    expect(screen.getByRole('button', { name: /create documents/i })).toBeInTheDocument();

    // Check that mocks are present
    expect(screen.getByTestId('TopBar')).toBeInTheDocument();
    expect(screen.getByTestId('NavBar')).toBeInTheDocument();
  });

  // Test 3: Category Switching
  it('changes the active category when clicking the broken items button', async () => {
    setup();

    await waitFor(() => {
        expect(screen.getByText(/create inventory documents/i)).toBeInTheDocument();
    });

    const brokenButton = screen.getByRole('button', { name: /broken items/i });
    fireEvent.click(brokenButton);

    // Verify the active state has switched (The component re-renders and the CSV data is recomputed)
    expect(brokenButton).toHaveAttribute('aria-current', 'true');
    
    // Now simulate document creation
    fireEvent.click(screen.getByRole('button', { name: /create documents/i }));

    // Advance timers to skip the generation simulation
    jest.advanceTimersByTime(3000);

    // Wait for the ExportPageContent to appear
    await waitFor(() => {
        expect(screen.getByTestId('ExportPageContent')).toBeInTheDocument();
    });

    // Verify that ExportPageContent received the correct activeCategory prop
    expect(screen.getByText(/Export Content for category: broken/i)).toBeInTheDocument();
  });


  // Test 4: Document Generation Flow
  it('handles the generation flow from initial state to content display', async () => {
    setup();

    // 1. Ensure initial state is ready
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /create documents/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create documents/i });
    fireEvent.click(createButton);

    // 2. Generating State
    expect(screen.getByText(/generating your documents/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create documents/i })).not.toBeInTheDocument();

    // 3. Complete Generation (advance the 3s simulation)
    jest.advanceTimersByTime(3000);

    // 4. Documents Created State
    await waitFor(() => {
        // ExportPageContent should be visible
        expect(screen.getByTestId('ExportPageContent')).toBeInTheDocument();
    });

    // Check that the default category was passed (completed)
    expect(screen.getByText(/Export Content for category: completed/i)).toBeInTheDocument();
  });
});