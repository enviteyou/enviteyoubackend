import { Router } from "express";
import upload from "../middleware/upload.js";
import authenticateAdmin from "../middleware/authenticateAdmin.js";
import {
  createBlog,
  deleteBlog,
  getBlogById,
  getBlogs,
  updateBlog,
} from "../controllers/BlogController.js";

const router = Router();

const blogUpload = upload.fields([
  { name: "featuredImage", maxCount: 1 },
]);

router.get("/", getBlogs);
router.get("/:id", getBlogById);
router.post("/create", authenticateAdmin, blogUpload, createBlog);
router.put("/:id", authenticateAdmin, blogUpload, updateBlog);
router.delete("/:id", authenticateAdmin, deleteBlog);

export default router;
