import { Router } from "express";
import { createInvitation, getInvitationBySlug, uploadGalleryImage } from "../controllers/InvitationController.js";
import upload from "../middleware/upload.js";

const router = Router();

router.post("/create",createInvitation);
router.post("/upload-image", upload.single("image"), uploadGalleryImage);

router.get("/:slug",getInvitationBySlug);

export default router;