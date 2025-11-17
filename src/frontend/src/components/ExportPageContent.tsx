import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  TextField,
  InputAdornment,
} from "@mui/material";
import { useParams } from "react-router-dom";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CircularProgressBar from "./CircularProgressBar";
import ExportPreview from "./ExportPreview";
import ItemListComponent, { ItemListItem } from "./ItemListComponent";
import { getInventoryForm } from "../api/api";

export default function ExportPageContent({
  items,
  percentReviewed,
  activeCategory,
}: {
  items: any[];
  percentReviewed: number;
  activeCategory: "completed" | "broken";
}) {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const completion = percentReviewed;
  const cardBorder = `1px solid ${theme.palette.divider}`;
  const team = "MNG INVENTORY";

  // Build hierarchy from items
  const buildHierarchy = (flatItems: any[]): ItemListItem[] => {
    const map: Record<string, ItemListItem> = {};
    const roots: ItemListItem[] = [];

    // First pass - create all items
    flatItems.forEach((item: any) => {
      map[item.itemId] = {
        id: item.itemId,
        productName: item.name,
        actualName: item.actualName || item.name,
        subtitle: item.description || 'No description',
        image: item.imageLink && item.imageLink.startsWith('http')
          ? item.imageLink
          : 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400',
        date: new Date(item.createdAt).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        parent: item.parent,
        status: item.status,
        children: []
      };
    });

    // Second pass - build parent-child relationships
    flatItems.forEach((item: any) => {
      const mappedItem = map[item.itemId];
      if (item.parent && map[item.parent]) {
        map[item.parent].children!.push(mappedItem);
      } else {
        roots.push(mappedItem);
      }
    });

    return roots;
  };

  // Filter items based on activeCategory
  const filteredItems = items.filter((item) => {
    const status = (item.status ?? "to review").toLowerCase();
    
    if (activeCategory === "completed") {
      return status === "completed" || status === "complete" || status === "found";
    } else {
      return status === "damaged" || status === "shortages" || status === "shortage" || status === "missing" || status === "in repair";
    }
  });

  // Build hierarchy for filtered items
  const hierarchyItems = buildHierarchy(filteredItems);

  // Search filtering function - searches through hierarchy
  const searchInHierarchy = (item: ItemListItem, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    const nameMatch = item.productName.toLowerCase().includes(lowerQuery) ||
                      item.actualName.toLowerCase().includes(lowerQuery);
    
    if (nameMatch) return true;
    
    // Search in children
    if (item.children && item.children.length > 0) {
      return item.children.some(child => searchInHierarchy(child, query));
    }
    
    return false;
  };

  // Filter hierarchy by search query
  const searchedItems = searchQuery.trim() 
    ? hierarchyItems.filter(item => searchInHierarchy(item, searchQuery))
    : hierarchyItems;

  // Calculate statistics for current category
  const categoryStats = {
    total: filteredItems.length,
    displayed: searchedItems.length,
    completed: activeCategory === "completed" ? filteredItems.length : 0,
    broken: activeCategory === "broken" ? filteredItems.length : 0,
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const data = await getInventoryForm(teamId, "2404");
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        alert("PDF not found or could not be retrieved.");
      }
    } catch (err: unknown) {
      console.error("Error fetching inventory form:", err);
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to fetch PDF.");
      }
    }
  };

  const handlePreviewOpen = async () => {
    try {
      const data = await getInventoryForm(teamId, "2404");
      if (data?.url) {
        setPdfUrl(data.url);
        setPreviewOpen(true);
      } else {
        alert("PDF not found.");
      }
    } catch (err: unknown) {
      console.error("Error fetching preview:", err);
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to open preview.");
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          bgcolor: theme.palette.background.default,
          p: { xs: 2, sm: 3, md: 4 },
          color: theme.palette.text.primary,
          pb: { xs: 12, sm: 14 },
        }}
      >
        {/* Search Bar */}
        <Box sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
          <TextField
            fullWidth
            placeholder={`Search ${activeCategory === "completed" ? "completed items" : "broken items"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ minWidth: "auto", p: 0.5 }}
                  >
                    <ClearIcon sx={{ color: theme.palette.text.secondary }} />
                  </Button>
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                bgcolor: theme.palette.background.paper,
              },
            }}
          />
          {searchQuery && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "center" }}>
              Showing {categoryStats.displayed} of {categoryStats.total} items
            </Typography>
          )}
        </Box>

        {isDesktop ? (
          // Desktop Layout
          <Box sx={{ display: "flex", gap: 3, minHeight: "calc(100vh - 240px)" }}>
            {/* Items List */}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  p: 2,
                  borderBottom: cardBorder,
                  bgcolor: theme.palette.background.default,
                }}
              >
                <Typography variant="h6" fontWeight={800}>
                  {activeCategory === "completed" 
                    ? "Completed Items" 
                    : "Broken Items"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Team: {team} {teamId && `• ID: ${teamId}`} • Items: {categoryStats.displayed}
                </Typography>
              </Box>

              {/* Items Display Area */}
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  overflowY: "auto",
                  bgcolor: theme.palette.background.default,
                }}
              >
                {searchedItems.length > 0 ? (
                  <ItemListComponent items={searchedItems} />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: theme.palette.text.secondary,
                    }}
                  >
                    <Typography variant="body1">
                      {searchQuery 
                        ? "No items found matching your search"
                        : `No ${activeCategory === "completed" ? "completed" : "broken"} items`}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Sidebar */}
            <Box sx={{ width: 320 }}>
              <Stack spacing={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    {activeCategory === "completed" ? "Export Status" : "Broken Items"}
                  </Typography>
                  <CircularProgressBar value={completion} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {activeCategory === "completed" 
                      ? `${categoryStats.completed} completed items`
                      : `${categoryStats.broken} items require attention`}
                  </Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={3}>
                    Export Actions
                  </Typography>
                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      startIcon={<PrintIcon />}
                      onClick={handlePrint}
                      sx={{ py: 1.5, fontWeight: 700 }}
                    >
                      Print Report
                    </Button>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={handleDownloadPDF}
                      sx={{
                        py: 1.5,
                        fontWeight: 700,
                        bgcolor: theme.palette.warning.main,
                        color: theme.palette.getContrastText(theme.palette.warning.main),
                        "&:hover": {
                          bgcolor: theme.palette.warning.dark,
                        },
                      }}
                    >
                      Download PDF
                    </Button>
                  </Stack>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>
                    Document Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Category: {activeCategory === "completed" ? "Completed Inventory" : "Broken Items"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Generated: {new Date().toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Format: PDF Document
                  </Typography>
                </Paper>
              </Stack>
            </Box>
          </Box>
        ) : (
          // Mobile Layout
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                mb: 3,
              }}
            >
              <Typography variant="h5" fontWeight={800} mb={1}>
                {activeCategory === "completed" ? "Completed Items" : "Broken Items"}
              </Typography>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Team: <strong>{team}</strong> {teamId && `• ID: ${teamId}`}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  my: 3,
                }}
              >
                <CircularProgressBar value={completion} />
              </Box>

              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                {activeCategory === "completed" 
                  ? `${categoryStats.completed} completed items`
                  : `${categoryStats.broken} items require attention`}
              </Typography>

              <Stack spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ py: 1.5, fontWeight: 700 }}
                  onClick={handlePreviewOpen}
                >
                  View PDF
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PictureAsPdfIcon />}
                  onClick={handleDownloadPDF}
                  sx={{ py: 1.5, fontWeight: 700 }}
                >
                  Download PDF
                </Button>
              </Stack>
            </Paper>

            {/* Mobile Items List */}
            <Paper
              elevation={0}
              sx={{
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                p: 2,
              }}
            >
              <Typography variant="h6" fontWeight={800} mb={2}>
                Items List
              </Typography>
              {searchedItems.length > 0 ? (
                <ItemListComponent items={searchedItems} />
              ) : (
                <Typography sx={{ textAlign: "center", color: theme.palette.text.disabled, py: 4 }}>
                  {searchQuery 
                    ? "No items found matching your search"
                    : `No ${activeCategory === "completed" ? "completed" : "broken"} items`}
                </Typography>
              )}
            </Paper>
          </Box>
        )}
      </Box>

      {/* PDF Preview Modal (Mobile Only) */}
      <ExportPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={pdfUrl || ""}
        completion={completion}
        team={team}
        onPrint={handlePrint}
        onDownload={handleDownloadPDF}
      />

      {/* Bottom Nav */}
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
      </Box>
    </Box>
  );
}