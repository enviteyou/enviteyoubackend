import { Router } from "express";
import upload from "../middleware/upload.js";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  updateTemplate,
} from "../controllers/TemplateController.js";

const router = Router();

router.get("/", getTemplates);
router.get("/:id", getTemplateById);
router.post("/create", upload.single("featuredImage"), createTemplate);
router.put("/:id", upload.single("featuredImage"), updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;