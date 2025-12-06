import { Paper, Typography, Grid, Card, Fade } from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';

interface InventoryStatusProps {
  teamName: string;
  totals: {
    toReview: number;
    completed: number;
    shortages: number;
    damaged: number;
  };
}

export default function InventoryStatus({ teamName, totals }: InventoryStatusProps) {
  const theme = useTheme();

  const items = [
    { title: 'To Review', value: totals.toReview, color: theme.palette.info.main },
    { title: 'Completed', value: totals.completed, color: theme.palette.success.main },
    { title: 'Shortages', value: totals.shortages, color: theme.palette.warning.main },
    { title: 'Damaged', value: totals.damaged, color: theme.palette.error.main },
  ];

  const countUp = keyframes`
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  return (
    <Fade in timeout={400}>
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
          {teamName}'s Inventory Status
        </Typography>
        <Grid container spacing={2}>
          {items.map((item, i) => (
            <Grid key={i} size={{ xs: 6, sm: 6, md: 3 }}>
              <Card
                elevation={0}
                sx={{
                  p: 2.5,
                  textAlign: 'center',
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: theme.palette.background.paper,
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  animation: `${countUp} 0.5s ease-out ${i * 0.1}s both`,
                  '&:hover': {
                    borderColor: item.color,
                    boxShadow: `0 4px 12px ${item.color}20`,
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                  {item.title}
                </Typography>
                <Typography variant="h4" fontWeight={700} sx={{ color: item.color, mt: 0.5 }}>
                  {item.value}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Fade>
  );
}
