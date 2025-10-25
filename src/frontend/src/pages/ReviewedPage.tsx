import React, { useState } from 'react';
import { Box, Container, Tab, Tabs, Typography } from '@mui/material';
import ItemListComponent, { ItemListItem } from '../components/ItemListComponent';
import PercentageBar from '../components/PercentageBar';
import NavBar from '../components/NavBar';
import { useTheme } from '@mui/material/styles';

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function MainPageComponent() {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const theme = useTheme();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

 // Sample data for different tabs
const completedItems: ItemListItem[] = [
  {
    id: 1,
    productName: 'Microphone',
    actualName: 'Sound recorder',
    subtitle: 'Inspected and verified',
    image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400',
    date: '10/25/25'
  },
  {
    id: 2,
    productName: 'Pelican Case',
    actualName: 'Grey pouch',
    subtitle: 'All contents present',
    image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%2Fid%2FOIP.nS4ht86gz35GhTm65LCxeAHaI5%3Fpid%3DApi&f=1&ipt=2e1cc62ef2574182a608b347397864bdfc6f4ae6b5bb0ded582def17958dc66a&ipo=images',
    date: '10/23/25'
  },
  {
    id: 3,
    productName: 'Micro USB Cable',
    actualName: 'Black cable',
    subtitle: 'Tested and working',
    image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmedia.startech.com%2Fcms%2Fproducts%2Fgallery_large%2Fusbaubxmbk.c.jpg&f=1&nofb=1&ipt=6137ad87724fed751c98dc04a0b21fd934607ab0195ce39c845d822f2af79653',
    date: '10/21/25'
  },
  {
    id: 4,
    productName: 'Battery Pack',
    actualName: 'ION Charger',
    subtitle: 'Fully charged, no issues',
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400',
    date: '10/20/25'
  },
  {
    id: 5,
    productName: 'Shovel',
    actualName: 'Ground digger',
    subtitle: 'Standard issue, good condition',
    image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fpngimg.com%2Fuploads%2Fshovel%2Fshovel_PNG108903.png&f=1&nofb=1&ipt=d8ca3347e68ae6a35484df864fed229a073f6d980c0280d27fb3571c84e6b889',
    date: '10/18/25'
  },
  {
    id: 6,
    productName: 'Flashlight',
    actualName: 'Light emitter',
    subtitle: 'New batteries installed',
    image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fpngimg.com%2Fuploads%2Fflashlight%2Fflashlight_PNG55946.png&f=1&nofb=1&ipt=67ddfc1e0b14608bd8e1679c014f3ed394510fe092e87963d5b8d0c6f508b03a',
    date: '10/15/25'
  }
];

const shortagesItems: ItemListItem[] = [
  {
    id: 7,
    productName: 'First Aid Kit',
    actualName: 'Medic supply box',
    subtitle: 'Missing bandages and antiseptic',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400',
    date: '10/24/25'
  },
  {
    id: 8,
    productName: 'Compass',
    actualName: 'Navigator',
    subtitle: 'Not returned from previous assignment',
    image: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=400',
    date: '10/22/25'
  },
  {
    id: 9,
    productName: 'Water Canteen',
    actualName: 'Water Bucket',
    subtitle: 'Only 2 of 4 accounted for',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400',
    date: '10/19/25'
  }
];

const damagedItems: ItemListItem[] = [
  {
    id: 10,
    productName: 'Tactical Vest',
    actualName: 'Defense pad',
    subtitle: 'Torn strap, needs repair',
    image: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%2Fid%2FOIP.aHvORnEn6_mA0z67R0l0MAHaJu%3Fpid%3DApi&f=1&ipt=f38f1072dcdaf49079ed39ed13e3645819b29932462d9d6cbc1074eb763e6951&ipo=images',
    date: '10/24/25'
  },
  {
    id: 11,
    productName: 'Radio Headset',
    actualName: 'Audio Listener',
    subtitle: 'Cracked earpiece',
    image: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=400',
    date: '10/23/25'
  },
  {
    id: 12,
    productName: 'Backpack',
    actualName: 'Carry on',
    subtitle: 'Broken zipper on main compartment',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    date: '10/20/25'
  },
  {
    id: 13,
    productName: 'Binoculars',
    actualName: 'Magnifier',
    subtitle: 'Lens scratched, affects visibility',
    image: 'https://images.unsplash.com/photo-1580982172477-9373ff52ae43?w=400',
    date: '10/17/25'
  }
];

  return (
    <div>
      <PercentageBar />
      <Box sx={{ width: '100%', bgcolor: '#e8e8e8', minHeight: '100vh' }}>
        {/* Tabs Header - Full Width */}
        <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            aria-label="inventory tabs"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: theme.palette.text.secondary,
                minWidth: 'auto'
              },
              '& .Mui-selected': {
                color: theme.palette.primary.main
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.primary.main,
                height: 3
              }
            }}
          >
            <Tab label="Completed" />
            <Tab label="Shortages" />
            <Tab label="Damaged" />
          </Tabs>
        </Box>

        {/* Tab Panels - Constrained Width */}
        <Container maxWidth="md" disableGutters>
          <Box sx={{ p: 2, pb: 10 }}>
            <TabPanel value={selectedTab} index={0}>
              <ItemListComponent items={completedItems} />
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              {shortagesItems.length > 0 ? (
                <ItemListComponent items={shortagesItems} />
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#999', py: 4 }}>
                  No shortages reported
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={2}>
              {damagedItems.length > 0 ? (
                <ItemListComponent items={damagedItems} />
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#999', py: 4 }}>
                  No damaged items
                </Typography>
              )}
            </TabPanel>
          </Box>
        </Container>
      </Box>
      <NavBar />
    </div>
  );
}


