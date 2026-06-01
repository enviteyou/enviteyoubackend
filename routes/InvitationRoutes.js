import { Router } from "express";
import { createInvitation, getInvitationById, getInvitationBySlug, getMyInvitations, uploadGalleryImage } from "../controllers/InvitationController.js";
import authUser from "../middleware/authenticate.js";
import upload from "../middleware/upload.js";
import authenticateVendor from "../middleware/authenticateVendor.js";

const router = Router();

router.post("/create", authUser, createInvitation);
router.post("/upload-image", upload.single("image"), uploadGalleryImage);

router.get("/getMyInvitations", authUser, getMyInvitations);
router.get("/getMyInvitations/vendor",authenticateVendor, getMyInvitations);

router.get("/id/:id", getInvitationById);
router.get("/:slug",getInvitationBySlug);

export default router;