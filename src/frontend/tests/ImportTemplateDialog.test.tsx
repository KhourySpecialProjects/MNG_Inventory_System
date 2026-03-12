import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router';
import ImportTemplateDialog from '../src/components/ImportTemplateDialog';
import theme from '../src/theme';

vi.mock('../src/api/templates', () => ({
  getTemplates: vi.fn(async () => ({
    templates: [
      { templateId: 'tmpl-1', name: 'Template A', itemCount: 3 },
      { templateId: 'tmpl-2', name: 'Template B', itemCount: 0 },
    ],
  })),
  getTemplateItems: vi.fn(async () => ({
    items: [
      { templateItemId: 'ti-1', name: 'Item 1', isKit: false, parent: null, nsn: '1234' },
      { templateItemId: 'ti-2', name: 'Kit 1', isKit: true, parent: null, liin: 'L001' },
      { templateItemId: 'ti-3', name: 'Kit Child', isKit: false, parent: 'ti-2', nsn: '5678' },
    ],
  })),
  importTemplateToTeam: vi.fn(async () => ({ success: true, itemsCreated: 3 })),
}));

vi.mock('../src/api/auth', () => ({
  me: vi.fn(async () => ({ userId: 'test-user' })),
}));

function renderDialog(props: Partial<React.ComponentProps<typeof ImportTemplateDialog>> = {}) {
  const defaultProps = {
    teamId: 'team-001',
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    showSnackbar: vi.fn(),
  };

  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <ImportTemplateDialog {...defaultProps} {...props} />
      </BrowserRouter>
    </ThemeProvider>,
  );
}

describe('ImportTemplateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title when open', () => {
    renderDialog();
    expect(screen.getByText('Import from Template')).toBeTruthy();
  });

  it('shows template selector', () => {
    renderDialog();
    expect(screen.getByLabelText('Select Template')).toBeTruthy();
  });

  it('does not render when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Import from Template')).toBeNull();
  });

  it('shows "No items selected" initially', () => {
    renderDialog();
    expect(screen.getByText('No items selected')).toBeTruthy();
  });
});
