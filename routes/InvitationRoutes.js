import { Router } from "express";
import { createInvitation, getInvitationBySlug, getMyInvitations, uploadGalleryImage } from "../controllers/InvitationController.js";
import authUser from "../middleware/authenticate.js";
import upload from "../middleware/upload.js";

const router = Router();

router.post("/create", authUser, createInvitation);
router.post("/upload-image", upload.single("image"), uploadGalleryImage);

router.get("/getMyInvitations", authUser, getMyInvitations);

router.get("/:slug",getInvitationBySlug);

export default router;