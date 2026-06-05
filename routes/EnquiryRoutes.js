import { Router } from "express";
import authenticateAdmin from "../middleware/authenticateAdmin.js";
import {
  createEnquiry,
  deleteEnquiry,
  getEnquiries,
} from "../controllers/EnquiryController.js";

const router = Router();

router.post("/create", createEnquiry);
router.get("/", authenticateAdmin, getEnquiries);
router.delete("/:id", authenticateAdmin, deleteEnquiry);

export default router;
