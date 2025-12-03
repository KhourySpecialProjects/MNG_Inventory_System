import { Paper, Typography, Box, Fade } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

interface FollowUpsTableProps {
  followUps: Array<{
    itemId: string;
    name: string;
    status: string;
    parentName: string;
    updatedAt: string;
    lastReviewedByName: string;
  }>;
}

export default function FollowUpsTable({ followUps }: FollowUpsTableProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { teamId } = useParams();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleRowClick = (itemId: string) => {
    if (teamId) {
      navigate(`/teams/${teamId}/items/${itemId}`);
    }
  };

  return (
    <Fade in timeout={700}>
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
          Follow-Ups
        </Typography>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            padding: '10px 12px',
            borderBottom: `1px solid ${theme.palette.divider}`,
            textAlign: 'left',
            fontSize: '0.875rem',
          },
          '& th': {
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            fontWeight: 600,
            color: theme.palette.text.secondary,
          },
          '& tbody tr': {
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          },
        }}
      >
        <thead>
          <tr>
            <th>Item</th>
            <th>Kit</th>
            <th>Status</th>
            <th>Last Reviewed By</th>
            <th>Reviewed On</th>
          </tr>
        </thead>
        <tbody>
          {followUps.length > 0 ? (
            followUps.map((item) => (
              <tr
                key={item.itemId}
                onClick={() => handleRowClick(item.itemId)}
                onMouseEnter={() => {
                  setHoveredRow(item.itemId);
                  setHasInteracted(true);
                }}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  backgroundColor: hoveredRow === item.itemId 
                    ? alpha(theme.palette.primary.main, 0.04) 
                    : hasInteracted ? 'transparent' : '',
                }}
              >
                <td>{item.name}</td>
                <td>{item.parentName ?? 'N/A'}</td>
                <td>{item.status}</td>
                <td>{item.lastReviewedByName ?? 'N/A'}</td>
                <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: theme.palette.text.secondary }}>
                No follow-ups
              </td>
            </tr>
          )}
        </tbody>
      </Box>
      </Paper>
    </Fade>
  );
}
