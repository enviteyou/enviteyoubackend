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

// ==========================================
// CLIENT ROUTES (Public accessible via unique selection token)
// ==========================================

router.get("/client/project/:token", getClientProject);
router.get("/client/project/:token/photos", getClientPhotos);
router.post("/client/project/:token/submit", submitClientSelection);

export default router;
