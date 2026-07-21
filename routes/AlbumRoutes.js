import express from "express";
import {
  createAlbum,
  getAlbumByToken,
  getProjectAlbums,
  getVendorAlbums,
  deleteAlbum,
} from "../controllers/AlbumController.js";
import authenticateVendor from "../middleware/authenticateVendor.js";

const router = express.Router();

// Public route
router.get("/public/:token", getAlbumByToken);

// Protected vendor routes
router.post("/", authenticateVendor, createAlbum);
router.get("/project/:projectId", authenticateVendor, getProjectAlbums);
router.get("/vendor", authenticateVendor, getVendorAlbums);
router.delete("/:albumId", authenticateVendor, deleteAlbum);

export default router;
