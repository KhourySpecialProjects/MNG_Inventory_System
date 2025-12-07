/**
 * Unit tests for TeamsSearch component.
 * Tests search input rendering, value display, onChange callbacks, and clear functionality.
 * Verifies controlled input behavior with character-by-character typing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import TeamsSearch from '../../src/components/TeamspacePage/TeamsSearch';

const theme = createTheme();

function renderWithProviders(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
}

describe('TeamsSearch', () => {
  it('renders search input', () => {
    const mockOnChange = vi.fn();
    renderWithProviders(<TeamsSearch value="" onChange={mockOnChange} />);

    expect(screen.getByLabelText(/search teams/i)).toBeInTheDocument();
  });

  it('displays the current value', () => {
    const mockOnChange = vi.fn();
    renderWithProviders(<TeamsSearch value="test query" onChange={mockOnChange} />);

    const input = screen.getByLabelText(/search teams/i);
    expect(input).toHaveValue('test query');
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    let currentValue = '';
    const mockOnChange = vi.fn((newValue: string) => {
      currentValue = newValue;
    });

    const { rerender } = renderWithProviders(
      <TeamsSearch value={currentValue} onChange={mockOnChange} />,
    );

    const input = screen.getByLabelText(/search teams/i);

    // Type each character
    await user.type(input, 'A');
    rerender(
      <ThemeProvider theme={theme}>
        <TeamsSearch value={currentValue} onChange={mockOnChange} />
      </ThemeProvider>,
    );

    await user.type(input, 'l');
    rerender(
      <ThemeProvider theme={theme}>
        <TeamsSearch value={currentValue} onChange={mockOnChange} />
      </ThemeProvider>,
    );

    await user.type(input, 'p');
    rerender(
      <ThemeProvider theme={theme}>
        <TeamsSearch value={currentValue} onChange={mockOnChange} />
      </ThemeProvider>,
    );

    await user.type(input, 'h');
    rerender(
      <ThemeProvider theme={theme}>
        <TeamsSearch value={currentValue} onChange={mockOnChange} />
      </ThemeProvider>,
    );

    await user.type(input, 'a');

    expect(mockOnChange).toHaveBeenCalledTimes(5);
    expect(mockOnChange).toHaveBeenCalledWith('A');
    expect(mockOnChange).toHaveBeenCalledWith('Al');
    expect(mockOnChange).toHaveBeenCalledWith('Alp');
    expect(mockOnChange).toHaveBeenCalledWith('Alph');
    expect(mockOnChange).toHaveBeenCalledWith('Alpha');
  });

  it('clears the search when value is empty', () => {
    const mockOnChange = vi.fn();
    const { rerender } = renderWithProviders(<TeamsSearch value="test" onChange={mockOnChange} />);

    rerender(
      <ThemeProvider theme={theme}>
        <TeamsSearch value="" onChange={mockOnChange} />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText(/search teams/i);
    expect(input).toHaveValue('');
  });
});
