/**
 * Header component for the Templates page.
 * Displays the page title and a button to create a new template.
 */
import { Stack, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';

interface TemplatesHeaderProps {
  onCreateTemplate: () => void;
}

export default function TemplatesHeader({ onCreateTemplate }: TemplatesHeaderProps) {
  const theme = useTheme();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: theme.palette.text.primary,
        }}
      >
        Templates
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        <Button
          variant="contained"
          color="warning"
          onClick={onCreateTemplate}
          startIcon={<AddIcon />}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            transition: 'all 0.2s ease',
          }}
        >
          Create Template
        </Button>
      </Stack>
    </Stack>
  );
}
