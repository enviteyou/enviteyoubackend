import express from "express";
import {
  createProject,
  getProjects,
  getProjectDetails,
  getProjectPhotos,
  bulkAddPhotos,
  generateCloudinarySignature,
  getSelectedPhotosForCopy,
  getClientProject,
  getClientPhotos,
  submitClientSelection,
  deleteProject,
  createFolder,
  renameFolder,
  deleteFolder,
  getProjectFolders,
  getClientProjectFolders,
  getProjectSelectionSummary,
  saveClientProgress,
} from "../controllers/PhotoSelectionController.js";
import authenticateVendor from "../middleware/authenticateVendor.js";

const router = express.Router();

// ==========================================
// VENDOR ROUTES (Protected by authenticateVendor)
// ==========================================

router.post("/projects", authenticateVendor, createProject);
router.get("/projects", authenticateVendor, getProjects);
router.get("/projects/:projectId", authenticateVendor, getProjectDetails);
router.get("/projects/:projectId/photos", authenticateVendor, getProjectPhotos);
router.post("/projects/:projectId/photos/bulk", authenticateVendor, bulkAddPhotos);
router.post("/cloudinary-signature", authenticateVendor, generateCloudinarySignature);
router.get("/projects/:projectId/selection-details", authenticateVendor, getSelectedPhotosForCopy);
router.delete("/projects/:projectId", authenticateVendor, deleteProject);

// Folder routes for vendor
router.post("/projects/:projectId/folders", authenticateVendor, createFolder);
router.put("/folders/:folderId", authenticateVendor, renameFolder);
router.delete("/folders/:folderId", authenticateVendor, deleteFolder);
router.get("/projects/:projectId/folders", authenticateVendor, getProjectFolders);
router.get("/projects/:projectId/selection-summary", authenticateVendor, getProjectSelectionSummary);

// ==========================================
// CLIENT ROUTES (Public accessible via unique selection token)
// ==========================================

router.get("/client/project/:token", getClientProject);
router.get("/client/project/:token/photos", getClientPhotos);
router.post("/client/project/:token/submit", submitClientSelection);
router.post("/client/project/:token/save-progress", saveClientProgress);
router.get("/client/project/:token/folders", getClientProjectFolders);

export default router;
