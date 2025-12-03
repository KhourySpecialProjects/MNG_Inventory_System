// components/TeamsSearch.tsx
import { Stack, TextField, InputAdornment, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface TeamsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TeamsSearch({ value, onChange }: TeamsSearchProps) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      sx={{
        mb: 3,
        mx: { xs: 1.5, sm: 2, md: 3 },
      }}
    >
      <TextField
        label="Search teams"
        placeholder="Search teams..."
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: theme.palette.text.secondary }} />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => onChange('')}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />
    </Stack>
  );
}
