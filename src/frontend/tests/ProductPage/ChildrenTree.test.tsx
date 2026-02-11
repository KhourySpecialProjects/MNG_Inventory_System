/**
 * Unit tests for ChildrenTree component.
 * Tests hierarchical tree rendering, expand/collapse functionality, navigation,
 * and inline status editing for kit children (staged locally, not saved directly).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChildrenTree from '../../src/components/ProductPage/ChildrenTree';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const defaultProps = {
  teamId: 'test-team-123',
  childEdits: {} as Record<string, { status: string; damageReports: string[]; ohQuantity: number | string }>,
  onChildEditsChange: vi.fn(),
};

describe('ChildrenTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onChildEditsChange = vi.fn();
    defaultProps.childEdits = {};
  });

  it('returns null when editedProduct has no children', () => {
    const { container } = renderWithRouter(
      <ChildrenTree editedProduct={{ children: [] }} {...defaultProps} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when editedProduct is null', () => {
    const { container } = renderWithRouter(
      <ChildrenTree editedProduct={null} {...defaultProps} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when children is undefined', () => {
    const { container } = renderWithRouter(
      <ChildrenTree editedProduct={{}} {...defaultProps} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders kit contents header with correct count', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Found' },
        { itemId: 'child-2', name: 'Item 2', actualName: 'Child 2', status: 'Incomplete' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByText(/📦 Kit Contents \(2 items\)/i)).toBeInTheDocument();
  });

  it("uses singular 'item' for one child", () => {
    const productOneChild = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Found' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productOneChild} {...defaultProps} />);

    expect(screen.getByText(/📦 Kit Contents \(1 item\)$/i)).toBeInTheDocument();
  });

  it('renders all child items with correct names', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Bandages', actualName: 'Gauze Pack', status: 'Found' },
        {
          itemId: 'child-2',
          name: 'Scissors',
          actualName: 'Medical Scissors',
          status: 'Incomplete',
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByText(/├─ Bandages/i)).toBeInTheDocument();
    expect(screen.getByText(/Gauze Pack/i)).toBeInTheDocument();
    expect(screen.getByText(/├─ Scissors/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical Scissors/i)).toBeInTheDocument();
  });

  it('displays status chips with correct colors', () => {
    const productWithChildren = {
      children: [
        { itemId: 'c1', name: 'Item 1', status: 'Completed' },
        { itemId: 'c2', name: 'Item 2', status: 'Damaged' },
        { itemId: 'c3', name: 'Item 3', status: 'Shortages' },
        { itemId: 'c4', name: 'Item 4', status: 'To Review' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const chips = screen.getAllByText('Completed');
    const completedChip = chips.find((el) => el.closest('.MuiChip-root'));
    expect(completedChip?.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');

    const damagedChips = screen.getAllByText('Damaged');
    const damagedChip = damagedChips.find((el) => el.closest('.MuiChip-root'));
    expect(damagedChip?.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');

    const shortagesChips = screen.getAllByText('Shortages');
    const shortagesChip = shortagesChips.find((el) => el.closest('.MuiChip-root'));
    expect(shortagesChip?.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
  });

  it('navigates to child item when clicked', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const childCard = screen.getByText(/├─ Item 1/i).closest('.MuiCard-root');
    fireEvent.click(childCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/teams/test-team-123/items/child-1');
  });

  it('shows expand button for children with sub-children', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          actualName: 'Sub Kit 1',
          children: [{ itemId: 'grandchild-1', name: 'Item', actualName: 'Deep Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} {...defaultProps} />);

    const expandButton = screen.getByTestId('ExpandMoreIcon');
    expect(expandButton).toBeInTheDocument();
  });

  it('does not show expand icon for children without sub-children', () => {
    const productNoNesting = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', children: [] }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNoNesting} {...defaultProps} />);

    expect(screen.queryByTestId('ExpandMoreIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ExpandLessIcon')).not.toBeInTheDocument();
  });

  it('expands to show grandchildren when expand clicked', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Deep Item', actualName: 'Item 1' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} {...defaultProps} />);

    const deepItemElements = screen.getAllByText(/Deep Item/i);
    const collapseParent = deepItemElements[0].closest('.MuiCollapse-root');
    expect(collapseParent).toHaveClass('MuiCollapse-hidden');

    const expandIcon = screen.getByTestId('ExpandMoreIcon');
    fireEvent.click(expandIcon.closest('button')!);

    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');
  });

  it('collapses grandchildren when collapse clicked', async () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Deep Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} {...defaultProps} />);

    const expandIcon = screen.getByTestId('ExpandMoreIcon');
    fireEvent.click(expandIcon.closest('button')!);

    const deepItemElements = screen.getAllByText(/Deep Item/i);
    const collapseParent = deepItemElements[0].closest('.MuiCollapse-root');
    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');

    const collapseIcon = screen.getByTestId('ExpandLessIcon');
    fireEvent.click(collapseIcon.closest('button')!);
    await waitFor(() => {
      expect(collapseParent).toHaveClass('MuiCollapse-hidden');
    });
  });

  it('does not navigate when expand button clicked', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} {...defaultProps} />);

    const expandIcon = screen.getByTestId('ExpandMoreIcon');
    fireEvent.click(expandIcon.closest('button')!);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles deeply nested children (4+ levels)', () => {
    const deepNested = {
      children: [
        {
          itemId: 'l1',
          name: 'Level 1',
          children: [
            {
              itemId: 'l2',
              name: 'Level 2',
              children: [
                {
                  itemId: 'l3',
                  name: 'Level 3',
                  children: [{ itemId: 'l4', name: 'Level 4', children: [] }],
                },
              ],
            },
          ],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={deepNested} {...defaultProps} />);

    const expandIcons = screen.getAllByTestId('ExpandMoreIcon');
    expandIcons.forEach((icon) => fireEvent.click(icon.closest('button')!));

    const level4Elements = screen.getAllByText(/Level 4/i);
    expect(level4Elements.length).toBeGreaterThan(0);
  });

  it('applies correct indentation at different levels', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Level 1',
          children: [{ itemId: 'grandchild-1', name: 'Level 2', children: [] }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} {...defaultProps} />);

    const expandIcon = screen.getByTestId('ExpandMoreIcon');
    fireEvent.click(expandIcon.closest('button')!);

    const level2Elements = screen.getAllByText(/Level 2/i);
    const level2Card = level2Elements[0].closest('.MuiCard-root');
    expect(level2Card).toHaveStyle({ marginLeft: expect.any(String) });
  });

  it('uses fallback to name when actualName is missing', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item Name Only', actualName: undefined }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const nameElements = screen.getAllByText(/Item Name Only/i);
    expect(nameElements.length).toBeGreaterThan(0);
  });

  it('handles children without status field', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByText(/Item 1/i)).toBeInTheDocument();
  });

  // --- Inline status editing tests ---

  it('renders status buttons for each child item', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'To Review' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByLabelText('Set Item 1 status to To Review')).toBeInTheDocument();
    expect(screen.getByLabelText('Set Item 1 status to Completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Set Item 1 status to Damaged')).toBeInTheDocument();
    expect(screen.getByLabelText('Set Item 1 status to Shortages')).toBeInTheDocument();
  });

  it('highlights the current status button as contained', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Completed' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const completedBtn = screen.getByLabelText('Set Item 1 status to Completed');
    expect(completedBtn).toHaveClass('MuiButton-contained');

    const toReviewBtn = screen.getByLabelText('Set Item 1 status to To Review');
    expect(toReviewBtn).toHaveClass('MuiButton-outlined');
  });

  it('calls onChildEditsChange when status button is clicked', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'To Review' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const completedBtn = screen.getByLabelText('Set Item 1 status to Completed');
    fireEvent.click(completedBtn);

    expect(defaultProps.onChildEditsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        'child-1': expect.objectContaining({ status: 'Completed' }),
      }),
    );
  });

  it('does not navigate when status button is clicked', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'To Review' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    const completedBtn = screen.getByLabelText('Set Item 1 status to Completed');
    fireEvent.click(completedBtn);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows DamageReportsSection when child status is Damaged', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Damaged' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByText('Damage Reports')).toBeInTheDocument();
  });

  it('shows OH Quantity field when child status is Shortages for items', () => {
    const productWithChildren = {
      children: [
        {
          itemId: 'child-1',
          name: 'Item 1',
          actualName: 'Child 1',
          status: 'Shortages',
          isKit: false,
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.getByLabelText('OH Quantity')).toBeInTheDocument();
  });

  it('does not show OH Quantity for child kits with Shortages status', () => {
    const productWithChildren = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          actualName: 'Kit 1',
          status: 'Shortages',
          isKit: true,
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} {...defaultProps} />);

    expect(screen.queryByLabelText('OH Quantity')).not.toBeInTheDocument();
  });
});
