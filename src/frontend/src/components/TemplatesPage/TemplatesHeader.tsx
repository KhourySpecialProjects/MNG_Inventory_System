/**
 * Header component for the Templates page.
 * Displays the page title and a button to create a new template.
 */
import { Stack, Typography, Button, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';

interface TemplatesHeaderProps {
  onCreateTemplate: () => void;
}

export default function TemplatesHeader({ onCreateTemplate }: TemplatesHeaderProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate('/teams')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
          }}
        >
          Templates
        </Typography>
      </Stack>

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
