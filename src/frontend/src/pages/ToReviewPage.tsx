import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import ItemListComponent, { ItemListItem } from '../components/ItemListComponent';
import NavBar from '../components/NavBar';
import PercentageBar from '../components/PercentageBar';

export default function InventoryToReviewPage() {
  const reviewItems: ItemListItem[] = [
    {
      id: 1,
      productName: 'Pocket Knife',
      actualName: 'Sharp object',
      subtitle: 'Kit A',
      image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fht-pocket-knife.com%2Fwp-content%2Fuploads%2F2024%2F10%2F026-1.jpg&f=1&nofb=1&ipt=8e691e32cdd78c6c40fbdd3a66a570d578fc8390837faf6b45cdb65e348a5ee7?w=400',
      date: '10/25/25'
    },
    {
      id: 2,
      productName: 'T7 Mini Tank',
      actualName: 'Small Tank',
      subtitle: 'Missing its left track assembly and requiring a firmware update. Kit B...',
      image: 'https://images.unsplash.com/photo-1580982172477-9373ff52ae43?w=400',
      date: '10/24/25'
    },
    {
      id: 3,
      productName: 'Coax Cable',
      actualName: 'Thick cable',
      subtitle: 'Kit A',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
      date: '10/23/25'
    },
    {
      id: 4,
      productName: 'Modi Power Pack',
      actualName: 'Device name',
      subtitle: "Currently in repair. It's ETA is August Kit C...",
      image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400',
      date: '10/22/25'
    },
    {
      id: 5,
      productName: 'Dewalt Battery Container',
      actualName: 'Dewalt A20310',
      subtitle: 'One battery is currently with another...',
      image: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400',
      date: '10/20/25'
    }
  ];

  return (
    <div>
      <PercentageBar />
      <Box sx={{ width: '100%', bgcolor: '#e8e8e8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Container maxWidth="md">
            <Typography
              variant="h5"
              sx={{
                fontWeight: 550,
                color: '#333',
                fontSize: { xs: '1.25rem', sm: '1.5rem' }
              }}
            >
              Inventory To Review
            </Typography>
          </Container>
        </Box>

        {/* Content */}
        <Container maxWidth="md" disableGutters>
          <Box sx={{ p: 2, pb: 10 }}>
            <ItemListComponent items={reviewItems} />
          </Box>
        </Container>
      </Box>
      <NavBar />
    </div>
  );
}
