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

const templateUpload = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getTemplates);
router.get("/:id", getTemplateById);
router.post("/create", templateUpload, createTemplate);
router.put("/:id", templateUpload, updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;