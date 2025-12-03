/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paper,
  Typography,
  Stack,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import CircularProgressBar from '../CircularProgressBar';

interface InventoryReviewedProps {
  percentReviewed: number;
  items: Array<{ updatedAt?: string }>;
  timeMode: 'hours' | 'days';
  selectedValue: number;
  onChangeTimeMode: (mode: 'hours' | 'days') => void;
  onChangeValue: (value: number) => void;
}

// Custom Tooltip Component
function CustomTooltip({ active, payload }: any) {
  const theme = useTheme();
  
  if (active && payload && payload.length) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 1.5,
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          {payload[0].payload.label}
        </Typography>
        <Typography variant="body2" color="primary">
          Reviewed: {payload[0].value}
        </Typography>
      </Paper>
    );
  }
  return null;
}

export default function InventoryReviewed({
  percentReviewed,
  items,
  timeMode,
  selectedValue,
  onChangeTimeMode,
  onChangeValue,
}: InventoryReviewedProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  // create a function to create histogram buckets by inputted hour/day
  function computeHistogram(items: any[], timeMode: 'hours' | 'days', selectedValue: number) {
    const now = new Date();
    const bucketCount = selectedValue;
    const labels: string[] = [];
    const counts = Array(bucketCount).fill(0);

    for (let i = 0; i < bucketCount; i++) {
      labels.push(timeMode === 'hours' ? `${bucketCount - i}h ago` : `${bucketCount - i}d ago`);
    }

    for (const item of items) {
      if (!item.updatedAt) continue;
      const updatedAt = new Date(item.updatedAt);
      const diffHours = (now.getTime() - updatedAt.getTime()) / 36e5;

      if (timeMode === 'hours') {
        if (diffHours <= selectedValue) {
          const bucket = Math.floor(selectedValue - diffHours);
          if (bucket >= 0 && bucket < bucketCount) counts[bucket]++;
        }
      } else {
        const diffDays = diffHours / 24;
        if (diffDays <= selectedValue) {
          const bucket = Math.floor(selectedValue - diffDays);
          if (bucket >= 0 && bucket < bucketCount) counts[bucket]++;
        }
      }
    }

    return labels.map((label, i) => ({ label, reviewed: counts[i] }));
  }

  const reviewData = computeHistogram(items, timeMode, selectedValue);

  return (
    <Fade in timeout={500}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          bgcolor: theme.palette.background.paper, 
          border: cardBorder,
          borderRadius: 2,
        }}
      >
      {/* --- TITLE + TIME CONTROLS ROW --- */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={{ xs: 2, md: 0 }}
        mb={2}
      >
        <Typography variant="h6" fontWeight={700}>
          Inventory Reviewed
        </Typography>

        {/* Right-side Time Range Controls - Hide on mobile */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          <ToggleButtonGroup
            color="primary"
            exclusive
            value={timeMode}
            size="small"
            onChange={(e, val) => {
              if (!val) return;

              onChangeTimeMode(val);

              // Clamp selectedValue to valid range
              if (val === 'days' && selectedValue > 7) {
                onChangeValue(7);
              }
              if (val === 'hours' && selectedValue > 24) {
                onChangeValue(24);
              }
            }}
          >
            <ToggleButton value="hours" sx={{ textTransform: 'none', px: 2 }}>Hours</ToggleButton>
            <ToggleButton value="days" sx={{ textTransform: 'none', px: 2 }}>Days</ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ width: 100 }}>
            <InputLabel>{timeMode === 'hours' ? 'Hours' : 'Days'}</InputLabel>
            <Select
              value={selectedValue}
              label={timeMode === 'hours' ? 'Hours' : 'Days'}
              onChange={(e) => onChangeValue(Number(e.target.value))}
            >
              {timeMode === 'hours'
                ? Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))
                : Array.from({ length: 7 }, (_, i) => i + 1).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {/* --- MAIN CONTENT ROW: CIRCLE LEFT, HISTOGRAM RIGHT --- */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
        {/* Circular progress on left */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'center', md: 'flex-start' },
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <CircularProgressBar value={percentReviewed} />
        </Box>

        {/* Histogram on right - Hide on mobile */}
        <Box
          sx={{
            flex: 1,
            minHeight: 160,
            display: { xs: 'none', md: 'block' },
            width: '100%',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
            Reviews in Last {selectedValue} {timeMode}
          </Typography>

          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={reviewData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }} 
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }} 
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="reviewed" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
      </Paper>
    </Fade>
  );
}