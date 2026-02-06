/**
 * Status overview card displaying inventory counts by status category.
 * Shows at-a-glance metrics for To Review, Completed, Shortages, and Damaged items.
 * Features animated count-up effects and color-coded status indicators.
 */
import { Paper, Typography, Grid, Card, Fade, ButtonBase } from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

interface InventoryStatusProps {
  teamName: string;
  teamId: string; 
  totals: {
    toReview: number;
    completed: number;
    shortages: number;
    damaged: number;
  };
}

export default function InventoryStatus({ teamName, teamId, totals }: InventoryStatusProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const items = [
    { title: 'To Review', value: totals.toReview, color: theme.palette.info.main, href: `/teams/to-review/${teamId}` },
    { title: 'Completed', value: totals.completed, color: theme.palette.success.main, href: `/teams/reviewed/${teamId}?tab=completed` },
    { title: 'Shortages', value: totals.shortages, color: theme.palette.warning.main, href: `/teams/reviewed/${teamId}?tab=shortages` },
    { title: 'Damaged', value: totals.damaged, color: theme.palette.error.main, href: `/teams/reviewed/${teamId}?tab=damaged` },
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
              <ButtonBase
                onClick={() => navigate(item.href)}
                sx={{ 
                  width: '100%', 
                  height: '100%',
                  borderRadius: 2 
                }}
              >
                <Card
                  elevation={0}
                  sx={{
                    p: 2.5,
                    textAlign: 'center',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 2,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    animation: `${countUp} 0.5s ease-out ${i * 0.1}s both`,
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: item.color,
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
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Fade>
  );
}