/**
 * Hierarchical tree view displaying kit contents and nested items.
 * Features expandable/collapsible nodes with visual depth indicators and status badges.
 * Shows AddItemButton for kits in edit mode to maintain parent-child relationships.
 * Supports inline status editing for kit children — changes are staged locally
 * and only persisted when the parent kit is saved via ActionPanel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PendingIcon from '@mui/icons-material/Pending';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningIcon from '@mui/icons-material/Warning';
import { useTheme, alpha } from '@mui/material/styles';
import AddItemButton from '../ProductPage/AddItemButton';
import DamageReportsSection from './DamageReportsSection';

export interface ChildEdits {
  status: string;
  damageReports: string[];
  ohQuantity: number | string;
}

interface ChildrenTreeProps {
  editedProduct: any;
  teamId: string;
  isCreateMode?: boolean;
  isEditMode?: boolean;
  childEdits: Record<string, ChildEdits>;
  onChildEditsChange: (edits: Record<string, ChildEdits>) => void;
}

const statuses = [
  { value: 'To Review', label: 'To Review', icon: <PendingIcon />, color: '#9e9e9e' },
  { value: 'Completed', label: 'Completed', icon: <CheckCircleIcon />, color: '#4caf50' },
  { value: 'Damaged', label: 'Damaged', icon: <ReportProblemIcon />, color: '#f44336' },
  { value: 'Shortages', label: 'Shortages', icon: <WarningIcon />, color: '#ff9800' },
];

export default function ChildrenTree({
  editedProduct,
  teamId,
  isCreateMode = false,
  isEditMode = false,
  childEdits,
  onChildEditsChange,
}: ChildrenTreeProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Never show in create mode
  if (isCreateMode) {
    return null;
  }

  const getChildState = (child: any): ChildEdits => {
    if (childEdits[child.itemId]) {
      return childEdits[child.itemId];
    }
    return {
      status: child.status || 'To Review',
      damageReports: child.damageReports || [],
      ohQuantity: child.ohQuantity ?? '',
    };
  };

  const handleChildStatusChange = (child: any, newStatus: string) => {
    const current = getChildState(child);
    const updated = { ...current, status: newStatus };
    onChildEditsChange({ ...childEdits, [child.itemId]: updated });
  };

  const handleChildDamageReportsChange = (childId: string, reports: string[]) => {
    const current = childEdits[childId] || { status: '', damageReports: [], ohQuantity: '' };
    onChildEditsChange({
      ...childEdits,
      [childId]: { ...current, damageReports: reports },
    });
  };

  const handleChildOhQuantityChange = (childId: string, value: string) => {
    const current = childEdits[childId] || { status: '', damageReports: [], ohQuantity: '' };
    onChildEditsChange({
      ...childEdits,
      [childId]: { ...current, ohQuantity: value },
    });
  };

  const toggleExpand = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const renderChild = (child: any, level = 0) => {
    const hasChildren = !!child.children?.length;
    const isExpanded = expandedItems.has(child.itemId);
    const isKit = child.isKit;
    const childState = getChildState(child);

    return (
      <Box key={child.itemId}>
        <Card
          onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
          sx={{
            p: 1.5,
            cursor: 'pointer',
            bgcolor:
              level === 0
                ? theme.palette.background.paper
                : theme.palette.mode === 'dark'
                  ? `rgba(${theme.palette.primary.main.replace('rgb(', '').replace(')', '')}, ${
                      0.04 * (level + 1)
                    })`
                  : `rgba(25, 118, 210, ${0.05 * (level + 1)})`,
            '&:hover': {
              bgcolor:
                theme.palette.mode === 'dark'
                  ? theme.palette.action.hover
                  : theme.palette.action.hover,
            },
            borderLeft:
              level > 0
                ? `3px solid ${
                    theme.palette.mode === 'dark'
                      ? theme.palette.primary.dark
                      : `rgba(25,118,210,${0.3 + level * 0.2})`
                  }`
                : 'none',
            ml: level * 2,
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {'  '.repeat(level)}├─ {child.name}
                </Typography>

                {/* Kit/Item Indicator */}
                <Chip
                  label={isKit ? 'Kit' : 'Item'}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: isKit
                      ? alpha(theme.palette.info.main, 0.1)
                      : alpha(theme.palette.success.main, 0.1),
                    color: isKit ? theme.palette.info.main : theme.palette.success.main,
                    '& .MuiChip-label': {
                      px: 1,
                    },
                  }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary">
                {'  '.repeat(level)} {child.actualName || child.name}
              </Typography>

              {childState.status && (
                <Chip
                  label={childState.status}
                  size="small"
                  sx={{ ml: 1, mt: 0.5 }}
                  color={
                    childState.status === 'Completed'
                      ? 'success'
                      : childState.status === 'Damaged'
                        ? 'error'
                        : childState.status === 'Shortages'
                          ? 'warning'
                          : childState.status === 'To Review'
                            ? 'default'
                            : 'default'
                  }
                />
              )}
            </Box>

            {hasChildren && (
              <IconButton
                onClick={(e) => toggleExpand(child.itemId, e)}
                sx={{ color: theme.palette.primary.main }}
                size="small"
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>

          {/* Inline status editing — inside the card */}
          <Box
            sx={{
              mt: 1,
              pt: 1,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              sx={{ gap: 0.5 }}
            >
              {statuses.map((s) => (
                <Button
                  key={s.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChildStatusChange(child, s.value);
                  }}
                  variant={childState.status === s.value ? 'contained' : 'outlined'}
                  startIcon={s.icon}
                  size="small"
                  aria-label={`Set ${child.name} status to ${s.value}`}
                  sx={{
                    textTransform: 'none',
                    fontSize: { xs: '0.575rem', sm: '0.7rem' },
                    px: { xs: 0.4, sm: 0.8 },
                    py: { xs: 0.3, sm: 0.6 },
                    minWidth: 'auto',
                    fontWeight: childState.status === s.value ? 700 : 500,
                    bgcolor: childState.status === s.value ? s.color : 'transparent',
                    color: childState.status === s.value ? 'white' : s.color,
                    borderColor: s.color,
                    '&:hover': {
                      bgcolor: childState.status === s.value ? s.color : `${s.color}20`,
                      borderColor: s.color,
                    },
                    '& .MuiButton-startIcon': {
                      marginRight: { xs: '2px', sm: '4px' },
                    },
                  }}
                >
                  {s.label}
                </Button>
              ))}
            </Stack>

            {/* Damage Reports inline when status is Damaged */}
            {childState.status === 'Damaged' && (
              <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                <DamageReportsSection
                  damageReports={childState.damageReports}
                  setDamageReports={(reports) =>
                    handleChildDamageReportsChange(child.itemId, reports)
                  }
                  isEditMode={true}
                />
              </Box>
            )}

            {/* OH Quantity inline when status is Shortages and child is an item (not a kit) */}
            {childState.status === 'Shortages' && !isKit && (
              <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                <TextField
                  label="OH Quantity"
                  type="text"
                  size="small"
                  value={childState.ohQuantity}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleChildOhQuantityChange(child.itemId, e.target.value);
                  }}
                  sx={{ width: 150 }}
                />
              </Box>
            )}
          </Box>
        </Card>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto">
            <Box sx={{ mt: 0.5 }}>
              {child.children.map((subChild: any) => renderChild(subChild, level + 1))}
              {/* Add button for kits - only show in edit mode */}
              {child.isKit && isEditMode && (
                <Box sx={{ ml: (level + 1) * 2 }}>
                  <AddItemButton parentId={child.itemId} level={0} teamId={teamId} />
                </Box>
              )}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  // Don't show the entire section if no children and not a kit
  if (!editedProduct?.children || editedProduct.children.length === 0) {
    // Show only the Add button if this is a kit with no children yet AND in edit mode
    if (editedProduct?.isKit && isEditMode) {
      return (
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor:
              theme.palette.mode === 'dark'
                ? theme.palette.background.default
                : theme.palette.grey[100],
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            📦 Kit Contents (0 items)
          </Typography>
          <AddItemButton parentId={editedProduct.itemId} level={0} teamId={teamId} />
        </Box>
      );
    }
    // If not in edit mode or not a kit, show just the count without Add button
    if (editedProduct?.isKit) {
      return (
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor:
              theme.palette.mode === 'dark'
                ? theme.palette.background.default
                : theme.palette.grey[100],
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            📦 Kit Contents (0 items)
          </Typography>
        </Box>
      );
    }
    return null;
  }

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        bgcolor:
          theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.grey[100],
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        📦 Kit Contents ({editedProduct.children.length} item
        {editedProduct.children.length !== 1 ? 's' : ''})
      </Typography>

      <Stack spacing={0.5}>
        {editedProduct.children.map((child: any) => renderChild(child, 0))}
        {/* Add button at the end if this is a kit AND in edit mode */}
        {editedProduct.isKit && isEditMode && (
          <AddItemButton parentId={editedProduct.itemId} level={0} teamId={teamId} />
        )}
      </Stack>
    </Box>
  );
}
