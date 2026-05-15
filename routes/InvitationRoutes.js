import { Router } from "express";
import { createInvitation, getInvitationBySlug } from "../controllers/InvitationController.js";

const router = Router();

router.post("/create",createInvitation);

router.get("/:slug",getInvitationBySlug);

export default router;