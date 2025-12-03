/* eslint-disable @typescript-eslint/no-explicit-any */
import { Paper, Typography, Box, Fade } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

interface TeamActivityChartProps {
  teamStats: Array<{
    userId: string;
    name: string;
    completed: number;
    shortages: number;
    damaged: number;
  }>;
}

export default function TeamActivityChart({ teamStats }: TeamActivityChartProps) {
  const theme = useTheme();

  // Custom shape for top bar with rounded corners
  const RoundedTopBar = (props: any) => {
    const { fill, x, y, width, height } = props;
    
    if (height <= 0) return null;

    const radius = 4;
    const path = `
      M ${x},${y + radius}
      Q ${x},${y} ${x + radius},${y}
      L ${x + width - radius},${y}
      Q ${x + width},${y} ${x + width},${y + radius}
      L ${x + width},${y + height}
      L ${x},${y + height}
      Z
    `;
    
    return <path d={path} fill={fill} />;
  };

  return (
    <Fade in timeout={600}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          bgcolor: theme.palette.background.paper, 
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" fontWeight={700} mb={2}>
          Team Activity
        </Typography>
      <Box sx={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={teamStats.map((t) => ({
              name: t.name,
              completed: t.completed,
              shortages: t.shortages,
              damaged: t.damaged,
            }))}
            data-testid="bar-chart"
            data-chart-data={JSON.stringify(teamStats.map((t) => ({
              name: t.name,
              completed: t.completed,
              shortages: t.shortages,
              damaged: t.damaged,
            })))}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey="name"
              tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: alpha(theme.palette.primary.main, 0.04) }}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 8,
              }}
              labelStyle={{
                color: theme.palette.text.primary,
                fontWeight: 600,
              }}
              itemStyle={{ color: theme.palette.text.primary }}
            />
            <Bar
              dataKey="completed"
              stackId="a"
              fill={theme.palette.success.main}
              shape={RoundedTopBar}
              data-testid="bar-completed"
              data-has-shape="true"
            />
            <Bar 
              dataKey="shortages" 
              stackId="a" 
              fill={theme.palette.warning.main}
              shape={RoundedTopBar}
              data-testid="bar-shortages"
              data-has-shape="true"
            />
            <Bar 
              dataKey="damaged" 
              stackId="a" 
              fill={theme.palette.error.main}
              shape={RoundedTopBar}
              data-testid="bar-damaged"
              data-has-shape="true"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      </Paper>
    </Fade>
  );
}